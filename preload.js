const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('painelApp', {
  isDesktop: true,
  version: '3.0.1'
});
