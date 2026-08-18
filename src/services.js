const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);

const json = async (url, options) => { const r = await fetch(url, options); if (!r.ok) throw new Error(`${new URL(url).hostname}: ${r.status}`); return r.json(); };
async function cached(store, key, fetcher) { return store.cached(key) || store.cache(key, await fetcher()); }

async function versionCatalog(store) {
  return cached(store, 'versions:v2', async () => {
    const [vanilla, fabric, forge, neo] = await Promise.all([
      json('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'),
      json('https://meta.fabricmc.net/v2/versions/game'),
      json('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'),
      fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge').then(r => r.ok ? r.json() : { versions: [] })
    ]);
    const releases = vanilla.versions.filter(v => v.type === 'release').map(v => v.id);
    return {
      Vanilla: releases,
      Fabric: fabric.filter(v => v.stable).map(v => v.version),
      Forge: [...new Set(Object.keys(forge.promos).map(k => k.split('-')[0]))],
      NeoForge: [...new Set((neo.versions || []).map(v => { const [major, minor] = v.split('.'); return major === '20' ? `1.20.${minor}` : major === '21' ? `1.21.${minor}` : null; }).filter(Boolean))]
    };
  });
}

async function discover(store) {
  return cached(store, 'discover:v2', async () => {
    const data = await json('https://api.modrinth.com/v2/search?facets=[[\"project_type:modpack\"]]&index=downloads&limit=24');
    return data.hits.map(p => ({ provider: 'Modrinth', id: p.project_id, name: p.title, summary: p.description, author: p.author, artwork: p.icon_url, downloads: p.downloads, url: `https://modrinth.com/modpack/${p.slug}` }));
  });
}

