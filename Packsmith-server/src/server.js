const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function createService(root = process.env.PACKSMITH_SERVER_DATA || path.join(process.cwd(), 'data')) {
  fs.mkdirSync(path.join(root, 'blobs'), { recursive: true });
  const db = new DatabaseSync(path.join(root, 'server.db'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS packs(code TEXT PRIMARY KEY, manifest TEXT NOT NULL, created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS blobs(hash TEXT PRIMARY KEY, size INTEGER NOT NULL)');
  const reply=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
  return http.createServer(async(req,res)=>{
    try {
      if(req.method==='GET' && req.url.startsWith('/v1/packs/')) { const code=req.url.split('/')[3]?.toUpperCase(); const row=db.prepare('SELECT manifest FROM packs WHERE code=?').get(code); return row?reply(res,200,JSON.parse(row.manifest)):reply(res,404,{error:'Pack not found'}); }
      if(req.method==='GET' && req.url.startsWith('/v1/blobs/')) { const hash=req.url.split('/')[3]; if(!/^[a-f0-9]{64}$/.test(hash))return reply(res,400,{error:'Invalid hash'});const file=path.join(root,'blobs',hash);if(!fs.existsSync(file))return reply(res,404,{error:'Blob not found'});res.writeHead(200,{'content-type':'application/java-archive','content-length':fs.statSync(file).size});return fs.createReadStream(file).pipe(res); }
      if(req.method==='POST' && req.url==='/v1/packs') { let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>256*1024*1024)throw new Error('Upload too large');chunks.push(chunk);}const input=JSON.parse(Buffer.concat(chunks));if(!input.name||!Array.isArray(input.files))return reply(res,400,{error:'name and files are required'});const files=input.files.map(file=>{const bytes=Buffer.from(file.data,'base64');const hash=crypto.createHash('sha256').update(bytes).digest('hex');const target=path.join(root,'blobs',hash);if(!fs.existsSync(target))fs.writeFileSync(target,bytes,{flag:'wx'});db.prepare('INSERT OR IGNORE INTO blobs(hash,size) VALUES(?,?)').run(hash,bytes.length);return {name:file.name,hash,size:bytes.length};});let code;do{code=`PS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;}while(db.prepare('SELECT 1 FROM packs WHERE code=?').get(code));const manifest={code,name:input.name,version:input.version||1,files};db.prepare('INSERT INTO packs VALUES(?,?,?)').run(code,JSON.stringify(manifest),Date.now());return reply(res,201,manifest); }
      reply(res,404,{error:'Not found'});
    } catch(error) { reply(res,error.message==='Upload too large'?413:400,{error:error.message}); }
  });
}
if(require.main===module)createService().listen(Number(process.env.PORT)||8787,()=>console.log(`Packsmith server listening on ${Number(process.env.PORT)||8787}`));
module.exports={createService};
