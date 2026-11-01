// Three defects found in a second external review.
//
//   #2  The modal Repayment Schedule (and the Welcome Letter that shares its
//       builder) pooled EVERY payment, not just cleared ones. A pending or
//       bounced cheque therefore ticked instalments as paid — money that never
//       arrived, shown to the borrower as received.
//
//   #3  The revised schedule printed after a restructure stepped months with
//       new Date(y, m+1, d), which turns 31 Jan into 2 March and drags every
//       later row with it. The printed dates disagreed with the app's own.
//
//   #4  "Turn off app lock" removed two localStorage keys but left the
//       keychain-encrypted roster (shivam_users_enc) and the in-memory
//       _usersCache. The lock came straight back — this session because
//       loadUsers() returned the cache, and on reboot because the roster was
//       decrypted again.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
function extract(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// ---------------------------------------------------------------------------
console.log('--- #2 only cleared money marks an instalment paid ---');
{
  const src = R('src/app/17-restructure.js');
  const helpers = R('src/app/02-helpers-nav.js');
  const ctx = {
    todayISO: () => '2026-10-01',
    Math, Number, String, Array, Object, Date, JSON, console,
  };
  vm.createContext(ctx);
  vm.runInContext(['var SCHED_MAX_ROWS=600;',
                   extract(helpers, 'repPad'), extract(helpers, 'repAddMonths'),
                   extract(src, 'addMonths'), extract(src, 'fmt'), extract(src, 'build'),
                   'this.build = build;'].join('\n'), ctx);

  const base = {
    id: 'L1', name: 'T', acno: '1', principal: 120000, rate: 2, tenure: 12,
    tint: 28800, tpay: 148800, emi: 12400, disb: '2026-01-01', due: '2026-02-01',
    charges: [],
  };
  const cleared = () => ctx.build(Object.assign({}, base, {
    payments: [{ id: 'p1', date: '2026-02-01', amount: 12400, status: 'Cleared' }] }));
  const pending = () => ctx.build(Object.assign({}, base, {
    payments: [{ id: 'p1', date: '2026-02-01', amount: 12400, status: 'Pending' }] }));
  const bounced = () => ctx.build(Object.assign({}, base, {
    payments: [{ id: 'p1', date: '2026-02-01', amount: 12400, status: 'Bounced' }] }));

  chk('a cleared payment marks one instalment paid', cleared().paidCount, 1);
  chk('a PENDING cheque marks none', pending().paidCount, 0);
  chk('a BOUNCED cheque marks none', bounced().paidCount, 0);
  // row.bal is the SCHEDULED amortisation and is the same either way; the
  // money actually credited is what must differ
  chk('  cleared money is credited', cleared().paidSum, 12400);
  chk('  pending money is not', pending().paidSum, 0);
  chk('  bounced money is not', bounced().paidSum, 0);
  chk('the source filter requires Cleared',
    /status\s*===\s*'Cleared'/.test(src.slice(src.indexOf('var allPays='), src.indexOf('var allPays=') + 260)), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- #3 revised schedule respects month ends ---');
{
  const helpers = R('src/app/02-helpers-nav.js');
  const ctx = { Date, Number, String, Math };
  vm.createContext(ctx);
  vm.runInContext([extract(helpers, 'repPad'), extract(helpers, 'repAddMonths'),
                   'this.add = repAddMonths;'].join('\n'), ctx);

  // what the old stepping produced
  const old = []; let d = new Date('2026-01-31T00:00:00');
  for (let i = 1; i <= 4; i++) { d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
    old.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
  // the exact day depends on the month lengths it skids through; what matters
  // is that it left February entirely
  chk('the old stepping really did roll 31 Jan past February',
    old[0].slice(0, 7), '2026-03');

  const now = [1, 2, 3, 4].map((i) => ctx.add('2026-01-31', i));
  chk('each row is clamped to the month end', now, ['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  chk('  and a clamped month does not drag the rest', now[1], '2026-03-31');

  const doc = R('src/app/18-docgen.js');
  const fn = doc.slice(doc.indexOf('function printSchedule('), doc.indexOf('function printSchedule(') + 1600);
  chk('printSchedule uses repAddMonths', /repAddMonths\(startISO/.test(fn), true);
  chk('  and no longer steps a Date by hand', /getMonth\(\)\s*\+\s*1,\s*d\.getDate\(\)/.test(fn), false);
}

// ---------------------------------------------------------------------------
console.log('\n--- #4 turning the lock off actually turns it off ---');
{
  const src = R('src/app/13-security-lock.js');
  // doDisable and forgotReset must clear BOTH the encrypted roster and the cache
  const dis = src.slice(src.indexOf('async function doDisable()'), src.indexOf('async function doDisable()') + 900);
  chk('disable removes the plaintext roster', /removeItem\(USERS_STORE\)/.test(dis), true);
  chk('disable removes the ENCRYPTED roster', /removeItem\('shivam_users_enc'\)/.test(dis), true);
  chk('disable clears the in-memory cache', /_usersCache\s*=\s*\[\]/.test(dis), true);

  const fr = src.slice(src.indexOf('window.forgotReset='), src.indexOf('window.forgotReset=') + 1200);
  chk('reset removes the ENCRYPTED roster', /removeItem\('shivam_users_enc'\)/.test(fr), true);
  chk('reset clears the in-memory cache', /_usersCache\s*=\s*\[\]/.test(fr), true);

  // behavioural: with everything cleared, the app is no longer locked
  const ctx = {
    LOCK_STORE: 'shivam_lock_v1',
    _store: {},
    _usersCache: [{ user: 'admin', role: 'admin', hash: 'h' }],
    JSON, Object, Array, String, Number, Boolean, console,
  };
  ctx.localStorage = {
    getItem: (k) => (k in ctx._store ? ctx._store[k] : null),
    setItem: (k, v) => { ctx._store[k] = v; },
    removeItem: (k) => { delete ctx._store[k]; },
  };
  ctx.loadUsers = () => ctx._usersCache;
  vm.createContext(ctx);
  vm.runInContext([extract(src, 'lockCfg'), extract(src, 'isLocked')].join('\n'), ctx);
  ctx._store['shivam_lock_v1'] = JSON.stringify({ on: true });
  chk('locked while the roster is cached', ctx.isLocked(), true);
  ctx._usersCache = [];                       // what the fix now does
  delete ctx._store['shivam_lock_v1'];
  delete ctx._store['shivam_users_enc'];
  chk('unlocked once cache and stores are cleared', ctx.isLocked(), false);
}

// ---------------------------------------------------------------------------
console.log('\n--- #6 module prefixes are unique ---');
{
  const files = fs.readdirSync(path.join(root, 'src/app')).filter((f) => f.endsWith('.js'));
  const prefixes = files.map((f) => f.split('-')[0]);
  const dupes = prefixes.filter((p, i) => prefixes.indexOf(p) !== i);
  chk('no duplicate numeric prefix in src/app', [...new Set(dupes)], []);
  chk('  prefixes are still in ascending load order',
    prefixes.map(Number).every((n, i, a) => i === 0 || n >= a[i - 1]), true);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
