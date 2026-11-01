// Round 6 — the combined Codex + Gemini review of v2.19.0.
//
// Every case here reproduces a defect that was confirmed in the source before
// anything was changed. Where a finding turned out to be wrong, there is no
// case for it; where the fix had to differ from the one proposed, the case
// asserts what the code actually does now.
//
//   Codex 1 / Gemini 1  byaj interest kept accruing after the principal came back
//   Codex 2             a byaj payoff receipt printed ₹0 against a ledger in arrears
//   Codex 3             combining byaj loans deleted the pending dues typed in
//   Codex 4             two schedule paths misread a byaj interest receipt
//   Codex 5             _hash was written as a column Supabase does not have
//   Codex 6             an in-flight upsert resurrected a loan deleted meanwhile
//   Codex 7             restore left queued edits for loans it had removed
//   Codex 8             pushDelete reported nothing, so restore claimed success
//   Codex 9             taking "theirs" re-recorded the same conflict forever
//   Gemini 2            restructure double-counted charges; repaid principal lost
//   Gemini 3            the statement's own arithmetic did not add up
//   Gemini 4            welcome letter ignored the restructure baseline
//   Gemini 5            dueToDate reported nothing for a byaj loan
//   Gemini 6            a hand-set Total Payable; interest counted as principal
//   Gemini 7            bare new Date(iso) reads as the previous day in IST

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeSandbox } = require('./harness');

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

const CERT = R('src/app/08-certificate.js');
const DOC = R('src/app/18-docgen.js');
const SYNC = R('src/app/20-cloud-sync.js');
const CRUD = R('src/app/07-loans-crud.js');

// ---------------------------------------------------------------------------
console.log('--- Codex 1 / Gemini 1 — byaj interest stops when the principal comes back ---');
{
  // ₹1,00,000 at 2% p.m. Interest serviced every month, principal returned on
  // 1 Jan. Ten months later the loan must still be Closed at ₹0.
  const S = makeSandbox('2026-11-01');
  const pays = [];
  for (let m = 2; m <= 12; m++) pays.push({ date: '2025-' + String(m).padStart(2, '0') + '-01', amount: 2000, status: 'Cleared' });
  pays.push({ date: '2026-01-01', amount: 2000, status: 'Cleared' });
  pays.push({ date: '2026-01-01', amount: 100000, status: 'Cleared', kind: 'principal' });
  const l = { id: 'B1', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
              disb: '2025-01-01', payments: pays, charges: [] };
  S.recomputeLoan(l);
  chk('a settled byaj loan is Closed', l.status, 'Closed');
  chk('  and owes nothing ten months later', l.outstanding, 0);

  // A borrower who serviced nothing for two months and then returned the
  // principal still owes those two months — and that figure must not grow.
  const mk = (today) => {
    const x = { id: 'B2', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
                disb: '2026-01-01', charges: [],
                payments: [{ date: '2026-03-01', amount: 100000, status: 'Cleared', kind: 'principal' }] };
    makeSandbox(today).recomputeLoan(x);
    return x;
  };
  chk('two unserviced months survive the payoff', mk('2026-03-20').outstanding, 4000);
  chk('  and do not grow month after month', mk('2026-12-01').outstanding, 4000);
  chk('  the loan is Overdue, not Closed', mk('2026-12-01').status, 'Overdue');
}

// ---------------------------------------------------------------------------
console.log('\n--- Codex 2 — a byaj receipt shows the interest still owed ---');
{
  const S = makeSandbox('2026-06-10');
  vm.runInContext(extract(CERT, 'balanceAtPayment'), S);
  // Three months unserviced, then the full principal is returned. The receipt
  // for that payment must not read ₹0 while the ledger reads ₹6,000.
  const l = { id: 'B3', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
              disb: '2026-01-01', charges: [],
              payments: [{ date: '2026-04-01', amount: 100000, status: 'Cleared', kind: 'principal' }] };
  chk('the payoff receipt shows the unserviced interest', S.balanceAtPayment(l, 0), 6000);

  // Interest kept current: the payoff receipt really is ₹0.
  const l2 = { id: 'B4', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
               disb: '2026-01-01', charges: [],
               payments: [
                 { date: '2026-02-01', amount: 2000, status: 'Cleared' },
                 { date: '2026-03-01', amount: 2000, status: 'Cleared' },
                 { date: '2026-04-01', amount: 2000, status: 'Cleared' },
                 { date: '2026-04-01', amount: 100000, status: 'Cleared', kind: 'principal' }] };
  chk('a fully serviced payoff receipt reads zero', S.balanceAtPayment(l2, 3), 0);
  // An interest receipt does not reduce the principal shown on its own receipt.
  // Two months due by 1 March and two serviced, so no interest is outstanding
  // and the receipt reads the principal exactly.
  chk('an interest receipt still shows the full principal', S.balanceAtPayment(l2, 1), 100000);
  // Skip a month and the next interest receipt carries the shortfall.
  const l3 = { id: 'B4b', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
               disb: '2026-01-01', charges: [],
               payments: [{ date: '2026-04-01', amount: 2000, status: 'Cleared' }] };
  chk('  a receipt after two skipped months shows them', S.balanceAtPayment(l3, 0), 100000 + 4000);
}

