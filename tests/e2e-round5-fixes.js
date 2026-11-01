// Round 5 — the remaining findings from two independent reviews of v2.16.0.
// Mostly sync and reporting paths that cannot be reached from the UI harness,
// so several checks assert on the source where behaviour is structural.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeSandbox } = require('./harness');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, 'src/app', f), 'utf8');
function fn(src, name) {
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

const sync = R('20-cloud-sync.js');

console.log('--- sync: the outbox cannot undo itself ---');
chk('deleting a loan drops its queued edit',
  /window\.cloudDelete[\s\S]{0,400}pendingEditRemove\(id\)/.test(sync), true);
chk('restoring a loan cancels its queued delete',
  /window\.cloudUndelete[\s\S]{0,200}pendingDelRemove\(id\)/.test(sync), true);
chk('  and forces the restore to upload', /window\.cloudUndelete[\s\S]{0,260}delete lastHash\[id\]/.test(sync), true);
const crud = fs.readFileSync(path.join(root, 'src/app/07-loans-crud.js'), 'utf8');
chk('the Recycle Bin restore calls it', /cloudUndelete\(id\)/.test(crud), true);

console.log('\n--- sync: overlapping pushes on one device ---');
/* The version was first recorded as `_hash` ON the row object. That object is
   what gets serialised into the Supabase POST, and public.loans has no such
   column, so PostgREST rejected every loan upsert — no edit could sync at all.
   It now lives in a side map keyed by loan id, which never leaves this device.
   (Codex 5 of round 3 caught this; the assertions below pin the new shape.) */
chk('each row records the version it carries', /hashOf\[l\.id\] = s;/.test(sync), true);
chk('  the hash is no longer set before the await', /lastHash\[l\.id\] = s;\n/.test(sync), false);
chk('  and never as a column on the row', /\._hash\s*=/.test(sync), false);
chk('  a superseded row stays queued', /hashOf\[x\.id\] !== cur[\s\S]{0,120}return;/.test(sync), true);

console.log('\n--- sync: the precheck must fail closed ---');
chk('a failed read holds the edit instead of writing',
  /if \(!_readOK\)[\s\S]{0,200}pendingEditAdd\(_rid\)/.test(sync), true);

console.log('\n--- sync: restore reports honestly ---');
chk('a non-OK cloud list aborts reconciliation', /if \(!_cr \|\| !_cr\.ok\) throw new Error\('cloud list failed'\)/.test(sync), true);
chk('  and the toast says this device only', /Restored on THIS device only/.test(sync), true);

console.log('\n--- sync: conflict resolution ---');
chk('a non-OK re-read aborts rather than using the cached copy',
  /if \(!readOK\) \{ toast\('Cannot reach the cloud/.test(sync), true);
chk('the decision follows the fetched row, not the old kind',
  /row \? !!row\.deleted : \(c\.kind === 'deleted-remotely'\)/.test(sync), true);
chk('fresh remote data is decrypted', /row\.data = await decryptLoanFields\(row\.data\)/.test(sync), true);
chk('only the resolved conflict version is cleared', /x\.seen === seenAt/.test(sync), true);

console.log('\n--- combining byaj loans ---');
const docgen = R('18-docgen.js');
chk('the merge settlement is tagged as principal', /mode:'Adjustment'[^}]*kind:'principal'/.test(docgen), true);
{
  const S = makeSandbox('2026-06-01');
  const mk = (merged) => {
    const l = { id: 'S', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
      disb: '2026-01-01', due: '2026-02-01', charges: [],
      payments: [{ id: 'a', date: '2026-02-01', amount: 2000, status: 'Cleared' },
                 { id: 'm', date: '2026-05-01', amount: 100000, status: 'Cleared', mode: 'Adjustment', kind: 'principal' }] };
    if (merged) l.mergedInto = 'SE-999';
    S.recomputeLoan(l); return l;
  };
  chk('a merged source loan stays closed after recompute', mk(true).status, 'Closed');
  chk('  with nothing outstanding', mk(true).outstanding, 0);
  /* Four instalments fell due up to the 1 May principal return, one of them
     serviced: 8,000 - 2,000. 8,000 assumed a fifth month that only accrued
     because the clock ran to today rather than to the repayment date. */
  chk('an ordinary byaj loan still owes its unpaid interest', mk(false).outstanding, 6000);
}

console.log('\n--- revised schedule ---');
chk('the running balance starts from newTotal', /bal=\(c\.newTotal!=null\?c\.newTotal:c\.newOut\)/.test(docgen), true);
chk('  and the header figure matches it', /Revised amount payable[\s\S]{0,80}c\.newTotal!=null/.test(docgen), true);

console.log('\n--- schedule legend lists every charge ---');
const sched = R('03-emi-schedule.js');
chk('cheque bounce appears', /totalBnc>0\?\(' &nbsp;\+&nbsp; cheque bounce/.test(sched), true);
chk('other charges appear', /other charges/.test(sched), true);

console.log('\n--- interest-only receipts in the reports ---');
const ovd = R('04-overdue.js');
chk('P&L books an interest-only receipt as 100% interest', /_isIntP\(p\)\)\{ interest \+= amt; return; \}/.test(ovd), true);
chk('the interest report separates them too', /gotInt/.test(ovd), true);

console.log('\n--- contract dates do not drift ---');
const lf = R('31-loan-file.js');
chk('the loan file anchors to the disbursement date', /var firstDue = l\.disb \? _addM\(l\.disb, 1\)/.test(lf), true);
chk('  and no longer starts from the moving due date', /_addM\(l\.due \|\| _addM\(l\.disb, 1\)/.test(lf), false);
const wl = R('26-welcome-letter.js');
chk('the welcome letter anchors too', /_firstDue\(l\) \{ return l\.disb \? _addM\(l\.disb, 1\)/.test(wl), true);
const ld = R('10-loan-documents.js');
chk('the agreement fills both from and to dates', /set\('h_to',_td\)/.test(ld), true);
chk('the proposal fills PAN', /set\('p_pan'/.test(R('09-proposal.js')), true);

console.log('\n--- receipts follow dates, not entry order ---');
{
  const cert = R('08-certificate.js');
  const ctx = { Math, Number, String, Array, Object }; vm.createContext(ctx);
  vm.runInContext(fn(cert, 'balanceAtPayment') + '\nthis.b = balanceAtPayment;', ctx);
  const l = { tpay: 100000, charges: [], payments: [
    { date: '2026-03-01', amount: 10000, status: 'Cleared' },
    { date: '2026-02-01', amount: 5000, status: 'Cleared' }] };
  chk('a backdated February receipt excludes the March money', ctx.b(l, 1), 95000);
  chk('the March receipt includes both', ctx.b(l, 0), 85000);
}

console.log('\n--- a restructure resets the interest shift ---');
{
  const S2 = makeSandbox('2026-07-01');
  const P = (d, a, x) => Object.assign({ id: 'p' + d + a, date: d, amount: a, status: 'Cleared' }, x || {});
  const mk = (withOld) => {
    const t = S2.calcLoanTotals(100000, 2, 12);
    const pays = withOld
      ? [P('2026-02-01', 2000, { intOnly: true, type: 'Interest' }),
         P('2026-03-01', 2000, { intOnly: true, type: 'Interest' })]
      : [];
    const l = { id: 'R', principal: 100000, rate: 2, tenure: 12, tint: t.tint, tpay: t.tpay,
      emi: t.emi, disb: '2026-01-01', due: '2026-07-01', baseDate: '2026-06-01',
      baseOut: t.tpay, paidBase: 0, charges: [], payments: pays };
    S2.recomputeLoan(l); return l;
  };
  const withOld = mk(true), without = mk(false);
  chk('interest serviced before the restructure no longer counts', withOld.intServiced, 0);
  chk('  so the due date does not drift', withOld.due, without.due);
  const da = S2.repScheduleData(withOld).rows.filter(r => r.i).slice(0, 3).map(r => r.due);
  const db = S2.repScheduleData(without).rows.filter(r => r.i).slice(0, 3).map(r => r.due);
  chk('  the instalment dates match', da, db);
  chk('  and no pre-restructure interest row is injected',
    S2.repScheduleData(withOld).rows.filter(r => r.isInt).length, 0);

  // interest serviced AFTER the restructure must still shift it
  const after = (function () {
    const t = S2.calcLoanTotals(100000, 2, 12);
    const l = { id: 'R2', principal: 100000, rate: 2, tenure: 12, tint: t.tint, tpay: t.tpay,
      emi: t.emi, disb: '2026-01-01', due: '2026-07-01', baseDate: '2026-06-01',
      baseOut: t.tpay, paidBase: 0, charges: [],
      payments: [P('2026-06-15', 2000, { intOnly: true, type: 'Interest' })] };
    S2.recomputeLoan(l); return l;
  })();
  chk('interest serviced after it still counts', after.intServiced, 1);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL ROUND-5 CHECKS PASS');
process.exitCode = fails ? 1 : 0;
