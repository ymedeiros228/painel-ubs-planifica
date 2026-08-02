const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('painelApp', {
  isDesktop: true,
  version: '2.0.0'
});