// ---------------------------------------------------------------------------
console.log('\n--- Codex 3 — combining byaj loans keeps the pending dues ---');
{
  // The byaj engine resets tpay to the principal, so anything folded into the
  // plan had to move somewhere the engine actually reads: a charge row.
  const seg = DOC.slice(DOC.indexOf('if(rec.interestOnly){'), DOC.indexOf('if(rec.interestOnly){') + 700);
  chk('the carried amount is tpay − principal', /_carryIn\s*=\s*Math\.max\(0,\s*Math\.round\(rec\.tpay-rec\.principal\)\)/.test(seg), true);
  chk('  it is stored as a charge on the new loan', /rec\.charges\s*=\s*\[\{/.test(seg), true);
  chk('  and tpay is reset to the principal, as the engine expects', /rec\.tpay=rec\.principal/.test(seg), true);

  // behavioural: a byaj loan carrying a charge owes principal + charge
  const S = makeSandbox('2026-02-01');
  const l = { id: 'B5', interestOnly: true, principal: 200000, rate: 2, tenure: 0, disb: '2026-01-01',
              payments: [{ date: '2026-02-01', amount: 4000, status: 'Cleared' }],
              charges: [{ date: '2026-01-01', type: 'Other', amount: 7500, note: 'Dues carried in on merge' }] };
  S.recomputeLoan(l);
  chk('the carried dues are part of the balance', l.outstanding, 207500);
  chk('  and the principal itself is untouched', l.principal, 200000);
  chk('  the monthly interest is still on the principal alone', l.emi, 4000);
}

// ---------------------------------------------------------------------------
console.log('\n--- Codex 4 — both schedule paths read a byaj receipt as interest ---');
{
  const a = CERT.slice(CERT.indexOf('function emiPaidByIndex('), CERT.indexOf('function emiPaidByIndex(') + 700);
  chk('emiPaidByIndex is loan-aware', /l\s*&&\s*l\.interestOnly\)\s*return\s*p\.kind!=='principal'/.test(a), true);
  const b = R('src/app/17-restructure.js');
  chk('the modal schedule builder is loan-aware', /l\s*&&\s*l\.interestOnly\)\s*return\s*p\.kind!=='principal'/.test(b), true);

  // behavioural: an untagged byaj receipt must not tick an instalment
  const S = makeSandbox('2026-06-01');
  const base = { id: 'B6', name: 'T', acno: '9', interestOnly: true, principal: 100000, rate: 2,
                 tenure: 0, emi: 2000, tpay: 100000, disb: '2026-01-01', charges: [] };
  const withInt = S.build(Object.assign({}, base, {
    payments: [{ date: '2026-02-01', amount: 2000, status: 'Cleared' }] }));
  chk('an interest receipt ticks no instalment', withInt.paidCount, 0);
  const withPrin = S.build(Object.assign({}, base, {
    payments: [{ date: '2026-02-01', amount: 2000, status: 'Cleared', kind: 'principal' }] }));
  chk('  a principal receipt does count', withPrin.paidCount, 1);
}

