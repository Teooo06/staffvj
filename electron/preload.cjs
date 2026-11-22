const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('vj', {
  platform: process.platform,
  isElectron: true,
  appInfo: () => ipcRenderer.invoke('app:info'),
  askMediaAccess: (kind) => ipcRenderer.invoke('app:ask-media-access', kind),
  openMediaDialog: () => ipcRenderer.invoke('media:open-dialog'),
  openHtmlDialog: () => ipcRenderer.invoke('browser:open-html-dialog'),
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  loadProject: () => ipcRenderer.invoke('project:load'),
  listDisplays: () => ipcRenderer.invoke('output:list-displays'),
  openOutput: (displayId) => ipcRenderer.invoke('output:open', displayId),
  closeOutput: () => ipcRenderer.invoke('output:close'),
  reloadOutput: () => ipcRenderer.invoke('output:reload'),
  reloadControl: () => ipcRenderer.invoke('app:reload-control'),
  reloadBrowserSources: () => ipcRenderer.invoke('browser:reload-all'),
  setPerformanceSettings: (settings) => ipcRenderer.invoke('performance:set-settings', settings),
  isOutputOpen: () => ipcRenderer.invoke('output:is-open'),
  getSnapshot: () => ipcRenderer.invoke('output:get-snapshot'),
  listNdiSources: () => ipcRenderer.invoke('ndi:list-sources'),
  refreshNdiSources: () => ipcRenderer.invoke('ndi:refresh-sources'),
  getNdiStatus: () => ipcRenderer.invoke('ndi:get-status'),
  setNdiOutput: (enabled, name) => ipcRenderer.invoke('ndi:set-output', { enabled, name }),
  sendNdiOutputFrame: (bytes, width, height) => ipcRenderer.send('ndi:output-frame', { bytes, width, height }),
  sendState: (state) => ipcRenderer.send('output:state', state),
  sendTransport: (transport) => ipcRenderer.send('output:transport', transport),
  rendererReady: () => ipcRenderer.send('app:renderer-ready'),
  quit: () => ipcRenderer.send('app:quit'),
  onState: (callback) => subscribe('output:state', callback),
  onTransport: (callback) => subscribe('output:transport', callback),
  onSnapshot: (callback) => subscribe('output:snapshot', callback),
  onPerformanceSettings: (callback) => subscribe('performance:settings', callback),
  onOutputClosed: (callback) => subscribe('output:closed', callback),
  onDisplaysChanged: (callback) => subscribe('output:displays-changed', callback),
  onBrowserFrame: (callback) => subscribe('browser:frame', callback),
  onBrowserRemove: (callback) => subscribe('browser:remove', callback),
  onNdiSources: (callback) => subscribe('ndi:sources', callback),
  onNdiStatus: (callback) => subscribe('ndi:status', callback),
  onNdiFrame: (callback) => subscribe('ndi:frame', callback),
  onNdiRemove: (callback) => subscribe('ndi:remove', callback),
  onNdiSourceError: (callback) => subscribe('ndi:source-error', callback),
});
