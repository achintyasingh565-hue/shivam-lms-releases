// Markup integrity — the guard this codebase has been missing.
//
// The app is deliberately one global scope with ~200 inline on* handlers and
// ~100 element ids looked up by name (see the note at the top of build.js).
// That means a markup edit can break a button with no error at build time and
// no test failure — the button simply stops doing anything, and you find out
// when you click it. The 49 browser tests would catch it, but they need a
// browser.
//
// This runs against the BUILT index.html and app.bundle.js and asserts the two
// invariants that architecture depends on:
//   1. every inline handler resolves to something defined in the bundle;
//   2. every element id the app code reads still exists in the markup.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'app.bundle.js'), 'utf8');

let fails = 0;
function chk(label, ok, detail) {
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (ok || !detail ? '' : '\n        ' + detail));
}

// --- 1. every inline handler resolves -------------------------------------
const handlers = [...new Set([...html.matchAll(/on(?:click|change|input|blur|focus|submit|keyup|keydown)="([a-zA-Z_][\w$]*)\s*\(/g)].map(m => m[1]))];
const KEYWORDS = new Set(['if','for','while','switch','try','return','typeof','void','do','with','function']);
const undefinedHandlers = handlers.filter(h => !KEYWORDS.has(h)).filter(h =>
  !bundle.includes('window.' + h + '=') &&
  !bundle.includes('window.' + h + ' =') &&
  !new RegExp('function\\s+' + h + '\\s*\\(').test(bundle));
chk(`every inline handler resolves (${handlers.length} distinct)`,
  undefinedHandlers.length === 0, 'undefined: ' + undefinedHandlers.join(', '));

// --- 2. every id the code reads exists in the markup ----------------------
const appDir = path.join(root, 'src', 'app');
let srcAll = '';
for (const f of fs.readdirSync(appDir)) srcAll += fs.readFileSync(path.join(appDir, f), 'utf8');
const read = new Set();
for (const m of srcAll.matchAll(/(?:\$|_\$)\('([a-zA-Z][\w-]*)'\)/g)) read.add(m[1]);
for (const m of srcAll.matchAll(/getElementById\('([a-zA-Z][\w-]*)'\)/g)) read.add(m[1]);

// ids created at runtime (rendered into innerHTML) legitimately aren't in the
// static markup — only check ids the markup is supposed to own.
const inHtml = new Set([...html.matchAll(/id="([a-zA-Z][\w-]*)"/g)].map(m => m[1]));
const runtime = new Set([...srcAll.matchAll(/id="([a-zA-Z][\w-]*)"/g)].map(m => m[1]));
// overlays and panels built in JS assign their id directly
for (const m of srcAll.matchAll(/\.id\s*=\s*'([a-zA-Z][\w-]*)'/g)) runtime.add(m[1]);
for (const m of srcAll.matchAll(/\.id\s*=\s*"([a-zA-Z][\w-]*)"/g)) runtime.add(m[1]);
// Six ids are read by code but exist in no markup. They pre-date this test and
// are NOT caused by any recent change, so they are listed here rather than
// failing the build — but three of them are unguarded and would throw if the
// feature were reached, so they are printed every run until they are dealt with.
//   guarded (harmless no-ops): chartRisk, defDays, defType
//   UNGUARDED (would throw):   covLoad, secOff, offPass
const KNOWN_DANGLING = new Set(['chartRisk', 'covLoad', 'defDays', 'defType', 'offPass', 'secOff']);
const missing = [...read].filter(id => !inHtml.has(id) && !runtime.has(id)).sort();
const newlyMissing = missing.filter(id => !KNOWN_DANGLING.has(id));
chk(`no NEW dangling element ids (${read.size} read by code)`,
  newlyMissing.length === 0, 'newly missing: ' + newlyMissing.join(', '));
if (missing.length) {
  console.log('      note: ' + missing.length + ' pre-existing dangling id(s): ' + missing.join(', '));
  console.log('            covLoad / secOff / offPass are read WITHOUT a null check.');
}

// --- 3. the Payments screen specifically ----------------------------------
const payIds = ['payb_loan','payb_amt','payb_date','payb_mode','payb_status','payb_intonly','payb_rapid',
                'chg_loan','chg_type','chg_amt','chg_date','chg_note',
                'lateFeeRate','ovdIntRate','lateGraceDays','ovdFromDate','chgScope',
                'bulk_loan','bulk_from','bulk_to','bulk_amt'];
const payMissing = payIds.filter(id => !inHtml.has(id));
chk('every Payments-screen field is present', payMissing.length === 0, 'missing: ' + payMissing.join(', '));

// --- 4. no duplicate ids (two elements, one id = silent wrong-element bugs)
const allIds = [...html.matchAll(/id="([a-zA-Z][\w-]*)"/g)].map(m => m[1]);
const dupes = [...new Set(allIds.filter((id, i) => allIds.indexOf(id) !== i))];
chk('no duplicate element ids', dupes.length === 0, 'duplicated: ' + dupes.join(', '));

// --- 5. the build actually substituted everything -------------------------
chk('no unresolved build markers in index.html',
  !html.includes('<!--#include') && !html.includes('<!--#appbundle-->') && !html.includes('__APP_VERSION__'));

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL MARKUP-INTEGRITY CHECKS PASS');
process.exitCode = fails ? 1 : 0;
