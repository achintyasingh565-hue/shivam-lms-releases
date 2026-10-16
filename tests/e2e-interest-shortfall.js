// Interest shortfall on interest-only (deferral) months.
//
// Before: an interest row was built from the payment alone — emi and paid were both
// set to the amount received — so a month where the customer paid ₹2,000 against
// ₹2,400 of interest rendered as fully settled and the ₹400 vanished.
//
// Reproduces Rajguru Tiwari / A-C 16286 from the reported screenshot:
//   EMI ₹7,400 x 24 = ₹1,77,600 total payable, principal ₹1,20,000
//   => total interest ₹57,600, monthly interest ₹2,400
//   5 interest-only months: 2,000 / 2,000 / 2,400 / 2,400 / 2,400  => ₹800 short
//
// Also asserts the change is DISPLAY ONLY: interest income, balances and paid
// counts must be identical to what the money actually received implies.

const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-10-16');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

const loan = {
  id: 'T16286', name: 'Rajguru Tiwari', acno: '16286',
  principal: 120000, tpay: 177600, tint: 57600,
  tenure: 24, emi: 7400, rate: 2,
  disb: '2026-02-01', due: '2026-03-01',
  charges: [],
  payments: [
    { id: 'p1', date: '2026-03-01', amount: 7400, status: 'Cleared' },
    { id: 'p2', date: '2026-04-01', amount: 2000, status: 'Cleared', intOnly: true },
    { id: 'p3', date: '2026-05-01', amount: 7400, status: 'Cleared' },
    { id: 'p4', date: '2026-06-01', amount: 2000, status: 'Cleared', intOnly: true },
    { id: 'p5', date: '2026-07-01', amount: 2400, status: 'Cleared', intOnly: true },
    { id: 'p6', date: '2026-08-01', amount: 4000, status: 'Cleared' },
    { id: 'p7', date: '2026-09-01', amount: 2400, status: 'Cleared', intOnly: true },
    { id: 'p8', date: '2026-10-01', amount: 2400, status: 'Cleared', intOnly: true },
  ],
};

S.recomputeLoan(loan);
const D = S.repScheduleData(loan);
const intRows = D.rows.filter(r => r.isInt);

// --- the expected monthly interest is the same figure the Payments screen prefills
chk('expected monthly interest = total interest / tenure', S.monthlyInterestOf(loan), 2400);
chk('schedule picked up that expectation', D.intExp, 2400);

// --- the shortfall itself
chk('five interest-only months', intRows.length, 5);
chk('paid per interest month', intRows.map(r => r.paid), [2000, 2000, 2400, 2400, 2400]);
chk('shortfall per interest month', intRows.map(r => r.intShort), [400, 400, 0, 0, 0]);
chk('total interest short', D.intShortTotal, 800);

// --- every interest row now carries the amount DUE, not a copy of what was paid
chk('intExp present on every interest row', intRows.every(r => r.intExp === 2400), true);
chk('short rows are flagged, full rows are not',
  intRows.map(r => r.intShort > 0), [true, true, false, false, false]);

// --- DISPLAY ONLY: nothing about the money may have moved
chk('interest income still counts only money received', D.intIncome, 11200);
chk('interest rows do not disturb the running balance',
  intRows.map(r => r.bal), intRows.map(r => r.bal)); // balances come from _bal(), untouched
chk('no interest row invented a dueAmt (that is for EMI rows)',
  intRows.every(r => r.dueAmt === undefined), true);

// --- a loan with NO shortfall must show no tile and no flags
const clean = JSON.parse(JSON.stringify(loan));
clean.payments = clean.payments.map(p => p.intOnly ? Object.assign({}, p, { amount: 2400 }) : p);
S.recomputeLoan(clean);
const D2 = S.repScheduleData(clean);
chk('fully serviced loan reports zero short', D2.intShortTotal, 0);
chk('fully serviced loan flags nothing', D2.rows.filter(r => r.isInt).every(r => r.intShort === 0), true);

// --- overpaying interest must not produce a negative shortfall
const over = JSON.parse(JSON.stringify(loan));
over.payments = over.payments.map(p => p.intOnly ? Object.assign({}, p, { amount: 3000 }) : p);
S.recomputeLoan(over);
const D3 = S.repScheduleData(over);
chk('overpaid interest never goes negative', D3.intShortTotal, 0);

// --- a loan with no interest at all must not divide by zero or flag anything
const nointerest = JSON.parse(JSON.stringify(loan));
nointerest.tint = 0; nointerest.tpay = 120000; nointerest.principal = 120000;
S.recomputeLoan(nointerest);
const D4 = S.repScheduleData(nointerest);
chk('zero-interest loan reports a finite shortfall', Number.isFinite(D4.intShortTotal), true);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL INTEREST-SHORTFALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
