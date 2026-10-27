// Late fees must never be charged twice for the same month.
//
// The reported symptom: a ₹500 late fee entered by hand showed as ₹1,000 in
// the schedule summary. Cause — applyLateFees() de-duplicated on `emiIdx`, but
// the Record-a-charge form creates charges with no emiIdx, so a hand-entered
// fee was invisible to the check and Apply added a second one.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '08-certificate.js'), 'utf8');
const i = src.indexOf('window.applyLateFees=function(id, only){');
if (i < 0) throw new Error('applyLateFees not found');
let b = src.indexOf('{', i + 30), d = 0, end = -1;
for (let j = b; j < src.length; j++) {
  if (src[j] === '{') d++;
  else if (src[j] === '}') { d--; if (d === 0) { end = j + 1; break; } }
}
const fn = src.slice(i, end) + ';';

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// Three instalments overdue: Aug, Sep, Oct 2026.
const OVERDUE = [{ i: 5, due: '2026-08-03' }, { i: 6, due: '2026-09-03' }, { i: 7, due: '2026-10-03' }];

function run(existingCharges, opts) {
  opts = opts || {};
  const loan = { id: 'L', name: 'X', acno: '1', emi: 3100, charges: JSON.parse(JSON.stringify(existingCharges || [])) };
  const ctx = {
    loans: [loan],
    getLateFeeRate: () => (opts.rate === undefined ? 500 : opts.rate),
    getManualOvdInt: () => (opts.manualInt || 0),
    overdueMonthlyInterest: () => (opts.monthInt === undefined ? 600 : opts.monthInt),
    overdueEmiIdxs: () => OVERDUE,
    getOvdFrom: () => (opts.from || ''),
    _monthPaidInEmiMonth: () => 0,        // every overdue month fully missed
    recomputeLoan: () => {}, save: () => {}, logAudit: () => {},
    renderChargeList: () => {}, chgUpdateHint: () => {}, renderLoans: () => {},
    toast: (m) => { ctx._toast = m; },
    Date, Math, Number, String, Array, JSON, console,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fn, ctx);
  ctx.applyLateFees('L', opts.only);
  return { loan, toast: ctx._toast };
}
const feesFor = l => l.charges.filter(c => c.type === 'Late fee');
const sumOf = (l, t) => l.charges.filter(c => c.type === t).reduce((a, c) => a + c.amount, 0);

// 1. clean loan: one fee and one interest charge per overdue month
let r = run([]);
chk('three late fees added', feesFor(r.loan).length, 3);
chk('late fees total 1,500', sumOf(r.loan, 'Late fee'), 1500);
chk('three interest charges added', sumOf(r.loan, 'Overdue interest'), 1800);

// 2. THE REPORTED BUG: a hand-entered fee (no emiIdx) for a month that Apply
//    also covers. Before the fix this produced 1,000 for August.
r = run([{ id: 'm1', type: 'Late fee', amount: 500, date: '2026-08-10', note: 'typed by hand' }]);
const aug = r.loan.charges.filter(c => c.type === 'Late fee' && String(c.date).slice(0, 7) === '2026-08');
chk('August has ONE late fee, not two', aug.length, 1);
chk('  and it is the hand-entered one', aug[0].id, 'm1');
chk('late fees total 1,500 not 2,000', sumOf(r.loan, 'Late fee'), 1500);

// 3. same for a hand-entered overdue interest
r = run([{ id: 'm2', type: 'Overdue interest', amount: 600, date: '2026-09-21' }]);
chk('September has one interest charge',
  r.loan.charges.filter(c => c.type === 'Overdue interest' && String(c.date).slice(0, 7) === '2026-09').length, 1);
chk('interest total 1,800 not 2,400', sumOf(r.loan, 'Overdue interest'), 1800);

