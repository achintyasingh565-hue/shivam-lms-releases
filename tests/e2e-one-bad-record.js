// "Find bugs which could leave the app stranded."
//
// The worst one found: recomputeAll() runs before every screen is drawn, and it
// was a bare forEach over the book. ONE record the engine could not work out —
// a null inside a payments list from a half-written cloud row or a hand-edited
// backup, a disbursement date stored as a number — threw out of that loop, and
// with it went every other loan and the navigation itself. Forty-four good
// records were unreachable because of one bad one.
//
// It could get in because only two of the six ways the book is replaced
// (startup load, backup-file restore) repaired what they read. Rows from the
// other device, a cloud snapshot, the in-app snapshot and the IndexedDB mirror
// went straight in.
//
// These checks pin the repair, the isolation, and that every door is covered.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const CORE = R('src/app/01-core-store.js');
const CERT = R('src/app/08-certificate.js');
const HLP = R('src/app/02-helpers-nav.js');
const CLOUD = R('src/app/20-cloud-sync.js');
const INIT = R('src/app/15-init-errors.js');
const LOCK = R('src/app/13-security-lock.js');

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
console.log('--- the repair: normalizeLoans ---');
const audit = [];
const N = (() => {
  const ctx = { logAudit: (a, d) => audit.push(a + ': ' + d), Array, Number, String, isNaN, Object };
  vm.createContext(ctx);
  vm.runInContext(extract(CORE, 'normalizeLoans') + '\n' + extract(CORE, '_normDate') + '\nthis.n=normalizeLoans; this.d=_normDate;', ctx);
  return ctx;
})();
{
  const good = { id: 'G', principal: 60000, payments: [{ date: '2026-04-09', amount: 8700, status: 'Cleared' }], charges: [{ type: 'Late fee', amount: 500, date: '2026-06-09' }], disb: '2026-03-09', due: '2026-04-09' };
  const before = JSON.stringify(good);
  const out = N.n([good]);
  chk('a healthy record comes through byte-for-byte', JSON.stringify(out[0]), before);
  chk('  and nothing is logged for it', audit.length, 0);

  const bad = N.n([{ id: 'B', payments: [null, { date: '2026-04-09', amount: 100, status: 'Cleared' }, 'x', 7, [1]], charges: [null, { type: 'Late fee', amount: 500 }, 'junk'] }])[0];
  chk('nulls and non-records are dropped from payments', bad.payments.length, 1);
  chk('  the real payment survives', bad.payments[0].amount, 100);
  chk('  same for charges', bad.charges.map((c) => c.type), ['Late fee']);
  chk('  and the repair is recorded once', audit.filter((a) => /malformed/.test(a)).length, 1);

  chk('a number in a date field is emptied, not thrown on', N.n([{ id: 'D', disb: 20261009 }])[0].disb, '');
  chk('an object in a date field likewise', N.n([{ id: 'D', baseDate: {} }])[0].baseDate, '');
  chk('a full timestamp is cut to its date', N.d('2026-10-14T09:30:00.000Z'), '2026-10-14');
  chk('DD-MM-YYYY is turned round', N.d('14-10-2026'), '2026-10-14');
  chk('DD/MM/YYYY too', N.d('9/3/2026'), '2026-03-09');
  chk('a proper date is untouched', N.d('2026-11-20'), '2026-11-20');
  chk('unreadable TEXT is left as typed (nothing is destroyed)', N.d('next month'), 'next month');
  chk('an impossible month is not "converted"', N.d('14-13-2026'), '14-13-2026');
  chk('a payment date stored as a number is emptied', N.n([{ id: 'P', payments: [{ date: 12345, amount: 1 }] }])[0].payments[0].date, '');

  chk('a record with no id is still dropped', N.n([{ name: 'ghost' }, null, 'x']).length, 0);
  chk('not-an-array in gives an empty book, not a crash', N.n({ oops: 1 }), []);
}

