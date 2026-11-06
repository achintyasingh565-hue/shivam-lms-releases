/* Catch an identifier declared INSIDE one function and used from another.
   `no-undef` is off for src/app on purpose — the app is one shared global
   scope, so it would flag every cross-file call. But in the BUILT bundle every
   genuine global is a top-level declaration or a window.* assignment, so
   anything still unresolved is a real scope leak.

   This exists because one was shipped: _dispName was defined inside
   renderGreetings and called from renderReminders, which threw a
   ReferenceError and stopped the reminder list being built. Lint was clean,
   every test passed, and the bundle parsed. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const bundle = path.join(root, 'app.bundle.js');
if (!fs.existsSync(bundle)) { console.error('app.bundle.js not found — run npm run build first'); process.exit(2); }
const src = fs.readFileSync(bundle, 'utf8');

const cfg = path.join(root, 'tools', '.scope-eslint.js');
let out = '';
try {
  out = execFileSync('npx', ['eslint', '--no-config-lookup', '-c', cfg, '-f', 'json', bundle],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) { out = (e.stdout || '').toString(); }

let reports = [];
try { reports = JSON.parse(out); } catch (_) { console.error('could not read eslint output'); process.exit(2); }

const names = new Set();
(reports[0] ? reports[0].messages : []).forEach((m) => {
  const n = /'([^']+)' is not defined/.exec(m.message || '');
  if (n) names.add(n[1]);
});

/* A name assigned onto window is reachable at runtime however it was declared,
   so it is not a scope leak. Everything else is. */
/* Loaded from a CDN at runtime, so they are never declared in the bundle. */
const EXTERNAL = new Set(['PDFLib', 'html2canvas']);
const leaks = [...names].filter((n) => !EXTERNAL.has(n)).filter((n) => {
  const re = new RegExp('window\\.' + n.replace(/[$]/g, '\\$') + '\\s*=|window\\[[\'"]' + n + '[\'"]\\]\\s*=');
  return !re.test(src);
}).sort();

if (!leaks.length) { console.log('no scope leaks — every identifier resolves at runtime'); process.exit(0); }
console.log(leaks.length + ' POSSIBLE SCOPE LEAK(S) — declared in one function, used from another:');
leaks.forEach((n) => console.log('  ' + n));
process.exit(1);
