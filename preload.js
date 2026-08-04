const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('painelApp', {
  isDesktop: true,
  version: '3.1.0',
  backup: {
    getInfo: () => ipcRenderer.invoke('backup:getInfo'),
    load: () => ipcRenderer.invoke('backup:load'),
    probe: () => ipcRenderer.invoke('backup:probe'),
    loadFromPath: (filePath) => ipcRenderer.invoke('backup:loadFromPath', filePath),
    save: (snapshot) => ipcRenderer.invoke('backup:save', snapshot),
    openFolder: () => ipcRenderer.invoke('backup:openFolder'),
    openDocuments: () => ipcRenderer.invoke('backup:openDocuments'),
    openDesktop: () => ipcRenderer.invoke('backup:openDesktop'),
    exportCopy: () => ipcRenderer.invoke('backup:exportCopy'),
    importFile: () => ipcRenderer.invoke('backup:importFile')
  }
});
