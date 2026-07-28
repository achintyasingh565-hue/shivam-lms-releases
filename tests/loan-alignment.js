// Loan-record ALIGNMENT sweep.
// Exhaustively runs the real recomputeLoan over every combination of record shape
// (principal / rate / tenure / disbursement in past & future / no–partial–full–over
// payments / bounce & late charges / auto & manual due dates) and asserts the
// invariants that keep a record "aligned". This is the machine version of
// "check every loan record and find anything broken or not aligned".
const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-07-14'); // fixed "today"

const principals = [50000, 100000, 250000];
const rates = [0, 1.5, 2, 3];
const tenures = [0, 1, 6, 12, 24];
const disbs = ['2024-01-15', '2025-01-31', '2026-06-01', '2027-03-05']; // past…future vs today
const payModes = ['none', 'partial', 'exact', 'over'];
const chargeModes = ['none', 'bounce', 'late', 'both'];
const dueModes = ['auto', 'manual-after', 'manual-before'];

function buildPayments(mode, emi, tpay, disb) {
  if (mode === 'none' || emi <= 0) return [];
  const one = (n) => ({ date: disb, amount: n, status: 'Cleared', mode: 'Cash' });
  if (mode === 'partial') return [one(emi), one(emi)];
  if (mode === 'exact') return [one(tpay)];
  if (mode === 'over') return [one(tpay + 25000)];
  return [];
}
function buildCharges(mode) {
  const c = [];
  if (mode === 'bounce' || mode === 'both') c.push({ id: 'b', type: 'Cheque bounce', amount: 500, date: '2026-01-01' });
  if (mode === 'late' || mode === 'both') c.push({ id: 'l', type: 'Late fee', amount: 300, date: '2026-01-01' });
  return c;
}

let total = 0, failures = [];
function check(cond, tag, l) { if (!cond) failures.push({ tag, rec: { disb: l.disb, tenure: l.tenure, emi: l.emi, dueManual: l.dueManual, due: l.due, status: l.status, out: l.outstanding } }); }

for (const p of principals)
for (const r of rates)
for (const n of tenures)
for (const disb of disbs)
for (const pm of payModes)
for (const cm of chargeModes)
for (const dm of dueModes) {
  const t = S.calcLoanTotals(p, r, n);
  // starting due for each mode
  let due, dueManual = false;
  if (dm === 'auto') { due = ''; dueManual = false; }
  else if (dm === 'manual-after') { due = '2028-12-01'; dueManual = true; }   // far after disb
  else { due = '2023-01-01'; dueManual = true; }                              // BEFORE every disb
  const l = {
    id: 'X', principal: p, rate: r, tenure: n, tint: t.tint, tpay: t.tpay, emi: t.emi,
    disb, due, dueManual, payments: buildPayments(pm, t.emi, t.tpay, disb), charges: buildCharges(cm)
  };
  S.recomputeLoan(l);
  total++;

  // ---- invariants ----
  check(l.outstanding >= 0, 'outstanding-negative', l);
  check(['Active', 'Overdue', 'Closed'].includes(l.status), 'bad-status', l);
  // closed iff nothing left owed (with a real contract)
  if (l.tpay > 0) check(!(l.outstanding <= 0) || l.status === 'Closed', 'zero-out-not-closed', l);
  if (l.status === 'Closed') check(l.outstanding <= 0, 'closed-with-balance', l);
  // AUTO due, when set, must be on/after the disbursement (the reported-bug guard).
  if (!l.dueManual && l.due) check(l.due >= l.disb, 'auto-due-before-disb', l);
  // A live (non-closed) auto loan with EMIs must always carry a valid next due >= disb.
  if (!l.dueManual && l.emi > 0 && l.disb && l.status !== 'Closed') {
    check(l.due && l.due >= l.disb, 'active-auto-missing-due', l);
  }
  // MANUAL due must be preserved exactly (never rewritten by recompute)
  if (l.dueManual) check(l.due === due, 'manual-due-rewritten', l);
  // Cheque-bounce fees (only) must be added to what is owed, unless fully cleared.
  // (Late fees are informational per the contract and intentionally not auto-added.)
  if ((cm === 'bounce' || cm === 'both') && l.tpay > 0 && l.outstanding > 0) {
    const feeSum = 500; // the single bounce charge
    const l2 = Object.assign({}, l, { charges: [], outstanding: undefined, status: undefined, due: dm === 'auto' ? '' : due, dueManual });
    S.recomputeLoan(l2);
    check(l.outstanding === l2.outstanding + feeSum || l2.outstanding <= 0, 'bounce-fee-not-in-outstanding', l);
  }
  // idempotency: recomputing again changes nothing
  const before = JSON.stringify({ o: l.outstanding, s: l.status, d: l.due });
  S.recomputeLoan(l);
  check(JSON.stringify({ o: l.outstanding, s: l.status, d: l.due }) === before, 'not-idempotent', l);
}

console.log('records swept:', total);
if (failures.length) {
  console.log('ALIGNMENT FAILURES:', failures.length);
  // print a few representative failures per tag
  const byTag = {};
  failures.forEach(f => { (byTag[f.tag] = byTag[f.tag] || []).push(f.rec); });
  Object.keys(byTag).forEach(t => console.log('  •', t, '×', byTag[t].length, '  e.g.', JSON.stringify(byTag[t][0])));
  process.exitCode = 1;
} else {
  console.log('ALL', total, 'RECORD SHAPES ALIGNED — no broken invariants');
  process.exitCode = 0;
}
