// Message templates and the variables they fill in.
//
// Two defects this pins down:
//
// 1. Saved templates were thrown away. saveTemplates() wrote the edited wording
//    to shivam_msg_v1 and showed "Templates saved", but loadTpl() reset to the
//    defaults on every start and nothing ever read that key back. Any wording
//    the office customised was silently lost at the next restart.
//
// 2. {fine} printed the configured default late-fee rate for every borrower,
//    whether or not a fee had been charged -- so an overdue message could
//    announce a fee nobody had levied, and read "a late fee of Rs 0 now
//    applies" when the rate was left at zero (as seen on a real reminder).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '11-reminders.js'), 'utf8');
function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}
// the DEFAULT_TPL literal and the MSG_STORE constant, verbatim
function constDecl(name) {
  const i = src.indexOf('const ' + name + '=');
  const j = src.indexOf('\n  let TPL', i);
  return src.slice(i, j > i ? j : src.indexOf('\n', i));
}

function makeApp(stored) {
  const store = {};
  if (stored !== undefined) store['shivam_msg_v1'] = JSON.stringify(stored);
  const ctx = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
    },
    inr: (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN'),
    fmtDate: (v) => { if (!v) return ''; const [y, m, d] = v.split('-'); return d + '-' + m + '-' + y.slice(2); },
    getLateFeeRate: () => 0,          // the rate this office actually has set
    JSON, Number, String, Array, Object, Math, isFinite, console,
  };
  vm.createContext(ctx);
  vm.runInContext([
    src.slice(src.indexOf('const MSG_STORE'), src.indexOf('  let TPL')),
    'let TPL={...DEFAULT_TPL};',
    extract('loadTpl'), extract('getLateFee'), extract('_lateFeeFor'), extract('applyVars'),
    'this.TPLref=()=>TPL;',
  ].join('\n'), ctx);
  return ctx;
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// --- 1. nothing saved yet -> the defaults
let app = makeApp(undefined);
app.loadTpl();
chk('with nothing saved, the default wording is used',
  /friendly reminder from Shivam Enterprises/.test(app.TPLref().reminder), true);

// --- 2. saved wording must survive a restart (the reported defect)
const custom = 'Namaste {name}, kindly pay {emi} for A/C {acno} by {due_date}. - Shivam Enterprises';
app = makeApp({ reminder: custom });
app.loadTpl();
chk('a customised template is loaded back', app.TPLref().reminder, custom);
chk('  templates that were not customised keep their default',
  /important reminder from Shivam Enterprises/.test(app.TPLref().overdue), true);

// --- 3. a saved set from an older version must not blank out newer templates
app = makeApp({ reminder: custom, overdue: '' });
app.loadTpl();
chk('a blank saved value falls back to the default',
  /important reminder/.test(app.TPLref().overdue), true);

// --- 4. junk in storage must not break startup
for (const junk of ['not json', 42, null, [], { reminder: 123 }]) {
  const a = makeApp(junk);
  let threw = null;
  try { a.loadTpl(); } catch (e) { threw = String(e.message || e); }
  chk('junk in storage (' + JSON.stringify(junk) + ') does not break startup', threw, null);
  chk('  and leaves usable wording', typeof a.TPLref().reminder, 'string');
}

// --- 5. the numeric late-fee setting round-trips
app = makeApp({ fine: 250 });
app.loadTpl();
chk('a numeric setting is restored as a number', app.TPLref().fine, 250);

// --- 6. {fine} must describe THIS loan, not the global rate
app = makeApp(undefined); app.loadTpl();
const charged = { name: 'A', acno: '1', emi: 7400, outstanding: 120000, due: '2026-10-09',
                  charges: [{ type: 'Late fee', amount: 500, date: '2026-10-15' },
                            { type: 'Cheque bounce', amount: 350, date: '2026-10-16' }] };
chk('{fine} reports the late fees actually levied',
  app.applyVars('{fine}', charged, {}), '₹500');
chk('  bounce charges are not counted as a late fee',
  app.applyVars('{fine}', charged, {}) === '₹850', false);

const clean = { name: 'B', acno: '2', emi: 7400, outstanding: 120000, due: '2026-10-09', charges: [] };
chk('with no fee levied it falls back to the configured rate',
  app.applyVars('{fine}', clean, {}), '₹0');

// --- 7. the default overdue message must not announce a fee of zero
const msg = app.applyVars(app.TPLref().overdue, clean, {});
chk('the overdue message no longer claims "a late fee of ₹0 now applies"',
  /late fee of ₹0/.test(msg), false);
chk('  and still states the outstanding', /₹1,20,000/.test(msg), true);
chk('  and the due date', /09-10-26/.test(msg), true);
chk('the Hindi overdue message is also clear of it',
  /₹0 विलंब शुल्क/.test(app.applyVars(app.TPLref().overdue_hi, clean, {})), false);

// --- 8. every placeholder in every default template must resolve
const vals = { name: 'A', acno: '16287', emi: 7400, outstanding: 120000, arrears: 4200,
               principal: 500000, rate: 2, due: '2026-10-09', charges: [] };
const extra = { occasion: 'Diwali', date: '10-11-26', cheque: '100231', bank: 'HDFC',
                amount: '₹7,400', tenure: '24', txn: 'UPI1', disbursed: '₹5,00,000' };
const unresolved = [];
Object.keys(app.TPLref()).forEach((k) => {
  const t = app.TPLref()[k];
  if (typeof t !== 'string') return;
  const out = app.applyVars(t, vals, extra);
  const left = out.match(/\{[a-z_]+\}/g);
  if (left) unresolved.push(k + ' -> ' + left.join(','));
});
chk('no default template leaves a {placeholder} unfilled', unresolved, []);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL MESSAGE-TEMPLATE CHECKS PASS');
process.exitCode = fails ? 1 : 0;
