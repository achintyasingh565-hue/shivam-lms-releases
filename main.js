// Shivam Enterprises Office Suite — desktop app (Electron main process)
const { app, BrowserWindow, Menu, shell, dialog, ipcMain, systemPreferences } = require('electron');
const path = require('path');

// Ensure only one copy of the app runs at a time
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Shivam Enterprises LMS',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    show: false,                  // don't show until the first frame is painted (prevents white flash)
    backgroundColor: '#0b1220',   // matches the dark html background exactly (see theme-boot / first-paint style)
    autoHideMenuBar: true,        // hide the menu bar for a clean app look
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Remove the application menu entirely (no File/Edit/View browser-style menu)
  Menu.setApplicationMenu(null);

  mainWindow.loadFile('index.html');

  // Reveal the window only once the renderer has painted, so the user never sees a white flash.
  mainWindow.once('ready-to-show', () => { mainWindow.show(); });
  // Safety fallback: if ready-to-show is delayed for any reason, show after load finishes.
  mainWindow.webContents.once('did-finish-load', () => { if (!mainWindow.isVisible()) mainWindow.show(); });

  // Open any external links (if ever added) in the system browser, not in-app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// When the user saves a Backup/CSV, show a normal "Save As" dialog
app.on('session-created', (session) => {
  session.on('will-download', (event, item) => {
    // Electron shows a Save dialog by default when no save path is set.
    // Default the suggested name to the download's filename.
  });
});