// 4. running Apply twice must still add nothing the second time
r = run([]);
const before = r.loan.charges.length;
const again = run(r.loan.charges);
chk('second Apply adds nothing', again.loan.charges.length, before);

// 5. a hand-entered fee in a month with NO overdue instalment is left alone
r = run([{ id: 'm3', type: 'Late fee', amount: 500, date: '2026-01-15' }]);
chk('unrelated month untouched', sumOf(r.loan, 'Late fee'), 500 + 1500);

// 6. a different charge TYPE in the same month must not block a late fee
r = run([{ id: 'm4', type: 'Cheque bounce', amount: 350, date: '2026-08-10' }]);
chk('a bounce fee does not suppress the late fee', sumOf(r.loan, 'Late fee'), 1500);
chk('  and the bounce fee survives', sumOf(r.loan, 'Cheque bounce'), 350);

// 7. charge-only-from cut-off still honoured
r = run([], { from: '2026-09-01' });
chk('months before the cut-off are skipped', sumOf(r.loan, 'Late fee'), 1000);


// ---------------------------------------------------------------------------
// Every charge type must be named, not swept into "Other".
// The schedule only ever classified Late fee and Overdue interest, so a cheque
// bounce showed on the borrower's statement as "Other" — telling him nothing
// about what he was being charged for.
const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-10-27');
const cl = {
  id: 'L', name: 'X', acno: '1', principal: 25000, tpay: 37200, tint: 12200,
  tenure: 12, emi: 3100, rate: 2, disb: '2026-03-03', due: '2026-04-03', payments: [],
  charges: [
    { id: 'a', type: 'Late fee', amount: 500, date: '2026-07-03' },
    { id: 'b', type: 'Overdue interest', amount: 600, date: '2026-07-03' },
    { id: 'c', type: 'Cheque bounce', amount: 350, date: '2026-07-03' },
    { id: 'd', type: 'Foreclosure charge', amount: 200, date: '2026-07-03' },
  ],
};
S.recomputeLoan(cl);
const D = S.repScheduleData(cl);
chk('late fees totalled separately', D.totalLate, 500);
chk('overdue interest totalled separately', D.totalInt, 600);
chk('cheque bounce totalled separately', D.totalBnc, 350);
chk('all charges still reconcile', D.totalChg, 1650);
chk('the four types add up to the whole',
  D.totalLate + D.totalInt + D.totalBnc + 200, D.totalChg);

const crow = D.rows.find(r => (r.charge || 0) > 0);
chk('row breaks the charge down by type',
  [crow.lateFee, crow.intFee, crow.bncFee], [500, 600, 350]);
chk('only the genuinely uncategorised amount is left over',
  crow.charge - crow.lateFee - crow.intFee - crow.bncFee, 200);


// ---------------------------------------------------------------------------
// Late fees and overdue interest can now be applied separately, so one can be
// used without the other. The risk is cross-contamination: "late fees only"
// must not quietly add interest as well.
r = run([], { only: 'fee' });
chk('fees-only adds the fees', sumOf(r.loan, 'Late fee'), 1500);
chk('  and NO interest', sumOf(r.loan, 'Overdue interest'), 0);

r = run([], { only: 'int' });
chk('interest-only adds the interest', sumOf(r.loan, 'Overdue interest'), 1800);
chk('  and NO late fees', sumOf(r.loan, 'Late fee'), 0);

// applying one then the other ends up the same as applying both
let step = run([], { only: 'fee' });
step = run(step.loan.charges, { only: 'int' });
chk('fees then interest equals both', 
  [sumOf(step.loan, 'Late fee'), sumOf(step.loan, 'Overdue interest')], [1500, 1800]);

// and the duplicate guard still holds across the separated paths
step = run(step.loan.charges, { only: 'fee' });
chk('re-applying fees adds nothing', sumOf(step.loan, 'Late fee'), 1500);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHARGE-DUPLICATE CHECKS PASS');
process.exitCode = fails ? 1 : 0;
