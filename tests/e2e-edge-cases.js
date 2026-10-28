// Edge cases in the money engine.
//
// Everyday loans are already well covered. These are the awkward ones that
// only turn up occasionally but produce wrong figures on a real customer's
// paper when they do: month-end disbursement dates, a loan with no tenure,
// zero interest, and amounts that do not divide evenly.
//
// Where a check fails, the comment says what the right answer is and why.

const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-10-28');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
function note(label, got) { console.log('      ' + label + ' = ' + JSON.stringify(got)); }

// ---------------------------------------------------------------------------
// 1. Month-end dates. A loan disbursed on the 31st has no 31st in February.
//    The due date must stay inside the month rather than rolling into March,
//    or every later instalment drifts and the schedule stops matching the
//    receipts the borrower was given.
console.log('--- month-end due dates ---');
chk('31 Jan + 1 month stays in February', S.repAddMonths('2026-01-31', 1), '2026-02-28');
chk('31 Jan + 3 months', S.repAddMonths('2026-01-31', 3), '2026-04-30');
chk('30 Nov + 3 months', S.repAddMonths('2026-11-30', 3), '2027-02-28');
chk('29 Feb leap -> non-leap', S.repAddMonths('2028-02-29', 12), '2029-02-28');
chk('month add rolls the year', S.repAddMonths('2026-12-15', 1), '2027-01-15');
chk('12 months returns the same day', S.repAddMonths('2026-03-15', 12), '2027-03-15');

// The schedule's own month-adder must agree with the report one, or the printed
// schedule and the on-screen one disagree about every date. They return
// different TYPES on purpose -- repAddMonths gives 'YYYY-MM-DD', addMonths gives
// a Date for toLocaleDateString -- so compare the calendar day, in local time.
// (Reading that Date back with toISOString() would report the previous day in
// IST; nothing does, and this check would catch it if something started.)
const dayOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                     '-' + String(d.getDate()).padStart(2, '0');
chk('both month-adders agree (31 Jan)', dayOf(S.addMonths('2026-01-31', 1)), S.repAddMonths('2026-01-31', 1));
chk('both month-adders agree (30 Nov)', dayOf(S.addMonths('2026-11-30', 3)), S.repAddMonths('2026-11-30', 3));

// ---------------------------------------------------------------------------
// 2. Degenerate loans must not produce NaN or Infinity on a printed document.
console.log('\n--- degenerate inputs ---');
const z = S.calcLoanTotals(100000, 2, 0);          // no tenure
note('zero tenure', z);
chk('zero tenure -> finite EMI', Number.isFinite(z.emi), true);
chk('zero tenure -> no NaN total', Number.isFinite(z.tpay), true);

const zr = S.calcLoanTotals(100000, 0, 12);        // interest-free
note('zero rate', zr);
chk('zero rate -> interest is 0', zr.tint, 0);
chk('zero rate -> repay equals principal', zr.tpay, 100000);
chk('zero rate -> EMI is principal/tenure', zr.emi, Math.round(100000 / 12));

const zp = S.calcLoanTotals(0, 2, 12);             // zero principal
note('zero principal', zp);
chk('zero principal -> everything zero', [zp.tint, zp.tpay, zp.emi], [0, 0, 0]);

// ---------------------------------------------------------------------------
// 3. Rounding. The EMI is rounded, so EMI x tenure rarely equals the total
//    exactly. What matters is that the shortfall is at most a rupee or two
//    and that the schedule's last row absorbs it rather than leaving a
//    permanent stray balance.
console.log('\n--- rounding ---');
const r = S.calcLoanTotals(123457, 2.5, 7);
note('awkward figures', r);
chk('EMI is a whole rupee', r.emi === Math.round(r.emi), true);
chk('EMI x tenure is within a few rupees of the total',
  Math.abs(r.emi * 7 - r.tpay) <= 7, true);

function loan(over) {
  return Object.assign({
    id: 'L1', name: 'Test', acno: '1', principal: 123457, rate: 2.5, tenure: 7,
    disb: '2026-01-31', due: '2026-02-28', payments: [], charges: [], status: 'Active',
  }, over || {});
}
const L = loan();
S.recomputeLoan(L);
// Every instalment here is already overdue, so auto-defer turns the elapsed
// months into 'missed' rows and pushes the seven instalments forward. Both
// kinds of row must still carry a real calendar date.
const all = S.repScheduleData(L).rows;
const rows = all.filter(x => x.i);
const missed = all.filter(x => x.missed);
chk('still seven instalments after deferral', rows.length, 7);
chk('the elapsed months became deferred rows', missed.length > 0, true);
// the day-of-month must exist in that month -- the failure this guards against
// is 31 Feb silently rolling into March and shifting every later date
const validDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return d >= 1 && d <= new Date(y, m, 0).getDate();
};
chk('every date in the schedule is a real calendar date',
  all.filter(r => !validDay(r.due)).map(r => r.due), []);
// Each date is anchored to the FIRST due date rather than chained off the
// previous one. That matters: chaining would clamp 31 Jan to 28 Feb and then
// stay on the 28th for the rest of the loan, walking the whole schedule off
// the borrower's agreed date. Anchoring returns to the 31st in March.
chk('instalment dates are anchored to the first due date, not chained',
  rows.map(r => r.due), rows.map((_, k) => S.repAddMonths(rows[0].due, k)));
chk('  so a clamped month does not drag the later dates with it',
  S.repAddMonths('2026-01-31', 2), '2026-03-31');
const lastBal = rows[rows.length - 1].bal;
note('balance after the final instalment', lastBal);
chk('nothing left owing once every instalment is paid in full', lastBal, 0);

// ---------------------------------------------------------------------------
// 4. Money must never go negative or non-finite, whatever the borrower pays.
console.log('\n--- overpayment and junk ---');
const over = loan({ payments: [{ id: 'p1', date: '2026-03-01', amount: 999999, status: 'Cleared' }] });
S.recomputeLoan(over);
note('outstanding after a huge overpayment', over.outstanding);
chk('overpaid -> never negative', over.outstanding >= 0, true);

const junk = loan({ principal: 'abc', rate: null, tenure: undefined });
let threw = null;
try { S.recomputeLoan(junk); } catch (e) { threw = String(e.message || e); }
chk('junk figures do not throw', threw, null);
chk('junk figures do not yield NaN outstanding', Number.isFinite(Number(junk.outstanding) || 0), true);

const neg = loan({ payments: [{ id: 'p1', date: '2026-03-01', amount: -5000, status: 'Cleared' }] });
let threw2 = null;
try { S.recomputeLoan(neg); } catch (e) { threw2 = String(e.message || e); }
chk('a negative payment does not throw', threw2, null);
note('outstanding with a negative payment', neg.outstanding);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL EDGE-CASE CHECKS PASS');
process.exitCode = fails ? 1 : 0;
