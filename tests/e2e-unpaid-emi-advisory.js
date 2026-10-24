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
chk('instalment shortfall', d1.emiAmount, 3400);
chk('counts one unpaid instalment', d1.emiCount, 1);
// the two 2,000 months against 2,400 of interest are real uncollected money too
chk('interest shortfall folded in', d1.intAmount, 800);
chk('counts two short interest months', d1.intCount, 2);
chk('total is instalments + interest', d1.amount, 4200);
chk('total count is both kinds', d1.count, 3);
// 04 and 06 are short on interest, 08 is the part-paid instalment; 07/09/10
// were serviced in full, so the latest genuinely unpaid item is 01-08-26
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
chk('no payments -> counts every elapsed instalment', d3.emiCount, 8);
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
chk('interest-only months are not treated as instalments',
  intOnlyRows.every(r => r.dueAmt === undefined), true);
chk('only the short interest months are charged',
  intOnlyRows.map(r => r.intShort), [400, 400, 0, 0, 0]);

// --- interest fully serviced -> interest contributes nothing
const intOk = JSON.parse(JSON.stringify(tiwari));
intOk.payments = intOk.payments.map(p => p.intOnly ? Object.assign({}, p, { amount: 2400 }) : p);
const d4 = due(intOk);
chk('fully serviced interest adds nothing', d4.intAmount, 0);
chk('instalment shortfall still reported', d4.emiAmount, 3400);

// --- future instalments must never be counted, however many are unpaid
const allRows = S.repScheduleData(tiwari).rows.filter(r => r.i && !r.isInt);
const futureUnpaid = allRows.filter(r => r.due > '2026-10-19' && (r.dueAmt || 0) > 0).length;
chk('fixture does have unpaid future instalments', futureUnpaid > 0, true);
chk('but advisory still reports only the one already due', d1.emiCount, 1);

// --- robustness: must not throw on junk
chk('null loan is safe', S.emiDueTillToday(null),
  { count: 0, amount: 0, lastDue: '', emiCount: 0, emiAmount: 0, intCount: 0, intAmount: 0 });
chk('loan with no payments array is safe',
  Number.isFinite(S.emiDueTillToday({ tenure: 12, emi: 100, tpay: 1200, due: '2026-01-01' }).amount), true);


// ---------------------------------------------------------------------------
// Gross position at closing time — the owner's own test, and what the popup
// actually shows: by month N the borrower should have handed over N full EMIs
// (interest AND principal); anything short of that is still owed. This
// deliberately ignores deferrals, unlike emiDueTillToday above.
//
// Real figures from A/C 16286's payment history.
const real = loan([
  pay('2026-03-01', 7400), pay('2026-04-01', 2000), pay('2026-05-01', 5000),
  pay('2026-06-01', 2400), pay('2026-07-01', 4000), pay('2026-08-01', 6400),
  pay('2026-09-01', 6400), pay('2026-10-01', 2400),
]);
S.recomputeLoan(real);
const g = S.dueToDate(real);
chk('8 instalments have fallen due', g.elapsed, 8);
chk('payable to date = 8 x 7,400', g.expected, 59200);
chk('received to date', g.received, 36000);
chk('still to pay', g.outstanding, 23200);

// pending / uncleared money must not count as received
const withPending = JSON.parse(JSON.stringify(real));
withPending.payments.push({ id: 'pz', date: '2026-10-05', amount: 5000, status: 'Pending' });
S.recomputeLoan(withPending);
chk('uncleared payment is not credited', S.dueToDate(withPending).received, 36000);

// a borrower who has paid every instalment owes nothing
const square = loan([]);
for (let m = 3; m <= 10; m++) square.payments.push(pay('2026-' + String(m).padStart(2, '0') + '-01', 7400));
S.recomputeLoan(square);
chk('fully paid to date -> nothing outstanding', S.dueToDate(square).outstanding, 0);

// overpayment must not produce a negative figure
const ahead = loan([pay('2026-03-01', 200000)]);
S.recomputeLoan(ahead);
chk('overpaid -> never negative', S.dueToDate(ahead).outstanding, 0);

// nothing due yet
S.recomputeLoan(fresh);
chk('future first due -> nothing payable yet', S.dueToDate(fresh).expected, 0);
chk('null loan is safe', S.dueToDate(null),
  { elapsed: 0, expected: 0, emiExpected: 0, charges: 0, received: 0, outstanding: 0 });


// ---------------------------------------------------------------------------
// Charges count too. Late fees and bounce charges already levied are money
// owed just like an instalment, and `received` counts every rupee that came in
// including anything paid against a fee — so leaving charges out of the
// expected side understated the position.
const charged = loan([
  pay('2026-03-01', 7400), pay('2026-04-01', 2000), pay('2026-05-01', 5000),
  pay('2026-06-01', 2400), pay('2026-07-01', 4000), pay('2026-08-01', 6400),
  pay('2026-09-01', 6400), pay('2026-10-01', 2400),
]);
charged.charges = [
  { id: 'c1', type: 'Late fee', amount: 500, date: '2026-08-05' },
  { id: 'c2', type: 'Bounce fee', amount: 350, date: '2026-09-05' },
];
S.recomputeLoan(charged);
const gc = S.dueToDate(charged);
chk('instalments to date unchanged', gc.emiExpected, 59200);
chk('charges levied are counted', gc.charges, 850);
chk('payable = instalments + charges', gc.expected, 60050);
chk('outstanding now includes the fees', gc.outstanding, 24050);

// a charge dated in the FUTURE has not been levied yet
const future = JSON.parse(JSON.stringify(charged));
future.charges.push({ id: 'c3', type: 'Late fee', amount: 999, date: '2027-06-01' });
S.recomputeLoan(future);
chk('future-dated charge excluded', S.dueToDate(future).charges, 850);

// a charge with no date is treated as already levied, as the schedule does
const undated = JSON.parse(JSON.stringify(charged));
undated.charges.push({ id: 'c4', type: 'Late fee', amount: 100 });
S.recomputeLoan(undated);
chk('undated charge counted as levied', S.dueToDate(undated).charges, 950);

// no charges -> figures identical to before this change
chk('loan with no charges is unaffected', S.dueToDate(real).outstanding, 23200);
chk('  and reports zero charges', S.dueToDate(real).charges, 0);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL UNPAID-EMI ADVISORY CHECKS PASS');
process.exitCode = fails ? 1 : 0;
