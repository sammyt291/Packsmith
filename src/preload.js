const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('packsmith', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: state => ipcRenderer.invoke('state:save', state),
  startMicrosoftLogin: () => ipcRenderer.invoke('auth:start'),
  onAuthResult: callback => ipcRenderer.on('auth:result', (_event, value) => callback(value)),
  getVersions: () => ipcRenderer.invoke('catalog:versions'),
  getDiscover: () => ipcRenderer.invoke('catalog:discover'),
  installInstance: instance => ipcRenderer.invoke('instance:install', instance),
  onInstanceProgress: callback => ipcRenderer.on('instance:progress', (_event, value) => callback(value)),
  openExternal: url => ipcRenderer.invoke('external:open', url),
  copy: value => ipcRenderer.invoke('clipboard:write', value),
  createShareCode: id => ipcRenderer.invoke('share:create', id)
});
