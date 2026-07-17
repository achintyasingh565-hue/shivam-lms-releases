// Exposes a minimal, safe API to the page for Touch ID (macOS)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  canTouchID: () => ipcRenderer.invoke('can-touch-id'),
  touchID: () => ipcRenderer.invoke('touch-id'),
  chooseBackupFolder: () => ipcRenderer.invoke('choose-backup-folder'),
  writeBackup: (payload) => ipcRenderer.invoke('write-backup', payload),
  sendWhatsApp: (payload) => ipcRenderer.invoke('wa-send', payload),
  waTest: (payload) => ipcRenderer.invoke('wa-test', payload),
  secureEncrypt: (txt) => ipcRenderer.invoke('secure-encrypt', txt),
  secureDecrypt: (b64) => ipcRenderer.invoke('secure-decrypt', b64),
  savePDF: (payload) => ipcRenderer.invoke('save-pdf', payload),
  waTokenSave: (plain) => ipcRenderer.invoke('wa-token-save', plain),
  waTokenExists: () => ipcRenderer.invoke('wa-token-exists'),
  waTokenClear: () => ipcRenderer.invoke('wa-token-clear'),
  // Auto-update status (main -> renderer), so the UI can show "downloading / ready" if desired
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_e, s) => { try { cb(s); } catch (_) {} })
});
