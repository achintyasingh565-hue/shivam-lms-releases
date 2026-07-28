// Main-process safety net (no Electron needed):
//  1. main.js + preload.js parse (syntax valid).
//  2. every IPC channel preload invokes has a handler in main.js, and every
//     channel preload listens on is actually sent by main.js. A mismatch here
//     silently breaks a feature (Touch ID, WhatsApp send, backup, PDF, updates).
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const mainSrc = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');

function all(re, s) { const out = []; let m; while ((m = re.exec(s))) out.push(m[1]); return out; }

let bad = 0;
const fail = (m) => { console.log('  FAIL  ' + m); bad++; };
const pass = (m) => console.log('  PASS  ' + m);

console.log('\n===== MAIN / PRELOAD CONTRACT =====');

// 1. syntax
for (const f of ['main.js', 'preload.js']) {
  try { cp.execSync('node --check "' + path.join(root, f) + '"', { stdio: 'pipe' }); pass(f + ' parses'); }
  catch (e) { fail(f + ' has a syntax error: ' + String(e.stderr || e)); }
}

// 2. invoke -> handle coverage
const handlers = new Set(all(/ipcMain\.handle\(\s*['"]([^'"]+)['"]/g, mainSrc));
const invokes = [...new Set(all(/ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g, preloadSrc))];
const missing = invokes.filter((c) => !handlers.has(c));
if (missing.length) fail('preload invokes channels with NO handler in main.js: ' + missing.join(', '));
else pass('all ' + invokes.length + ' invoked channels have a handler');

// 3. listen -> send coverage
const listens = [...new Set(all(/ipcRenderer\.on\(\s*['"]([^'"]+)['"]/g, preloadSrc))];
const sends = new Set(all(/webContents\.send\(\s*['"]([^'"]+)['"]/g, mainSrc));
const noSend = listens.filter((c) => !sends.has(c));
if (noSend.length) fail('preload listens on channels main never sends: ' + noSend.join(', '));
else pass('all ' + listens.length + ' listened channel(s) are sent by main');

console.log('\n  ' + (bad === 0 ? '✅ MAIN/PRELOAD IPC CONTRACT IS CONSISTENT' : '❌ ' + bad + ' PROBLEM(S)') + '\n');
process.exit(bad === 0 ? 0 : 1);