// ---- Over-the-air auto-update (electron-updater) ----
// Checks the GitHub Releases feed configured in package.json (build.publish),
// downloads a new version in the background, and lets the user restart to apply.
// It is deliberately defensive:
//   * disabled entirely in development (no packaged app to replace);
//   * on macOS, updates ONLY work for a signed + notarised app — electron-updater
//     refuses unsigned updates. Until an Apple Developer ID is configured, macOS
//     users get a friendly "a new version is available" dialog with a download link
//     instead of a silent auto-update (so the feature never silently no-ops).
function setupAutoUpdates() {
  if (!app.isPackaged) return;                       // dev: nothing to update
  let autoUpdater, log;
  try { ({ autoUpdater } = require('electron-updater')); }
  catch (e) { console.error('electron-updater not installed:', e && e.message); return; }

  // Ask before downloading, so the user ALWAYS sees a "new update available" pop-up
  // (on both Windows and Mac) instead of a silent background update.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const notify = (msg) => { try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', msg); } catch (_) {} };

  const RELEASES_URL = 'https://github.com/achintyasingh565-hue/shivam-lms-releases/releases/latest';
  // Silent auto-install on macOS requires an Apple-signed build; until then, Mac
  // shows the same pop-up but sends the user to the download page.
  const isMacUnsigned = process.platform === 'darwin' && !(process.mas) &&
    !process.env.CSC_LINK && !process.env.APPLE_TEAM_ID;

  autoUpdater.on('checking-for-update', () => notify({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => notify({ state: 'current' }));
  autoUpdater.on('download-progress', (p) => notify({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('error', (err) => notify({ state: 'error', message: String(err && err.message || err) }));

  // A newer version exists on GitHub -> pop up on BOTH platforms.
  autoUpdater.on('update-available', async (info) => {
    const v = (info && info.version) || '';
    notify({ state: 'available', version: v });
    if (isMacUnsigned) {
      const r = await dialog.showMessageBox(mainWindow, {
        type: 'info', buttons: ['Get update', 'Later'], defaultId: 0, cancelId: 1,
        title: 'Update available',
        message: 'A new version (' + v + ') of Shivam Enterprises LMS is available.',
        detail: 'Click "Get update" to open the download page, then drag the new app into Applications (replacing the old one). Your data is safe and will not be affected.'
      });
      if (r.response === 0) shell.openExternal(RELEASES_URL);
      return;
    }
    const r = await dialog.showMessageBox(mainWindow, {
      type: 'info', buttons: ['Download & install', 'Later'], defaultId: 0, cancelId: 1,
      title: 'Update available',
      message: 'A new version (' + v + ') of Shivam Enterprises LMS is available.',
      detail: 'Click "Download & install" — it downloads in the background and then asks you to restart. Your data is safe and will not be affected.'
    });
    if (r.response === 0) { try { autoUpdater.downloadUpdate(); } catch (e) {} }
  });

  autoUpdater.on('update-downloaded', async (info) => {
    notify({ state: 'ready', version: info && info.version });
    const r = await dialog.showMessageBox(mainWindow, {
      type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1,
      title: 'Update ready',
      message: 'The update (' + (info && info.version) + ') has been downloaded.',
      detail: 'Restart the app to finish installing it. Your data is safe and will not be affected.'
    });
    if (r.response === 0) { setImmediate(() => autoUpdater.quitAndInstall()); }
  });

  // Check now, and again every 6 hours while the app stays open.
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

// ---- ACID-compliant storage (better-sqlite3, main process only) ----
// WAL journal + FULL synchronous = an interrupted write or power loss can never
// leave a half-written loan book: a transaction either fully commits or is rolled
// back on next open. The module is loaded defensively — if the native module is
// missing or fails to build, the app keeps running on its previous storage.
let db = null;
function initDb() {
  try {
    const Database = require('better-sqlite3');
    const fs = require('fs');
    const dir = app.getPath('userData');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    db = new Database(path.join(dir, 'lms.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = FULL');
    db.exec(
      'CREATE TABLE IF NOT EXISTS loans (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, taken_at TEXT NOT NULL, data TEXT NOT NULL);'
    );
    return true;
  } catch (e) {
    console.error('SQLite unavailable, falling back to renderer storage:', e && e.message);
    db = null;
    return false;
  }
}

app.whenReady().then(() => {
  initDb();
  ipcMain.handle('db-available', () => !!db);
  ipcMain.handle('db-load-loans', () => {
    try {
      if (!db) return { ok: false, error: 'no-db' };
      const rows = db.prepare('SELECT data FROM loans').all();
      const loans = [];
      for (const r of rows) { try { loans.push(JSON.parse(r.data)); } catch (_) {} }
      return { ok: true, loans };
    } catch (err) { return { ok: false, error: String(err) }; }
  });
  ipcMain.handle('db-save-loans', (e, arr) => {
    try {
      if (!db) return { ok: false, error: 'no-db' };
      if (!Array.isArray(arr)) return { ok: false, error: 'bad-payload' };
      const now = new Date().toISOString();
      const del = db.prepare('DELETE FROM loans');
      const ins = db.prepare('INSERT INTO loans (id, data, updated_at) VALUES (?, ?, ?)');
      const tx = db.transaction((rows) => {           // <-- all-or-nothing
        del.run();
        for (const l of rows) ins.run(String((l && l.id) || ('L' + now)), JSON.stringify(l), now);
      });
      tx(arr);
      // rolling daily snapshot inside the same DB (belt & braces for accidental deletes)
      try {
        const last = db.prepare('SELECT taken_at FROM snapshots ORDER BY id DESC LIMIT 1').get();
        if (!last || String(last.taken_at).slice(0, 10) !== now.slice(0, 10)) {
          db.prepare('INSERT INTO snapshots (taken_at, data) VALUES (?, ?)').run(now, JSON.stringify(arr));
          db.prepare("DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 30)").run();
        }
      } catch (_) {}
      return { ok: true, count: arr.length };
    } catch (err) { return { ok: false, error: String(err) }; }
  });
  ipcMain.handle('db-kv-get', (e, key) => {
    try { if (!db) return { ok: false }; const r = db.prepare('SELECT value FROM kv WHERE key=?').get(String(key)); return { ok: true, value: r ? r.value : null }; }
    catch (err) { return { ok: false, error: String(err) }; }
  });
  ipcMain.handle('db-kv-set', (e, p) => {
    try { if (!db) return { ok: false }; db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at').run(String(p.key), String(p.value), new Date().toISOString()); return { ok: true }; }
    catch (err) { return { ok: false, error: String(err) }; }
  });

  // Touch ID (macOS) for the app lock
  ipcMain.handle('can-touch-id', () => {
    try { return process.platform === 'darwin' && systemPreferences.canPromptTouchID(); }
    catch (e) { return false; }
  });
  ipcMain.handle('touch-id', async () => {
    try { await systemPreferences.promptTouchID('unlock Shivam Enterprises LMS'); return true; }
    catch (e) { return false; }
  });
  // Automatic backup to a user-chosen folder
  ipcMain.handle('choose-backup-folder', async () => {
    try { const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], title: 'Choose a folder for automatic backups' });
      return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0]; }
    catch (e) { return null; }
  });
  ipcMain.handle('write-backup', async (e, payload) => {
    try { const fs = require('fs'); const path = require('path');
      fs.writeFileSync(path.join(payload.folder, payload.name), payload.content, 'utf8'); return true; }
    catch (err) { return false; }
  });

// ---- OS-encrypted secret storage (Keychain-backed via Electron safeStorage) ----
ipcMain.handle('secure-encrypt', (e, txt) => {
  try { const { safeStorage } = require('electron');
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.encryptString(String(txt)).toString('base64');
  } catch (err) { return null; }
});
ipcMain.handle('secure-decrypt', (e, b64) => {
  try { const { safeStorage } = require('electron');
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(Buffer.from(String(b64), 'base64'));
  } catch (err) { return null; }
});
ipcMain.handle('save-pdf', async (e, payload) => {
  let win = null;
  try {
    const fs = require('fs'); const os = require('os'); const p = require('path');
    const tmp = p.join(os.tmpdir(), 'se_doc_' + Date.now() + '.html');
    fs.writeFileSync(tmp, (payload && payload.html) || '<html><body></body></html>', 'utf8');
    win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    await win.loadFile(tmp);
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
    try { fs.unlinkSync(tmp); } catch (e2) {}
    const r = await dialog.showSaveDialog(mainWindow, {
      title: 'Save PDF',
      defaultPath: (payload && payload.name) || 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (r.canceled || !r.filePath) { win.destroy(); return { ok: false, canceled: true }; }
    fs.writeFileSync(r.filePath, pdf);
    win.destroy();
    return { ok: true, path: r.filePath };
  } catch (err) { if (win) { try { win.destroy(); } catch (e3) {} } return { ok: false, error: String(err) }; }
});
  // ---- WhatsApp Cloud API (runs from the desktop process, not the browser) ----
  function _waRequest(options, bodyObj) {
    return new Promise((resolve) => {
      const https = require('https');
      const data = bodyObj ? JSON.stringify(bodyObj) : null;
      const req = https.request(options, (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c; });
        res.on('end', () => {
          let json = {};
          try { json = JSON.parse(buf || '{}'); } catch (e) { json = { raw: buf }; }
          resolve({ status: res.statusCode, json: json });
        });
      });
      req.on('error', (e) => resolve({ status: 0, json: { error: { message: String(e) } } }));
      req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, json: { error: { message: 'Request timed out' } } }); });
      if (data) req.write(data);
      req.end();
    });
  }
  // Meta deprecates Graph API versions periodically. Resolve the version in this order:
  //   1) whatever the app sends with the request (set in Administration -> WhatsApp Settings)
  //   2) config.json next to the app  { "waApiVersion": "v23.0" }
  //   3) built-in default
  const WA_API_DEFAULT = 'v22.0';
  function waApiVersion(p) {
    const clean = (v) => {
      v = String(v || '').trim();
      return /^v\d+\.\d+$/.test(v) ? v : null;
    };
    const fromCall = clean(p && p.apiVersion);
    if (fromCall) return fromCall;
    try {
      const fs2 = require('fs'), path2 = require('path');
      for (const dir of [app.getPath('userData'), __dirname]) {
        const f = path2.join(dir, 'config.json');
        if (fs2.existsSync(f)) {
          const c = JSON.parse(fs2.readFileSync(f, 'utf8'));
          const v = clean(c && c.waApiVersion);
          if (v) return v;
        }
      }
    } catch (_) {}
    return WA_API_DEFAULT;
  }

  // ---- WhatsApp token lives ONLY in the main process ----
  // Encrypted with the OS keychain (safeStorage) and written to userData.
  // The renderer can save it and ask whether one exists, but can never read it back.
  const _tokFile = () => require('path').join(app.getPath('userData'), 'wa_token.enc');
  function _tokSave(plain) {
    try {
      const { safeStorage } = require('electron');
      const fs2 = require('fs');
      if (!plain) { try { fs2.unlinkSync(_tokFile()); } catch (_) {} return true; }
      if (!safeStorage.isEncryptionAvailable()) return false;
      fs2.writeFileSync(_tokFile(), safeStorage.encryptString(String(plain)));
      return true;
    } catch (_) { return false; }
  }
  function _tokLoad() {
    try {
      const { safeStorage } = require('electron');
      const fs2 = require('fs');
      if (!fs2.existsSync(_tokFile())) return null;
      return safeStorage.decryptString(fs2.readFileSync(_tokFile()));
    } catch (_) { return null; }
  }
  ipcMain.handle('wa-token-save',   async (e, plain) => ({ ok: _tokSave(plain) }));
  ipcMain.handle('wa-token-exists', async () => ({ exists: !!_tokLoad() }));
  ipcMain.handle('wa-token-clear',  async () => ({ ok: _tokSave(null) }));

  ipcMain.handle('wa-send', async (e, p) => {
    try {
      const apiPath = '/' + waApiVersion(p) + '/' + encodeURIComponent(p.phoneNumberId) + '/messages';
      let body;
      if (p.template) {
        body = { messaging_product: 'whatsapp', to: p.to, type: 'template',
          template: { name: p.template.name, language: { code: p.template.lang || 'en' }, components: p.template.components || [] } };
      } else {
        body = { messaging_product: 'whatsapp', to: p.to, type: 'text', text: { body: p.text || '' } };
      }
      const r = await _waRequest({ hostname: 'graph.facebook.com', path: apiPath, method: 'POST',
        headers: { 'Authorization': 'Bearer ' + (_tokLoad() || p.token || ''), 'Content-Type': 'application/json' } }, body);
      if (r.status >= 200 && r.status < 300 && r.json && r.json.messages && r.json.messages[0]) {
        return { ok: true, id: r.json.messages[0].id };
      }
      return { ok: false, error: (r.json && r.json.error && r.json.error.message) || ('HTTP ' + r.status) };
    } catch (err) { return { ok: false, error: String(err) }; }
  });
  ipcMain.handle('wa-test', async (e, p) => {
    try {
      const apiPath = '/' + waApiVersion(p) + '/' + encodeURIComponent(p.phoneNumberId) + '?fields=verified_name,display_phone_number,quality_rating';
      const r = await _waRequest({ hostname: 'graph.facebook.com', path: apiPath, method: 'GET',
        headers: { 'Authorization': 'Bearer ' + (_tokLoad() || p.token || '') } }, null);
      if (r.status >= 200 && r.status < 300 && r.json && (r.json.verified_name || r.json.display_phone_number || r.json.id)) {
        return { ok: true, name: r.json.verified_name || '', number: r.json.display_phone_number || '' };
      }
      return { ok: false, error: (r.json && r.json.error && r.json.error.message) || ('HTTP ' + r.status) };
    } catch (err) { return { ok: false, error: String(err) }; }
  });
  createWindow();
  try { setupAutoUpdates(); } catch (e) { console.error('auto-update setup failed:', e && e.message); }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
