const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('packsmith', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: state => ipcRenderer.invoke('state:save', state),
  startMicrosoftLogin: () => ipcRenderer.invoke('auth:start'),
  completeDemoLogin: label => ipcRenderer.invoke('auth:complete-demo', label),
  openExternal: url => ipcRenderer.invoke('external:open', url),
  copy: value => ipcRenderer.invoke('clipboard:write', value),
  createShareCode: id => ipcRenderer.invoke('share:create', id)
});
