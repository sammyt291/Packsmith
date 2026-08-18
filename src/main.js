const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('node:path');
const crypto = require('node:crypto');
const { JsonStore } = require('./store');

let store;
const MICROSOFT_CLIENT_ID = process.env.PACKSMITH_MS_CLIENT_ID;

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1050,
    minHeight: 680,
    backgroundColor: '#0d0f0e',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
  if (process.env.PACKSMITH_SCREENSHOT) {
    window.webContents.once('did-finish-load', async () => {
      await new Promise(resolve => setTimeout(resolve, 800));
      const image = await window.webContents.capturePage();
      require('node:fs').writeFileSync(process.env.PACKSMITH_SCREENSHOT, image.toPNG());
      app.quit();
    });
  }
}

async function microsoftDeviceLogin() {
  if (!MICROSOFT_CLIENT_ID) {
    return { demo: true, userCode: 'PACK-SMITH', verificationUri: 'https://microsoft.com/devicelogin', expiresIn: 900 };
  }
  const body = new URLSearchParams({ client_id: MICROSOFT_CLIENT_ID, scope: 'XboxLive.signin offline_access' });
  const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode', { method: 'POST', body });
  if (!response.ok) throw new Error('Microsoft sign-in could not be started.');
  return response.json();
}

function registerIpc() {
  ipcMain.handle('state:get', () => store.data);
  ipcMain.handle('state:save', (_event, state) => store.save(state));
  ipcMain.handle('auth:start', microsoftDeviceLogin);
  ipcMain.handle('auth:complete-demo', (_event, label) => {
    const account = { id: crypto.randomUUID(), name: label || 'Steve Builder', type: 'Microsoft', avatar: null };
    store.save({ ...store.data, accounts: [...store.data.accounts, account], selectedAccountId: account.id });
    return account;
  });
  ipcMain.handle('external:open', (_event, url) => shell.openExternal(url));
  ipcMain.handle('clipboard:write', (_event, value) => clipboard.writeText(value));
  ipcMain.handle('share:create', (_event, instanceId) => {
    const instance = store.data.instances.find(item => item.id === instanceId);
    if (!instance) throw new Error('Instance not found');
    instance.shareCode ||= `PS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    store.save(store.data);
    return instance.shareCode;
  });
}

app.whenReady().then(() => {
  store = new JsonStore(path.join(app.getPath('userData'), 'packsmith.json'));
  registerIpc();
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length || createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
