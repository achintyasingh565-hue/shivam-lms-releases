// renderReminders() and renderGreetings() must each build their list without
// throwing. A helper written inside renderGreetings was called from
// renderReminders, where it was not in scope; the ReferenceError stopped
// _remList being built at all. Lint was clean, 39 suites passed and the bundle
// parsed, so nothing caught it. These run both builders for real.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

const LOANS = [
  { id: 'L1', name: 'Dinesh Chandra Mishra', acno: 'SE-1', phone: '9415110269',
    principal: 120000, rate: 2, tenure: 12, emi: 12400, tpay: 148800, outstanding: 99200,
    arrears: 0, due: '2026-12-10', disb: '2026-01-01', status: 'Active', _st: 'Active',
    payments: [], charges: [] },
  { id: 'L2', name: 'Shalu', acno: 'SE-2', phone: '9415110260', principal: 250000, rate: 2,
    tenure: 24, emi: 14583, tpay: 350000, outstanding: 350000, arrears: 14583,
    due: '2026-10-10', disb: '2026-02-01', status: 'Overdue', _st: 'Overdue',
    payments: [], charges: [] },
];

/* Minimum DOM to drive the two builders. */
function run(view, lang, type, occasion) {
  const F = {};
  const mk = (id, v) => { F[id] = { value: v, textContent: '', innerHTML: '', dataset: {}, style: {} }; };
  mk('remFilter', 'all'); mk('remLang', lang); mk('remWrap', '');
  mk('grType', type || 'greeting'); mk('grLang', lang); mk('grOccasion', occasion == null ? 'Diwali' : occasion);
  mk('grDate', ''); mk('grWho', 'all'); mk('grWrap', '');

  const ctx = {
    console, Math, Number, String, Object, Array, JSON, Date, RegExp, isNaN,
    localStorage: { getItem: () => null, setItem: () => {} },
    $: (id) => F[id] || null,
    loans: LOANS.map((l) => Object.assign({}, l)),
    esc: (x) => String(x == null ? '' : x),
    inr: (n) => '₹' + (Math.round(Number(n) || 0)).toLocaleString('en-IN'),
    inrPlain: (n) => (Math.round(Number(n) || 0)).toLocaleString('en-IN'),
    fmtDate: (d) => (d ? String(d) : ''),
    todayISO: () => '2026-11-06',
    autoStatus: (l) => l.status,
    getLateFee: () => 500,
    _lateFeeFor: () => 500,
    recomputeAll: () => {},
    waSentBadge: () => '',
    toast: () => {},
    tenureText: (l) => ((l && l.interestOnly) ? 'Monthly' : ((l && l.tenure) ? l.tenure + ' months' : '—')),
    /* lives in 02-helpers-nav.js, stubbed here */
    addDaysISO: (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10); },
    repAddMonths: (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n);
      return d.toISOString().slice(0, 10); },
    emiDueDate: (l) => (l ? l.due : ''),
  };
  ctx.window = ctx;
  vm.createContext(ctx);

  /* The real module, minus the one call that needs a live document. */
  const src = R('src/app/11-reminders.js')
    .replace(/^\s*\(function\s*\(\s*\)\s*\{/, '')
    .replace(/\}\s*\)\s*\(\s*\)\s*;?\s*$/, '');
  vm.runInContext(src, ctx);

  if (view === 'reminders') { ctx.renderReminders ? ctx.renderReminders() : ctx.window.renderReminders(); return ctx.window._remList; }
  (ctx.renderGreetings || ctx.window.renderGreetings)();
  return ctx.window._grList;
}

