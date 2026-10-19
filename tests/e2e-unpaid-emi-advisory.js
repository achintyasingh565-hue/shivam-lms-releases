// Advisory shown before a loan is deleted or closed when instalments already
// due have not been fully received.
//
// Purpose: the owner turns the screen toward a borrower who wants his loan
// closed and the principal rolled into a new one while instalments are still
// outstanding. Step 1 is a single-button refusal stating the position as the
// system's; step 2 is an owner override the borrower does not see coming. So
// it advises firmly but never actually blocks.
//
// These checks cover the figure it reports and, just as importantly, the cases
// where it must stay silent — a false refusal shown to a borrower who is in
// fact up to date would be worse than no warning at all.

const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-10-19');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

function loan(payments, over) {
  return Object.assign({
    id: 'L1', name: 'Rajguru Tiwari', acno: '16286',
    principal: 120000, tpay: 177600, tint: 57600,
    tenure: 24, emi: 7400, rate: 2,
    disb: '2026-02-01', due: '2026-03-01',
    charges: [], payments: payments,
  }, over || {});
}
const pay = (d, a, extra) => Object.assign({ id: 'x' + d, date: d, amount: a, status: 'Cleared' }, extra || {});
const due = (l) => { S.recomputeLoan(l); return S.emiDueTillToday(l); };

// --- the reported case: instalment 3 part-paid (₹4,000 of ₹7,400)
const tiwari = loan([
  pay('2026-03-01', 7400),
  pay('2026-04-01', 2000, { intOnly: true }),
  pay('2026-05-01', 7400),
  pay('2026-06-01', 2000, { intOnly: true }),
  pay('2026-07-01', 2400, { intOnly: true }),
  pay('2026-08-01', 4000),
  pay('2026-09-01', 2400, { intOnly: true }),
  pay('2026-10-01', 2400, { intOnly: true }),
]);
const d1 = due(tiwari);
chk('shortfall on instalments already due', d1.amount, 3400);
chk('counts one unpaid instalment', d1.count, 1);
chk('reports the latest unpaid due date', d1.lastDue, '2026-08-01');

// --- everything due has been paid -> silent
const uptodate = loan([pay('2026-03-01', 7400), pay('2026-05-01', 7400)], { due: '2026-03-01', tenure: 24 });
uptodate.payments = [];
for (let m = 3; m <= 10; m++) uptodate.payments.push(pay('2026-' + String(m).padStart(2, '0') + '-01', 7400));
const d2 = due(uptodate);
chk('fully up to date -> no warning', d2.amount, 0);
chk('fully up to date -> no count', d2.count, 0);

// --- brand-new loan, nothing due yet -> silent
const fresh = loan([], { disb: '2026-12-01', due: '2027-01-01' });
chk('future first due -> no warning', due(fresh).amount, 0);

// --- a loan with no payments at all whose instalments ARE due -> warns
const neglected = loan([]);
const d3 = due(neglected);
chk('no payments, 8 months elapsed -> warns', d3.amount > 0, true);
chk('no payments -> counts every elapsed instalment', d3.count, 8);
// auto-defer turns each unpaid month into a 'Deferred' row with emi 0; the
// advisory must still charge the scheduled EMI for it, or the worst borrower
// in the book would raise no warning at all
chk('deferred months charged at the scheduled EMI', d3.amount, 8 * 7400);
const defRows = S.repScheduleData(neglected).rows.filter(r => r.missed);
chk('those months really are deferred rows with emi 0',
  [defRows.length, defRows.every(r => (r.emi || 0) === 0)], [8, true]);

// --- interest-only months must never be mistaken for instalments
const intOnlyRows = S.repScheduleData(tiwari).rows.filter(r => r.isInt);
chk('interest-only months exist in this fixture', intOnlyRows.length, 5);
chk('interest-only months excluded from the advisory',
  intOnlyRows.every(r => r.dueAmt === undefined), true);

// --- future instalments must never be counted, however many are unpaid
const allRows = S.repScheduleData(tiwari).rows.filter(r => r.i && !r.isInt);
const futureUnpaid = allRows.filter(r => r.due > '2026-10-19' && (r.dueAmt || 0) > 0).length;
chk('fixture does have unpaid future instalments', futureUnpaid > 0, true);
chk('but advisory still reports only the one already due', d1.count, 1);

// --- robustness: must not throw on junk
chk('null loan is safe', S.emiDueTillToday(null), { count: 0, amount: 0, lastDue: '' });
chk('loan with no payments array is safe',
  Number.isFinite(S.emiDueTillToday({ tenure: 12, emi: 100, tpay: 1200, due: '2026-01-01' }).amount), true);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL UNPAID-EMI ADVISORY CHECKS PASS');
process.exitCode = fails ? 1 : 0;
