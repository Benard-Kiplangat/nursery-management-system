const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  allDocs: (options = {}) => ipcRenderer.invoke('bosco:db:allDocs', options),
  get: (id, options = {}) => ipcRenderer.invoke('bosco:db:get', id, options),
  put: (doc) => ipcRenderer.invoke('bosco:db:put', doc),
  remove: (doc) => ipcRenderer.invoke('bosco:db:remove', doc),
  destroy: () => ipcRenderer.invoke('bosco:db:destroy'),
  resetDb: () => ipcRenderer.invoke('bosco:db:resetDb'),
  hardRefresh: () => ipcRenderer.invoke('bosco:app:hardRefresh'),
  createBackup: () => ipcRenderer.invoke("bosco:backup:create"),
  restoreBackup: () => ipcRenderer.invoke("bosco:backup:restore"),
});
