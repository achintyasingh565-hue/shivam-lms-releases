// "It should never be 4,62,000 — it is an interest loan, principal untouched."
//
// On an interest-only loan (byaj), the borrower services the monthly interest
// and the principal stands until he returns it. So the outstanding must sit at
// the principal (plus any charges) no matter how many interest payments have
// been received. It must never amortise down.
//
// These checks run the REAL recomputeLoan() out of the source, on both paths,
// and pin down exactly which one can produce a figure below the principal.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '08-certificate.js'), 'utf8');
const helpers = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '02-helpers-nav.js'), 'utf8');
function extract(s, name) {
  const i = s.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let b = s.indexOf('{', i), d = 0;
  for (let j = b; j < s.length; j++) {
    if (s[j] === '{') d++;
    else if (s[j] === '}' && --d === 0) return s.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}

const TODAY = '2026-10-29';
const ctx = {
  todayISO: () => TODAY,
  Math, Number, String, Array, Object, Date, JSON, isNaN, parseInt, parseFloat, console,
};
vm.createContext(ctx);
vm.runInContext([
  extract(helpers, 'repPad'),
  extract(helpers, 'repAddMonths'),
  extract(src, 'emiDueDate'),
  extract(src, 'calcLoanTotals'),
  extract(src, '_recomputeInterestOnly'),
  extract(src, 'recomputeLoan'),
  extract(src, 'monthlyInterestOf'),
].join('\n'), ctx);

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
function note(l, v) { console.log('      ' + l + ' = ' + JSON.stringify(v)); }

const P = 500000;
const pay = (date, amount, extra) =>
  Object.assign({ pid: 'p' + date, date, mode: 'Cash', amount, status: 'Cleared' }, extra || {});

// Eight months of interest serviced at 2% of 5,00,000 = 10,000 a month.
const interestMonths = [];
for (let m = 2; m <= 9; m++) interestMonths.push(pay('2026-' + String(m).padStart(2, '0') + '-09', 10000));

function ioLoan(over) {
  return Object.assign({
    id: 'L287', name: 'Mr. Dinesh Chandra Mishra', acno: '16287',
    interestOnly: true, principal: P, rate: 2, tenure: 0,
    disb: '2026-01-09', due: '2026-02-09',
    payments: interestMonths.slice(), charges: [],
  }, over || {});
}

// --- 1. the rule: interest payments never touch the principal
let l = ioLoan();
ctx.recomputeLoan(l);
note('outstanding after 8 interest payments', l.outstanding);
chk('outstanding stays at the principal', l.outstanding, P);
chk('  it is never the amortised figure', l.outstanding === 462000, false);
chk('the monthly due is the interest, not an EMI', l.emi, 10000);
chk('total ultimately owed is the principal', l.tpay, P);
chk('no notional interest is added to the debt', l.tint, 0);

// --- 2. however many interest payments arrive, the principal holds
const many = ioLoan({ payments: [] });
for (let k = 0; k < 40; k++) many.payments.push(pay('2026-0' + ((k % 9) + 1) + '-09', 10000));
ctx.recomputeLoan(many);
chk('forty interest payments still leave the principal intact', many.outstanding, P);

// --- 3. charges add to the debt; they never net off the principal
const withFee = ioLoan({ charges: [{ id: 'c1', type: 'Late fee', amount: 2000, date: '2026-09-15' }] });
ctx.recomputeLoan(withFee);
chk('a charge is added on top of the principal', withFee.outstanding, P + 2000);

// --- 4. only an explicit principal repayment moves the balance
const partRepaid = ioLoan();
partRepaid.payments = partRepaid.payments.concat([pay('2026-10-01', 100000, { kind: 'principal' })]);
ctx.recomputeLoan(partRepaid);
chk('a payment tagged as principal reduces the balance', partRepaid.outstanding, P - 100000);

const fullyRepaid = ioLoan();
fullyRepaid.payments = fullyRepaid.payments.concat([pay('2026-10-01', P, { kind: 'principal' })]);
ctx.recomputeLoan(fullyRepaid);
chk('returning the whole principal closes the loan', fullyRepaid.status, 'Closed');
chk('  and clears the balance', fullyRepaid.outstanding, 0);

// --- 5. WHERE 4,62,000 COMES FROM.
// The interest-only path can only ever yield (principal - principal repaid + charges).
// It cannot produce a figure between 0 and the principal without a kind:'principal'
// payment. The amortising path can, because it subtracts every untagged payment.
// Same loan, same payments, flag OFF:
const notFlagged = ioLoan({ interestOnly: false });
notFlagged.tpay = P;                 // what an un-flagged record of this loan carries
notFlagged.emi = 10000;
notFlagged.tenure = 50;
ctx.recomputeLoan(notFlagged);
note('same payments with the interest-only flag OFF', notFlagged.outstanding);
chk('with the flag off the principal is eaten away', notFlagged.outstanding, P - 80000);
chk('  i.e. below the principal, which is the reported symptom',
  notFlagged.outstanding < P, true);

// and tagging the payments correctly protects the principal even on that path
const taggedOnAmortising = ioLoan({ interestOnly: false });
taggedOnAmortising.tpay = P; taggedOnAmortising.emi = 10000; taggedOnAmortising.tenure = 50;
taggedOnAmortising.payments = taggedOnAmortising.payments.map(p =>
  Object.assign({}, p, { intOnly: true, type: 'Interest' }));
ctx.recomputeLoan(taggedOnAmortising);
chk('payments ticked "interest only" protect the principal on either path',
  taggedOnAmortising.outstanding, P);

// --- 6. the arrears are unpaid INTEREST, never the principal
const behind = ioLoan({ payments: [] });        // nothing serviced since January
ctx.recomputeLoan(behind);
note('arrears with nothing serviced', behind.arrears);
chk('an unserviced interest-only loan is Overdue', behind.status, 'Overdue');
chk('  the arrears are interest only, not the principal', behind.arrears < P, true);
chk('  and the principal is still the balance', behind.outstanding, P);

// Nine months have elapsed since the 09-01-2026 disbursement, so a borrower is
// only up to date once NINE months of interest are in -- the eight-payment
// fixture above is genuinely one month short, and is correctly Overdue.
const current = ioLoan({ payments: interestMonths.concat([pay('2026-10-09', 10000)]) });
ctx.recomputeLoan(current);
chk('a fully serviced interest-only loan is Active, not Overdue', current.status, 'Active');
chk('  with no arrears', current.arrears, 0);
chk('  and the principal still standing in full', current.outstanding, P);
chk('the eight-payment loan is one month short, hence Overdue', l.status, 'Overdue');
chk('  by exactly one month of interest', l.arrears, 10000);

// ---------------------------------------------------------------------------
// Reported: Sandeep Jaiswal's byaj loan of 2,00,000 was paid in full through
// the Payments tab, but the loan stayed Active showing the whole principal.
//
// Cause: the engine only counts a payment against the principal when it is
// tagged kind:'principal', and nothing in the Payments tab could write that
// tag. An untagged payment was therefore treated as interest income.
console.log('\n--- returning the principal ---');

const sj = () => ({
  id: 'L-SJ', name: 'Sandeep Jaiswal', acno: 'SE-2627-0006',
  interestOnly: true, principal: 200000, rate: 2, tenure: 0,
  disb: '2026-10-22', due: '2026-11-25', payments: [], charges: [],
});

// the payment exactly as the Payments tab used to record it -- no tag
const untagged = sj();
untagged.payments = [pay('2026-10-29', 200000)];
ctx.recomputeLoan(untagged);
note('untagged payment -> outstanding', untagged.outstanding);
chk('an untagged payment is still treated as interest, not principal',
  untagged.outstanding, 200000);
chk('  which is why the loan stayed Active', untagged.status !== 'Closed', true);

// the same payment with the new tick
const tagged = sj();
tagged.payments = [pay('2026-10-29', 200000, { kind: 'principal' })];
ctx.recomputeLoan(tagged);
chk('marked as a principal repayment, the balance clears', tagged.outstanding, 0);
chk('  and the loan closes', tagged.status, 'Closed');

// a part return moves the balance by exactly that much and keeps it open
const part = sj();
part.payments = [pay('2026-10-29', 75000, { kind: 'principal' })];
ctx.recomputeLoan(part);
chk('a part return reduces the principal by that amount', part.outstanding, 125000);
chk('  and the loan stays open', part.status !== 'Closed', true);

// two part returns adding up to the whole principal close it
const twice = sj();
twice.payments = [pay('2026-10-29', 75000, { kind: 'principal' }),
                  pay('2026-11-29', 125000, { kind: 'principal' })];
ctx.recomputeLoan(twice);
chk('part returns totalling the principal close the loan', twice.status, 'Closed');
chk('  with nothing outstanding', twice.outstanding, 0);

// THE SAFETY PROPERTY: interest payments must never be mistaken for principal.
// Treating untagged payments as principal would have wiped the balance of
// every byaj loan whose monthly interest was entered without the interest tick.
const serviced = sj();
serviced.payments = [];
for (let m = 1; m <= 6; m++) serviced.payments.push(pay('2026-' + String(m).padStart(2, '0') + '-22', 4000));
ctx.recomputeLoan(serviced);
chk('six months of interest leave the principal untouched', serviced.outstanding, 200000);

// interest and a principal return side by side
const mixed = sj();
mixed.payments = [pay('2026-11-22', 4000, { intOnly: true, type: 'Interest' }),
                  pay('2026-11-29', 200000, { kind: 'principal' })];
ctx.recomputeLoan(mixed);
chk('interest alongside a principal return still closes the loan', mixed.status, 'Closed');
chk('  and the interest is not double-counted against the principal', mixed.outstanding, 0);

// an uncleared principal payment must not close anything
const pending = sj();
pending.payments = [Object.assign(pay('2026-10-29', 200000, { kind: 'principal' }), { status: 'Pending' })];
ctx.recomputeLoan(pending);
chk('a pending principal payment does not close the loan', pending.outstanding, 200000);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL INTEREST-ONLY PRINCIPAL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