async function download(url, target, progress) {
  if (fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const response = await fetch(url); if (!response.ok || !response.body) throw new Error(`Download failed (${response.status})`);
  const total = Number(response.headers.get('content-length')) || 0; let done = 0;
  const stream = Readable.fromWeb(response.body); stream.on('data', b => { done += b.length; if (total) progress(done / total); });
  await pipeline(stream, fs.createWriteStream(`${target}.part`)); fs.renameSync(`${target}.part`, target);
}

async function installJava(root, major, progress) {
  const executable = path.join(root, 'runtime', process.platform === 'win32' ? 'bin/java.exe' : 'bin/java');
  if (fs.existsSync(executable)) return executable;
  const os = { win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform];
  const arch = { x64: 'x64', arm64: 'aarch64' }[process.arch] || process.arch;
  const releases = await json(`https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=${arch}&image_type=jre&os=${os}&vendor=eclipse`);
  const pkg = releases[0]?.binary?.package; if (!pkg) throw new Error('No compatible Java runtime was found');
  const archive = path.join(root, `java.${pkg.name.endsWith('.zip') ? 'zip' : 'tar.gz'}`);
  await download(pkg.link, archive, p => progress(.05 + p * .25));
  const out = path.join(root, 'runtime-tmp'); fs.mkdirSync(out, { recursive: true });
  if (archive.endsWith('.zip')) await exec(process.platform === 'win32' ? 'powershell' : 'unzip', process.platform === 'win32' ? ['-NoProfile','-Command',`Expand-Archive -Force '${archive}' '${out}'`] : ['-q', archive, '-d', out]);
  else await exec('tar', ['-xzf', archive, '-C', out]);
  const folder = fs.readdirSync(out).map(x => path.join(out, x)).find(x => fs.statSync(x).isDirectory()); fs.renameSync(folder, path.join(root, 'runtime')); fs.rmSync(out, { recursive: true }); fs.rmSync(archive);
  return executable;
}

async function installLoader(root, instance, java, progress) {
  if (instance.loader === 'Vanilla') return;
  progress(.6, `Installing ${instance.loader}`);
  if (instance.loader === 'Fabric') {
    const loaders = await json(`https://meta.fabricmc.net/v2/versions/loader/${instance.version}`);
    const loader = loaders.find(x => x.loader.stable) || loaders[0];
    if (!loader) throw new Error(`Fabric does not support Minecraft ${instance.version}`);
    const profile = await json(`https://meta.fabricmc.net/v2/versions/loader/${instance.version}/${loader.loader.version}/profile/json`);
    const id = profile.id; fs.mkdirSync(path.join(root, 'versions', id), { recursive: true });
    fs.writeFileSync(path.join(root, 'versions', id, `${id}.json`), JSON.stringify(profile, null, 2));
    return;
  }
  let installerUrl;
  if (instance.loader === 'Forge') {
    const promotions = await json('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
    const forge = promotions.promos[`${instance.version}-recommended`] || promotions.promos[`${instance.version}-latest`];
    if (!forge) throw new Error(`Forge does not support Minecraft ${instance.version}`);
    installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${instance.version}-${forge}/forge-${instance.version}-${forge}-installer.jar`;
  } else {
    const releases = await json('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
    const parts = instance.version.split('.'); const prefix = `${parts[1]}.${parts[2] || '0'}.`;
    const neo = [...(releases.versions || [])].reverse().find(v => v.startsWith(prefix));
    if (!neo) throw new Error(`NeoForge does not support Minecraft ${instance.version}`);
    installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neo}/neoforge-${neo}-installer.jar`;
  }
  const installer = path.join(root, `${instance.loader.toLowerCase()}-installer.jar`);
  await download(installerUrl, installer, p => progress(.6 + p * .05, `Downloading ${instance.loader}`));
  await exec(java, ['-jar', installer, '--installClient', root], { maxBuffer: 8 * 1024 * 1024 });
  fs.rmSync(installer);
}

async function installInstance(base, instance, notify) {
  const root = path.join(base, 'instances', instance.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_'));
  const progress = (value, message) => notify({ id: instance.id, value, message, status: 'installing' });
  fs.mkdirSync(root, { recursive: true }); progress(.02, 'Finding a Java runtime');
  const java = await installJava(root, Number(instance.java), progress);
  progress(.32, 'Reading Minecraft manifest');
  const manifest = await json('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  const version = manifest.versions.find(v => v.id === instance.version); if (!version) throw new Error('Minecraft version is unavailable');
  const metadata = await json(version.url); fs.mkdirSync(path.join(root, 'versions', instance.version), { recursive: true });
  fs.writeFileSync(path.join(root, 'versions', instance.version, `${instance.version}.json`), JSON.stringify(metadata, null, 2));
  await download(metadata.downloads.client.url, path.join(root, 'versions', instance.version, `${instance.version}.jar`), p => progress(.35 + p * .25, 'Downloading Minecraft'));
  await installLoader(root, instance, java, progress);
  const libraries = metadata.libraries.filter(l => l.downloads?.artifact);
  for (let i=0;i<libraries.length;i++) { const l=libraries[i].downloads.artifact; await download(l.url, path.join(root,'libraries',l.path), () => {}); progress(.6 + .22*(i/libraries.length), 'Downloading libraries'); }
  const assetIndex = await json(metadata.assetIndex.url); fs.mkdirSync(path.join(root,'assets','indexes'),{recursive:true}); fs.writeFileSync(path.join(root,'assets','indexes',`${metadata.assetIndex.id}.json`),JSON.stringify(assetIndex));
  const assets=Object.values(assetIndex.objects); for(let i=0;i<assets.length;i++){const a=assets[i];await download(`https://resources.download.minecraft.net/${a.hash.slice(0,2)}/${a.hash}`,path.join(root,'assets','objects',a.hash.slice(0,2),a.hash),()=>{});if(i%50===0)progress(.82+.17*(i/assets.length),'Downloading game assets');}
  fs.writeFileSync(path.join(root,'packsmith-instance.json'),JSON.stringify({...instance,javaExecutable:java,installedAt:Date.now()},null,2)); progress(1,'Ready');
  return { root, javaExecutable: java };
}

async function completeMicrosoftAuth(device, clientId) {
  const tokenUrl='https://login.microsoftonline.com/consumers/oauth2/v2.0/token'; const started=Date.now();
  let ms;
  while(Date.now()-started < device.expires_in*1000){ await new Promise(r=>setTimeout(r,(device.interval||5)*1000)); const body=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:device_code',client_id:clientId,device_code:device.device_code}); const response=await fetch(tokenUrl,{method:'POST',body}); const value=await response.json(); if(response.ok){ms=value;break;} if(!['authorization_pending','slow_down'].includes(value.error)) throw new Error(value.error_description||value.error); }
  if(!ms) throw new Error('Microsoft sign-in expired');
  return completeMinecraftAuth(ms);
}

async function completeMinecraftAuth(ms) {
  const xbl=await json('https://user.auth.xboxlive.com/user/authenticate',{method:'POST',headers:{'content-type':'application/json','x-xbl-contract-version':'1'},body:JSON.stringify({Properties:{AuthMethod:'RPS',SiteName:'user.auth.xboxlive.com',RpsTicket:`d=${ms.access_token}`},RelyingParty:'http://auth.xboxlive.com',TokenType:'JWT'})});
  const xsts=await json('https://xsts.auth.xboxlive.com/xsts/authorize',{method:'POST',headers:{'content-type':'application/json','x-xbl-contract-version':'1'},body:JSON.stringify({Properties:{SandboxId:'RETAIL',UserTokens:[xbl.Token]},RelyingParty:'rp://api.minecraftservices.com/',TokenType:'JWT'})});
  const uhs=xsts.DisplayClaims.xui[0].uhs; const mc=await json('https://api.minecraftservices.com/authentication/login_with_xbox',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identityToken:`XBL3.0 x=${uhs};${xsts.Token}`})});
  const profile=await json('https://api.minecraftservices.com/minecraft/profile',{headers:{authorization:`Bearer ${mc.access_token}`}});
  return { account:{id:profile.id,name:profile.name,type:'Microsoft',avatar:`https://mc-heads.net/avatar/${profile.id}/64`}, credentials:{...ms,minecraft:mc,obtainedAt:Date.now()} };
}

module.exports={versionCatalog,discover,installInstance,completeMicrosoftAuth,completeMinecraftAuth};
