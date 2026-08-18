const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { SqliteStore } = require('./store');
const { versionCatalog, discover, installInstance, completeMinecraftAuth } = require('./services');

let store; let mainWindow; const authSessions = new Map(); const installing = new Set();
const DEFAULT_CLIENT_ID = '60cbe4bd-6824-4be1-9685-7fd5c33fff61';
const CLIENT_ID = process.env.PACKSMITH_MS_CLIENT_ID || DEFAULT_CLIENT_ID;
const AUTH_SERVER = (process.env.PACKSMITH_AUTH_SERVER || 'https://auth.pack-smith.com').replace(/\/$/,'');
function dataRoot() { return process.platform === 'win32' ? path.join(process.env.PROGRAMDATA || app.getPath('appData'), 'Packsmith') : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'Packsmith'); }
function send(channel, value) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, value); }

function createWindow() {
  mainWindow = new BrowserWindow({ width:1440,height:900,minWidth:1050,minHeight:680,backgroundColor:'#0d0f0e',titleBarStyle:'hiddenInset',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false} });
  mainWindow.loadFile(path.join(__dirname,'index.html'));
  if(process.env.PACKSMITH_SCREENSHOT) mainWindow.webContents.once('did-finish-load',async()=>{await new Promise(r=>setTimeout(r,1200));require('node:fs').writeFileSync(process.env.PACKSMITH_SCREENSHOT,(await mainWindow.webContents.capturePage()).toPNG());app.quit();});
}

async function startLogin() {
  const response=await fetch(`${AUTH_SERVER}/v1/auth/microsoft/start`); const auth=await response.json();
  if(!response.ok)throw new Error(auth.error||'Microsoft sign-in could not be started.'); authSessions.set(auth.sessionId,auth);
  (async()=>{let ms;while(authSessions.has(auth.sessionId)){await new Promise(r=>setTimeout(r,2000));const result=await fetch(`${AUTH_SERVER}/v1/auth/microsoft/result?session=${encodeURIComponent(auth.sessionId)}`);if(result.status===202)continue;const value=await result.json();if(!result.ok)throw new Error(value.error||'Microsoft sign-in failed.');ms=value.credentials;break;}if(!ms)return;const {account,credentials}=await completeMinecraftAuth(ms);store.setCredentials(account.id,credentials);store.save({...store.data,accounts:[...store.data.accounts.filter(a=>a.id!==account.id),account],selectedAccountId:account.id});send('auth:result',{sessionId:auth.sessionId,account});authSessions.delete(auth.sessionId);})().catch(error=>{send('auth:result',{sessionId:auth.sessionId,error:error.message});authSessions.delete(auth.sessionId);});
  return auth;
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