// ---------------------------------------------------------------------------
console.log('\n--- Codex 5 — nothing is sent to Supabase that is not a column ---');
{
  const seg = SYNC.slice(SYNC.indexOf('async function pushChanged('), SYNC.indexOf('async function pushDelete('));
  chk('the row carries only real columns',
    (seg.match(/rows\.push\(\{[^}]*\}\)/) || [''])[0],
    "rows.push({ id: l.id, data: await encryptLoan(l), deleted: false, updated_by: deviceId })");
  chk('  _hash is never assigned onto a row', /rows\[[^\]]*\]\._hash|\.\s*_hash\s*=/.test(seg), false);
  chk('  the version lives in a side map', /hashOf\[l\.id\]\s*=\s*s;/.test(seg), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- Codex 6 — an in-flight upsert cannot resurrect a deleted loan ---');
{
  const seg = SYNC.slice(SYNC.indexOf('async function pushChanged('), SYNC.indexOf('async function pushDelete('));
  chk('rows are re-checked against the live book after the awaits',
    /rows\s*=\s*rows\.filter\(function \(x\) \{\s*var live/.test(seg), true);
  chk('  the filter runs BEFORE the upsert',
    seg.indexOf('var live') < seg.indexOf("api('/loans', {"), true);
  chk('  a loan gone by then is not committed as uploaded',
    /if \(cur === null\) \{ delete lastHash\[x\.id\]/.test(seg), true);

  // behavioural model of the filter
  const live = [{ id: 'A' }, { id: 'C' }];
  const rows = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const kept = rows.filter((x) => live.some((y) => y.id === x.id)).map((x) => x.id);
  chk('  only loans still in the book are written', kept, ['A', 'C']);
}

// ---------------------------------------------------------------------------
console.log('\n--- Codex 7 / 8 — restore tells the truth about what it did ---');
{
  chk('pushDelete reports failure', /pendingDelAdd\(id, obj\); return false;/.test(SYNC), true);
  chk('  and success', /pendingDelRemove\(id\); delete lastHash\[id\]; delete serverVer\[id\];\s*\n\s*return true;/.test(SYNC), true);
  const rest = SYNC.slice(SYNC.indexOf('var _reconciled = true;'));
  chk('a tombstone that did not land fails the reconcile',
    /var _okDel = await pushDelete\([\s\S]{0,120}if \(!_okDel\) _reconciled = false;/.test(rest), true);
  chk('queued edits for loans the snapshot drops are discarded',
    /if \(eid != null && !_live\[eid\]\) pendingEditRemove\(eid\);/.test(rest), true);
  chk('  and their cached versions with them',
    /Object\.keys\(lastHash\)\.forEach[\s\S]{0,80}delete lastHash\[k\]/.test(rest), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- Codex 9 — resolving a conflict actually ends it ---');
{
  const seg = SYNC.slice(SYNC.indexOf('async function conflictResolve('), SYNC.indexOf('function conflictDrop('));
  chk('taking theirs moves the server baseline on', /serverVer\[id\] = row\.updated_at;/.test(seg), true);
  chk('  and records it as our current version', /lastHash\[id\] = JSON\.stringify\(obj\);/.test(seg), true);
  chk('a remote delete clears both', /delete serverVer\[id\]; delete lastHash\[id\];/.test(seg), true);

  // behavioural: with the baseline moved on, the next push sees no conflict
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(extract(SYNC, 'cloudConflictDecision') + '\nthis.decide=cloudConflictDecision;', ctx);
  const row = { id: 'X', updated_at: '2026-05-01T10:00:00Z', updated_by: 'other', deleted: false };
  chk('a stale baseline is a conflict', ctx.decide(row, '2026-04-01T10:00:00Z', 'me').ok, false);
  chk('  the accepted baseline is not', ctx.decide(row, '2026-05-01T10:00:00Z', 'me').ok, true);
}

// ---------------------------------------------------------------------------
console.log('\n--- Gemini 2 — a restructure neither doubles charges nor eats principal ---');
{
  const S = makeSandbox('2026-07-01');
  vm.runInContext([extract(DOC, 'outstandingOf'), extract(DOC, 'remPrincipalOf'),
                   'this.outstandingOf=outstandingOf; this.remPrincipalOf=remPrincipalOf;'].join('\n'), S);

  // ₹1,20,000 + ₹28,800 interest = ₹1,48,800 over 12. Four EMIs paid, ₹500 fee.
  const l = { id: 'R1', principal: 120000, rate: 2, tenure: 12, tint: 28800, tpay: 148800,
              emi: 12400, disb: '2026-01-01', charges: [{ date: '2026-05-02', type: 'Late fee', amount: 500 }],
              payments: [1, 2, 3, 4].map((m) => ({ date: '2026-0' + (m + 1) + '-01', amount: 12400, status: 'Cleared' })) };
  S.recomputeLoan(l);
  chk('the ledger carries the fee', l.outstanding, 148800 + 500 - 49600);
  // Four EMIs = 4 × (10,000 principal + 2,400 interest) → 40,000 principal repaid.
  chk('repaid principal is not reduced by the unpaid fee', S.remPrincipalOf(l), 80000);

  // the same loan with no fee must report the same repaid principal
  const l2 = JSON.parse(JSON.stringify(l)); l2.charges = [];
  S.recomputeLoan(l2);
  chk('  and matches an identical loan carrying no fee', S.remPrincipalOf(l2), 80000);

  // the fix in applyRestructure: tpay is net of the folded charges
  const seg = DOC.slice(DOC.indexOf('var _feesOwed='), DOC.indexOf('var _feesOwed=') + 400);
  chk('tpay is set net of the folded charges', /L\.tpay=Math\.max\(0, \(Number\(L\.paid\)\|\|0\)\+Math\.max\(0,c\.newTotal\)-_feesOwed\)/.test(seg), true);

  // behavioural: recomputeLoan adds the fee back exactly once
  const after = { id: 'R2', principal: 120000, rate: 2, tenure: 8, tint: 0,
                  paid: 49600, paidBase: 49600, baseDate: '2026-07-01', baseOut: 99700,
                  tpay: 49600 + 99700 - 500, emi: 12463, disb: '2026-01-01',
                  charges: [{ date: '2026-05-02', type: 'Late fee', amount: 500 }],
                  payments: [1, 2, 3, 4].map((m) => ({ date: '2026-0' + (m + 1) + '-01', amount: 12400, status: 'Cleared' })) };
  S.recomputeLoan(after);
  chk('the restructured balance equals the re-planned total', after.outstanding, 99700);
}

// ---------------------------------------------------------------------------
console.log('\n--- Gemini 3 — the statement adds up on its face ---');
{
  const H = R('src/app/02-helpers-nav.js');
  const ctx = { Math, Number, String, Array, console };
  vm.createContext(ctx);
  vm.runInContext(extract(H, '_stmtSplit') + '\nthis.split=_stmtSplit;', ctx);

  const flat = { interestOnly: false };
  const pays = [
    { date: '2026-02-01', amount: 12400, status: 'Cleared' },
    { date: '2026-03-01', amount: 2400, status: 'Cleared', intOnly: true },
    { date: '2026-04-01', amount: 12400, status: 'Cleared' },
    { date: '2026-05-01', amount: 12400, status: 'Pending' },
    { date: '2026-06-01', amount: 12400, status: 'Bounced' }];
  const s1 = ctx.split(flat, pays);
  chk('every cleared rupee is counted as received', s1.all, 27200);
  chk('  the interest slice is separated', s1.interest, 2400);
  chk('  and principal repaid closes the arithmetic', s1.principal, 24800);
  chk('  a pending cheque is not received', s1.all, 27200);

  const byaj = { interestOnly: true };
  const s2 = ctx.split(byaj, [
    { amount: 2000, status: 'Cleared' },
    { amount: 2000, status: 'Cleared' },
    { amount: 100000, status: 'Cleared', kind: 'principal' }]);
  chk('on a byaj loan only kind:principal repays', s2.principal, 100000);
  chk('  the rest is interest', s2.interest, 4000);

  chk('the printed statement labels an interest receipt',
    /_sp\.isInt\(p\)\?' \(interest only\)'/.test(H), true);
  chk('  and the reconciliation line subtracts principal, not everything',
    /principal repaid ':'paid '\)\+inr\(_sp\.principal\)/.test(H), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- Gemini 4 — the welcome letter follows the restructure baseline ---');
{
  const W = R('src/app/26-welcome-letter.js');
  const H2 = R('src/app/02-helpers-nav.js');
  const ctx = { Math, Number, String, Array, Date, console, todayISO: () => '2026-07-01' };
  vm.createContext(ctx);
  vm.runInContext([extract(H2, 'repPad'), extract(H2, 'repAddMonths'),
                   extract(W, '_addM'), extract(W, '_d'), extract(W, '_today'),
                   extract(W, '_schedule'), 'this.sched=_schedule;'].join('\n'), ctx);

  // Restructured: ₹49,600 already paid, ₹99,700 re-planned over 8 at ₹12,463.
  const l = { principal: 120000, tint: 28800, tpay: 149300, emi: 12463, tenure: 8,
              disb: '2026-01-01', baseDate: '2026-07-01', baseOut: 99700, paidBase: 49600,
              payments: [1, 2, 3, 4].map((m) => ({ date: '2026-0' + (m + 1) + '-01', amount: 12400, status: 'Cleared' })) };
  const sc = ctx.sched(l);
  const last = sc.rows[sc.rows.length - 1];
  chk('the final instalment is the real one', last.emi, 99700 - 12463 * 7);
  chk('  not the balance plus everything already paid', last.emi < 20000, true);
  chk('the rows start from the restructure date', String(sc.rows[0].due).slice(0, 7), '2026-08');
  chk('  eight of them', sc.months, 8);
  chk('pre-restructure money ticks no new instalment', sc.paidCount, 0);

  // an ordinary loan is unchanged by the fix
  const o = { principal: 120000, tint: 28800, tpay: 148800, emi: 12400, tenure: 12,
              disb: '2026-01-01', payments: [{ date: '2026-02-01', amount: 12400, status: 'Cleared' }] };
  const so = ctx.sched(o);
  chk('an ordinary loan still amortises from the principal', so.rows[0].opening, 120000);
  chk('  and its last instalment still closes the total', so.rows[11].emi, 148800 - 12400 * 11);
  chk('  one paid instalment is still counted', so.paidCount, 1);
}

// ---------------------------------------------------------------------------
console.log('\n--- Gemini 5 — the closing advisory reports a byaj loan properly ---');
{
  const S = makeSandbox('2026-06-10');
  // Five months, two serviced. The dialog must show 5 months, ₹10,000 payable,
  // ₹4,000 received and ₹6,000 still to pay — figures the owner can check.
  const l = { id: 'B7', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
              disb: '2026-01-10', charges: [],
              payments: [{ date: '2026-02-10', amount: 2000, status: 'Cleared' },
                         { date: '2026-03-10', amount: 2000, status: 'Cleared' }] };
  S.recomputeLoan(l);
  const g = S.dueToDate(l);
  chk('months elapsed are reported', g.elapsed, 5);
  chk('  interest payable to date', g.emiExpected, 10000);
  chk('  interest received to date', g.received, 4000);
  chk('  and the two reconcile', g.expected - g.received, g.outstanding);
  chk('  still to pay', g.outstanding, 6000);

  // a byaj loan with interest fully current owes nothing TO DATE ...
  const cur = { id: 'B8', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
                disb: '2026-01-10', charges: [],
                payments: [2, 3, 4, 5, 6].map((m) => ({ date: '2026-0' + m + '-10', amount: 2000, status: 'Cleared' })) };
  S.recomputeLoan(cur);
  chk('a fully serviced byaj loan is not behind', S.dueToDate(cur).outstanding, 0);
  // ... which is exactly why delLoan needs its own balance check
  chk('  but the principal is still out on loan', cur.outstanding, 100000);
  chk('delLoan names an outstanding balance of its own accord',
    /THIS LOAN STILL HAS A BALANCE/.test(CRUD), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- Gemini 6 — the loan modal does not contradict itself ---');
{
  chk('a hand-set Total Payable drives the Total Interest shown with it',
    /if\(window\._tpayManual\)\{[\s\S]{0,400}\$\('m_tint'\)\.value=Math\.max\(0, Math\.round\(_mtp-p\)\)/.test(CRUD), true);
  chk('Amount paid excludes interest-only receipts',
    /const cleared=\(modalPayments\|\|\[\]\)\.filter\(p=>p\.status==='Cleared' && !_isIntM\(p\)\)/.test(CRUD), true);
  chk('  the classifier is loan-aware', /if\(_io\) return p\.kind!=='principal';/.test(CRUD), true);
  chk('  and the Received line still shows every rupee in',
    /window\._mClearedAll/.test(CRUD), true);

  // behavioural model of the two sums
  const mp = [{ status: 'Cleared', amount: 12400 }, { status: 'Cleared', amount: 2400, intOnly: true },
              { status: 'Pending', amount: 12400 }];
  const isInt = (p) => (p.intOnly === true || p.type === 'Interest');
  const all = mp.filter((p) => p.status === 'Cleared').reduce((a, p) => a + p.amount, 0);
  const prin = mp.filter((p) => p.status === 'Cleared' && !isInt(p)).reduce((a, p) => a + p.amount, 0);
  chk('money received', all, 14800);
  chk('  of which reduces the balance', prin, 12400);
}

// ---------------------------------------------------------------------------
console.log('\n--- Gemini 7 — document dates do not slip a day in IST ---');
{
  const LF = R('src/app/31-loan-file.js');
  const LD = R('src/app/10-loan-documents.js');
  chk('the loan file anchors every parse to local midnight',
    /new Date\(l\.disb\)(?!\+)/.test(LF.replace(/new Date\(l\.disb\+'T00:00:00'\)/g, '')), false);
  chk('  six of them', (LF.match(/new Date\(l\.disb\+'T00:00:00'\)/g) || []).length, 6);
  chk('the letterhead date is anchored too',
    /new Date\(\$\('h_date'\)\.value\+'T00:00:00'\)/.test(LD), true);

  // the hazard itself, stated once: a bare ISO date is UTC
  const bare = new Date('2026-03-15');
  const anchored = new Date('2026-03-15T00:00:00');
  chk('a bare ISO date really is parsed as UTC', bare.toISOString().slice(0, 10), '2026-03-15');
  chk('  and an anchored one is local', anchored.getDate(), 15);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