// ---------------------------------------------------------------------------
console.log('\n--- the isolation: recomputeAll ---');
{
  const reported = [];
  const ctx = { todayISO: () => '2026-11-16', reportError: (w, m) => reported.push(w + ' | ' + m), Math, Number, Array, Date, JSON, String, isNaN, isFinite, Object, console };
  vm.createContext(ctx);
  vm.runInContext([extract(HLP, 'repPad'), extract(HLP, 'repAddMonths'), extract(HLP, 'repDaysBetween'),
    extract(CERT, 'emiDueDate'), extract(CERT, '_recomputeInterestOnly'), extract(CERT, 'recomputeLoan'), extract(CERT, 'recomputeAll'),
    'var loans=[]; this.setLoans=function(a){ loans=a; }; this.all=recomputeAll; this.one=recomputeLoan;'].join('\n'), ctx);

  const mk = (id) => ({ id, acno: id, principal: 60000, rate: 2, tenure: 8, tpay: 69600, emi: 8700, disb: '2026-03-09', charges: [], payments: [] });
  // a record that makes the engine throw however tolerant it is: a getter that explodes
  const poison = mk('BAD'); Object.defineProperty(poison, 'tpay', { get() { throw new Error('unreadable record'); }, enumerable: true });
  const a = mk('A'), z = mk('Z');
  ctx.setLoans([a, poison, null, 'junk', z]);
  let threw = false; try { ctx.all(); } catch (e) { threw = true; }
  chk('one record the engine cannot work out does not throw out of the loop', threw, false);
  chk('  the loan BEFORE it was worked out', a.outstanding, 69600);
  chk('  and so was the loan AFTER it', z.outstanding, 69600);
  chk('  the bad one is reported, by account', reported.length === 1 && /A\/C BAD/.test(reported[0]), true);

  // the engines themselves no longer throw on the entries that actually occur
  let l = mk('N'); l.payments = [null, { date: '2026-04-09', amount: 8700, status: 'Cleared' }];
  threw = false; try { ctx.one(l); } catch (e) { threw = true; }
  chk('a null payment entry: flat engine carries on', [threw, l.paid], [false, 8700]);
  l = mk('NB'); l.interestOnly = true; l.payments = [null];
  threw = false; try { ctx.one(l); } catch (e) { threw = true; }
  chk('a null payment entry: byaj engine carries on', threw, false);
  l = mk('ND'); l.interestOnly = true; l.disb = 'garbage'; ctx.one(l);
  chk('an unreadable start date does not make byaj arrears NaN', Number.isFinite(l.arrears), true);
  l = mk('NN'); l.disb = 20261009;
  threw = false; try { ctx.one(l); } catch (e) { threw = true; }
  chk('a numeric disbursement date does not throw', threw, false);
  chk('  and never prints "NaN-NaN-NaN" as a due date', /NaN/.test(String(l.due)), false);
}

// ---------------------------------------------------------------------------
console.log('\n--- the date helpers do not throw or print rubbish ---');
{
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext([extract(HLP, 'repPad'), extract(HLP, 'repAddMonths'), extract(HLP, 'fmtDate'), 'this.add=repAddMonths; this.fmt=fmtDate;'].join('\n'), ctx);
  chk('31 Jan + 1 month still clamps to 28 Feb', ctx.add('2026-01-31', 1), '2026-02-28');
  chk('9 Mar + 6 months = 9 Sep', ctx.add('2026-03-09', 6), '2026-09-09');
  chk('garbage in, empty out', ctx.add('garbage', 1), '');
  chk('a number in, empty out', ctx.add(20261009, 1), '');
  chk('fmtDate of a real date', ctx.fmt('2026-11-20'), '20-11-26');
  chk('fmtDate of a number: blank, not a crash', ctx.fmt(20261120), '');
  chk('fmtDate of odd text: shown as it is', ctx.fmt('soon'), 'soon');
}

// ---------------------------------------------------------------------------
console.log('\n--- every way the book is replaced now repairs what it reads ---');
{
  chk('startup load', /loans = normalizeLoans\(loans\);/.test(CORE), true);
  chk('the IndexedDB mirror (wipe recovery)', /loans=normalizeLoans\(idbLoans\);/.test(CORE), true);
  chk('rows arriving from the other device', /loans = \(typeof normalizeLoans === 'function'\) \? normalizeLoans\(res\.loans\) : res\.loans;/.test(CLOUD), true);
  chk('a daily cloud snapshot restore', /if \(typeof normalizeLoans === 'function'\) loans = normalizeLoans\(loans\);/.test(CLOUD), true);
  chk('the in-app snapshot restore', /loans=\(typeof normalizeLoans==='function'\)\?normalizeLoans\(sn\.data\):sn\.data;/.test(INIT), true);
  chk('a backup-file restore (already did)', /arr=normalizeLoans\(arr\);/.test(R('src/app/14-pwa-backup.js')), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- locked out by an unreadable account store ---');
{
  // The accounts are encrypted with the Mac keychain. Reset the keychain, or
  // move the data folder to another Mac, and they cannot be decrypted.
  chk('a correct recovery password no longer ends at "No Administrator account found"',
    /textContent='No Administrator account found'/.test(LOCK), false);
  chk('  it re-creates the Administrator account instead', /adm=\{user:'admin', name:'Administrator', role:'admin', hash:''\}/.test(LOCK), true);
  const i = LOCK.indexOf("checkPass('rec::'+secret, rec.hash)"), j = LOCK.indexOf("adm={user:'admin'");
  chk('  only AFTER the recovery secret has been verified', i > 0 && j > i, true);
  chk('sign-in explains the real problem instead of "Incorrect username or password"',
    /could not be read[\s\S]{0,200}Forgot password/.test(LOCK), true);
  chk('  the last-resort lock reset is still there', /window\.forgotReset=function/.test(LOCK), true);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
