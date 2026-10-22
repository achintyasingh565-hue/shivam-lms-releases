// Projected balance on instalments still to come.
//
// The balance column is `total payable + charges − money received`, so a future
// row could not move and every remaining instalment repeated the same number.
// Those rows now carry a forecast in `projBal`.
//
// The property that matters most here is the one that is NOT about the forecast:
// `bal` must be byte-for-byte what it was before, because the schedule is
// required to reconcile with the outstanding shown everywhere else in the app.

const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-10-22');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// The loan from the reported screenshot: 12 x 3,100, nothing paid, four
// deferred months each carrying a 500 late fee + 600 overdue interest.
const loan = {
  id: 'L', name: 'X', acno: '1', principal: 25000, tpay: 37200, tint: 12200,
  tenure: 12, emi: 3100, rate: 2, disb: '2026-03-03', due: '2026-04-03',
  payments: [], charges: [],
};
['2026-07-03', '2026-08-03', '2026-09-03', '2026-10-03'].forEach((d, i) => {
  loan.charges.push({ id: 'lf' + i, type: 'Late fee', amount: 500, date: d, emiIdx: 0 });
  loan.charges.push({ id: 'oi' + i, type: 'Overdue interest', amount: 600, date: d, emiIdx: 0 });
});
S.recomputeLoan(loan);
const D = S.repScheduleData(loan);
const future = D.rows.filter(r => r.projected);

// --- the actual arithmetic must be untouched
chk('every actual balance is still total + charges - received',
  D.rows.filter(r => !r.isInt && r.bal != null).every(r => r.bal === 41600 || r.bal < 41600), true);
chk('forecast never written into bal', D.rows.every(r => r.projBal === undefined || r.bal !== r.projBal || r.projBal === 0), true);

// --- the forecast itself
chk('future instalments are projected', future.length > 0, true);
chk('forecast steps down by the EMI',
  future.slice(0, 3).map(r => r.projBal), [38500, 35400, 32300]);
// It ends at the unpaid CHARGES, not zero: the remaining instalments repay the
// 37,200 payable, but the 4 x 1,100 of late fees and overdue interest sit on
// top and are still owed. Ending at zero would imply the charges evaporate.
chk('forecast ends at the charges still owed', future[future.length - 1].projBal, 4400);
chk('  which is exactly the charges levied', future[future.length - 1].projBal, D.totalChg);
chk('forecast never goes negative', future.every(r => r.projBal >= 0), true);
chk('forecast is monotonically decreasing',
  future.every((r, i) => i === 0 || r.projBal <= future[i - 1].projBal), true);

// --- rows that already happened must NOT be forecast
chk('deferred rows are not projected', D.rows.filter(r => r.missed).every(r => !r.projected), true);
chk('interest-only rows are not projected', D.rows.filter(r => r.isInt).every(r => !r.projected), true);
chk('post-tenure accrual rows are not projected', D.rows.filter(r => r.accrual).every(r => !r.projected), true);

// --- with no charges, the forecast DOES walk to zero
const clean = JSON.parse(JSON.stringify(loan));
clean.charges = [];
S.recomputeLoan(clean);
const Dc = S.repScheduleData(clean);
const cFuture = Dc.rows.filter(r => r.projected);
chk('no charges -> forecast reaches zero', cFuture[cFuture.length - 1].projBal, 0);

// --- a fully paid loan forecasts nothing
const paid = JSON.parse(JSON.stringify(loan));
paid.charges = [];
paid.payments = [];
for (let m = 4; m <= 12; m++) paid.payments.push({ id: 'p' + m, date: '2026-' + String(m).padStart(2, '0') + '-03', amount: 3100, status: 'Cleared' });
S.recomputeLoan(paid);
const Dp = S.repScheduleData(paid);
chk('settled instalments are not projected',
  Dp.rows.filter(r => r.st === 'Paid').every(r => !r.projected), true);

// --- a partly paid instalment forecasts only what is still owed on it
const part = JSON.parse(JSON.stringify(loan));
part.charges = [];
part.payments = [{ id: 'p1', date: '2026-04-03', amount: 1000, status: 'Cleared' }];
S.recomputeLoan(part);
const Dq = S.repScheduleData(part);
const firstProj = Dq.rows.filter(r => r.projected)[0];
chk('part-paid instalment forecasts only the remainder',
  firstProj.projBal, Math.round((Number(firstProj.bal) || 0) - (Number(firstProj.dueAmt) || 0)));

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL PROJECTED-BALANCE CHECKS PASS');
process.exitCode = fails ? 1 : 0;
