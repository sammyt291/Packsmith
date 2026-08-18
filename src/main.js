const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { SqliteStore } = require('./store');
const { versionCatalog, discover, installInstance, completeMicrosoftAuth } = require('./services');

let store; let mainWindow; const authSessions = new Map(); const installing = new Set();
const CLIENT_ID = process.env.PACKSMITH_MS_CLIENT_ID;
function dataRoot() { return process.platform === 'win32' ? path.join(process.env.PROGRAMDATA || app.getPath('appData'), 'Packsmith') : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'Packsmith'); }
function send(channel, value) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, value); }

function createWindow() {
  mainWindow = new BrowserWindow({ width:1440,height:900,minWidth:1050,minHeight:680,backgroundColor:'#0d0f0e',titleBarStyle:'hiddenInset',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false} });
  mainWindow.loadFile(path.join(__dirname,'index.html'));
  if(process.env.PACKSMITH_SCREENSHOT) mainWindow.webContents.once('did-finish-load',async()=>{await new Promise(r=>setTimeout(r,1200));require('node:fs').writeFileSync(process.env.PACKSMITH_SCREENSHOT,(await mainWindow.webContents.capturePage()).toPNG());app.quit();});
}

async function startLogin() {
  if (!CLIENT_ID) throw new Error('Set PACKSMITH_MS_CLIENT_ID to the client ID of a Microsoft public/native application.');
  const body=new URLSearchParams({client_id:CLIENT_ID,scope:'XboxLive.signin offline_access'}); const response=await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode',{method:'POST',body});
  if(!response.ok) throw new Error('Microsoft sign-in could not be started.'); const device=await response.json(); const sessionId=crypto.randomUUID(); authSessions.set(sessionId,device);
  completeMicrosoftAuth(device,CLIENT_ID).then(({account,credentials})=>{store.setCredentials(account.id,credentials);store.save({...store.data,accounts:[...store.data.accounts.filter(a=>a.id!==account.id),account],selectedAccountId:account.id});send('auth:result',{sessionId,account});authSessions.delete(sessionId);}).catch(error=>{send('auth:result',{sessionId,error:error.message});authSessions.delete(sessionId);});
  return {...device,sessionId};
}

function registerIpc(){
  ipcMain.handle('state:get',()=>store.data); ipcMain.handle('state:save',(_e,s)=>store.save(s)); ipcMain.handle('auth:start',startLogin);
  ipcMain.handle('catalog:versions',()=>versionCatalog(store)); ipcMain.handle('catalog:discover',()=>discover(store));
  ipcMain.handle('external:open',(_e,url)=>shell.openExternal(url)); ipcMain.handle('clipboard:write',(_e,v)=>clipboard.writeText(v));
  ipcMain.handle('instance:install',(_e,instance)=>{if(installing.has(instance.id))return false;installing.add(instance.id);instance.status='installing';store.save(store.data);installInstance(dataRoot(),instance,p=>send('instance:progress',p)).then(result=>{instance.status='ready';instance.directory=result.root;instance.javaExecutable=result.javaExecutable;store.save(store.data);send('instance:progress',{id:instance.id,value:1,message:'Ready',status:'ready'});}).catch(error=>{instance.status='error';instance.error=error.message;store.save(store.data);send('instance:progress',{id:instance.id,value:0,message:error.message,status:'error'});}).finally(()=>installing.delete(instance.id));return true;});
  ipcMain.handle('share:create',(_e,id)=>{const item=store.data.instances.find(x=>x.id===id);if(!item)throw new Error('Instance not found');item.shareCode||=`PS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;store.save(store.data);return item.shareCode;});
}
app.whenReady().then(()=>{store=new SqliteStore(path.join(dataRoot(),'packsmith.db'));registerIpc();createWindow();app.on('activate',()=>BrowserWindow.getAllWindows().length||createWindow());});
app.on('window-all-closed',()=>process.platform!=='darwin'&&app.quit());