console.log('--- the reminder list builds ---');
{
  let list = null, err = null;
  try { list = run('reminders', 'en'); } catch (e) { err = String(e && e.message || e); }
  chk('renderReminders() does not throw', err, null);
  chk('  it produces rows', Array.isArray(list) && list.length > 0, true);
  if (list && list.length) {
    chk('  each row carries a name for the template', list.every((r) => r.vars && r.vars.name), true);
    chk('  and a category', list.every((r) => !!r.cat), true);
    const row = list.find((r) => r.acno === 'SE-1');   // order is by due/overdue, not input order
    chk('  English uses the English name', row && row.vars.name, 'Dinesh Chandra Mishra');
  }
  let hi = null; err = null;
  try { hi = run('reminders', 'hi'); } catch (e) { err = String(e && e.message || e); }
  chk('renderReminders() does not throw in Hindi', err, null);
  if (hi && hi.length) {
    /* The template is Hindi; the NAME is always the one on the record, in
       English. Transliteration was tried and removed — it mangled real names. */
    const hrow = hi.find((r) => r.acno === 'SE-1');
    chk('  a Hindi message still carries the English name', hrow && hrow.vars.name, 'Dinesh Chandra Mishra');
  }
}

console.log('\n--- the greeting list builds ---');
{
  ['greeting', 'birthday', 'holiday', 'thanks', 'welcome', 'finalnotice', 'demandnotice',
   'bounce', 'closed', 'cleared', 'chequepresent', 'restructure', 'accwelcome', 'launch']
    .forEach((t) => {
      let list = null, err = null;
      try { list = run('greetings', 'en', t); } catch (e) { err = String(e && e.message || e); }
      chk('  ' + t.padEnd(14) + ' builds', err, null);
      if (list && list.length) {
        if (!list.every((r) => r.vars && typeof r.vars.name === 'string' && r.vars.name)) {
          chk('  ' + t + ' rows carry a name', false, true);
        }
      }
    });
  let err = null, list = null;
  try { list = run('greetings', 'hi', 'greeting'); } catch (e) { err = String(e && e.message || e); }
  chk('a Hindi greeting builds', err, null);
  if (list && list.length) {
    chk('  the occasion goes out exactly as typed', list[0].vars.occasion, 'Diwali');
    chk('  and the name as recorded', list[0].vars.name, 'Dinesh Chandra Mishra');
  }
}

console.log('\n--- the API template parameters are never empty ---');
{
  // buildTplComponents sends '' for a missing var and Meta rejects empty text
  const list = run('greetings', 'en', 'greeting', '');
  const blank = (list || []).filter((r) => Object.keys(r.vars || {}).some((k) => String(r.vars[k]) === ''));
  chk('a blank Occasion leaves an empty template variable', blank.length > 0, true);
  console.log('        (this is what Meta rejects — the app now warns before sending)');
}


// ---------------------------------------------------------------------------
console.log('\n--- a fault the owner SEES is a fault that gets RECORDED ---');
{
  const src = R('src/app/15-init-errors.js');
  const a = src.indexOf('/* ---------- global error safety net');
  const i = src.indexOf('(function(){', a);
  let d = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (d === 0) { j++; break; } } }
  const code = src.slice(i, j) + ')();';

  const store = {}; const toasts = []; const L = {};
  const c = { console, Date, String, Number, JSON, Math };
  c.toast = (m) => toasts.push(m);
  c.reportError = (w, m) => { const lg = JSON.parse(store.log || '[]'); lg.push({ where: w, msg: m }); store.log = JSON.stringify(lg); };
  c.window = { addEventListener: (t, fn) => { L[t] = fn; }, toast: c.toast, reportError: c.reportError };
  vm.createContext(c);
  vm.runInContext(code, c);

  L.error({ message: '_dispName is not defined', filename: 'file:///app/11-reminders.js',
            lineno: 176, error: { stack: 'at renderReminders' } });
  chk('the owner is told', toasts.length, 1);
  chk('  and it is written to the log', JSON.parse(store.log || '[]').length, 1);
  chk('  with the file and line', JSON.parse(store.log)[0].where, '11-reminders.js:176');
  chk('  and the real message', JSON.parse(store.log)[0].msg, '_dispName is not defined');
  chk('  the toast points at Diagnostics', /Diagnostics/.test(toasts[0]), true);

  // a rejected promise is recorded too
  const before = JSON.parse(store.log).length;
  L.unhandledrejection({ reason: { message: 'network unreachable', stack: 'x' } });
  chk('an unhandled rejection is recorded', JSON.parse(store.log).length, before + 1);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
