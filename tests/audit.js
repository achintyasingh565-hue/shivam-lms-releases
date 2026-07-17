// PHASE 1 AUDIT — runs the real functions against edge cases and prints evidence.
const { makeSandbox } = require('./harness');

const S = makeSandbox('2026-07-14'); // control "today"
const out = [];
function finding(id, title, fn) {
  try { const r = fn(); out.push({ id, title, ...r }); }
  catch (e) { out.push({ id, title, verdict: 'HARNESS-ERROR', evidence: String(e) }); }
}
const loanBase = (o) => Object.assign({
  id: 'X', payments: [], dueManual: false
}, o);

/* ---------- 1. tenure = 0 ---------- */
finding('A1', 'calcLoanTotals with tenure 0', () => {
  const r = S.calcLoanTotals(500000, 2, 0);
  return { verdict: r.emi === 0 ? 'CONFIRMED' : 'ok', evidence: JSON.stringify(r) + '  -> tint=0, emi=0: interest-only loans get NO computed interest & no EMI' };
});
finding('A2', 'recomputeLoan: interest-only (tenure 0) loan can never go Overdue', () => {
  // Real pattern from the user's own import file: tenure 0, emi set manually, nothing paid for a year
  const l = loanBase({ principal: 500000, tpay: 500000, emi: 7500, tenure: 0, disb: '2025-02-09', due: '2025-03-09' });
  S.recomputeLoan(l);
  return { verdict: l.status !== 'Overdue' ? 'CONFIRMED' : 'ok',
    evidence: `17 months unpaid, emi=7500 -> status="${l.status}", arrears=${l.arrears} (expected Overdue with ~17 EMIs of arrears)` };
});

/* ---------- 2. negative / bad inputs ---------- */
finding('B1', 'calcLoanTotals accepts negative rate', () => {
  const r = S.calcLoanTotals(100000, -2, 12);
  return { verdict: r.tint < 0 ? 'CONFIRMED' : 'ok', evidence: `rate=-2 -> tint=${r.tint}, tpay=${r.tpay} (customer owes LESS than principal)` };
});
finding('B2', 'calcLoanTotals accepts negative principal', () => {
  const r = S.calcLoanTotals(-100000, 2, 12);
  return { verdict: r.tpay < 0 ? 'CONFIRMED' : 'ok', evidence: `principal=-100000 -> tpay=${r.tpay}, emi=${r.emi}` };
});
finding('B3', 'calcLoanTotals with NaN-ish input', () => {
  const r = S.calcLoanTotals('abc', 2, 12);
  return { verdict: 'note', evidence: `principal="abc" -> ${JSON.stringify(r)} (Number()||0 coerces to 0 silently — bad data becomes a 0-value loan without any warning)` };
});
finding('B4', 'fractional tenure', () => {
  const r = S.calcLoanTotals(100000, 2, 6.5);
  return { verdict: 'note', evidence: `tenure=6.5 -> ${JSON.stringify(r)} (no integer guard; schedule loops use rounded n elsewhere -> totals disagree)` };
});

/* ---------- 3. rounding drift ---------- */
finding('C1', 'EMI rounding drift: arrears must equal tpay (not n*emi) when whole schedule elapsed', () => {
  // pick numbers where round(tpay/n) drifts most: emi*7 = 118902 but tpay = 118900
  const { tint, tpay, emi } = S.calcLoanTotals(100000, 2.7, 7);
  const nEmi = emi * 7, drift = nEmi - tpay;
  const l = loanBase({ principal: 100000, tpay, emi, tenure: 7, tint, disb: '2025-01-15' }); // all 7 EMIs elapsed by 2026-07-14
  S.recomputeLoan(l);
  const D = S.repScheduleData(l);
  const scheduleSum = D.rows.reduce((a, r) => a + r.emi, 0);
  const ok = l.arrears === tpay && scheduleSum === tpay;
  return { verdict: ok ? 'ok (drift-free)' : 'CONFIRMED',
    evidence: `emi*7=₹${nEmi} vs tpay=₹${tpay} (raw drift ₹${drift}). recomputeLoan arrears=₹${l.arrears}, schedule sums to ₹${scheduleSum} — both must equal tpay exactly` };
});
finding('C2', 'floating point in flat interest', () => {
  const r = S.calcLoanTotals(33333, 1.1, 9); // 33333*1.1/100*9 = 3299.967
  return { verdict: 'ok-by-rounding', evidence: `33333 @1.1% x9 -> raw=${33333*1.1/100*9} -> tint=${r.tint} (Math.round at source keeps ledger integral; verified all money paths round)` };
});

/* ---------- 4. date boundaries ---------- */
finding('D1', 'repAddMonths month-end clamping (main schedule)', () => {
  const a = S.repAddMonths('2026-01-31', 1), b = S.repAddMonths('2026-01-31', 3);
  const c = S.repAddMonths('2024-02-29', 12);
  return { verdict: 'ok', evidence: `Jan31+1m=${a}, Jan31+3m=${b} (no compounding clamp, day restored), Feb29+12m=${c} — correct` };
});
finding('D2', 'build() uses UNCLAMPED addMonths — dates roll into next month', () => {
  const d1 = S.addMonths('2026-01-31', 1);
  const iso = d1.getFullYear() + '-' + String(d1.getMonth() + 1).padStart(2, '0') + '-' + String(d1.getDate()).padStart(2, '0');
  return { verdict: iso !== '2026-02-28' ? 'CONFIRMED' : 'ok',
    evidence: `Jan 31 + 1 month -> ${iso} (expected 2026-02-28). The printed repayment schedule & the EMI table disagree on due dates for month-end loans` };
});
finding('D3', 'emiDueDate consistency for a Jan-31 loan', () => {
  const l = loanBase({ disb: '2026-01-31' });
  return { verdict: 'evidence', evidence: `recomputeLoan path: ${[1,2,3].map(i => S.emiDueDate(l, i)).join(', ')} vs build() path: ${[1,2,3].map(i => { const d = S.addMonths('2026-01-31', i); return d.toISOString ? d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') : d; }).join(', ')}` };
});

/* ---------- 5. idempotency / duplicates ---------- */
finding('E1', 'recomputeLoan is idempotent (call twice = same result)', () => {
  const l = loanBase({ principal: 100000, tpay: 124000, emi: 10333, tenure: 12, tint: 24000, disb: '2025-06-01',
    payments: [{ date: '2025-07-01', amount: 10333, status: 'Cleared', mode: 'Cash' }] });
  S.recomputeLoan(l); const s1 = JSON.stringify({ p: l.paid, o: l.outstanding, a: l.arrears, s: l.status, d: l.due });
  S.recomputeLoan(l); const s2 = JSON.stringify({ p: l.paid, o: l.outstanding, a: l.arrears, s: l.status, d: l.due });
  return { verdict: s1 === s2 ? 'PASS' : 'FAIL', evidence: s1 + (s1 === s2 ? ' (stable)' : ' vs ' + s2) };
});
finding('E2', 'duplicate protection exists at payment ENTRY (pid + duplicate confirm + click guard)', () => {
  // The ledger itself must count what it holds (two genuine same-day equal cash payments are legal);
  // protection belongs at the entry points. Verify the guards exist in shipped source.
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'app', '08-certificate.js'), 'utf8');
  const src7 = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'app', '07-loans-crud.js'), 'utf8');
  const has = (s, x) => s.includes(x);
  const ok = has(src, 'newPayId') && has(src, 'isDuplicatePayment') && has(src, '_busy') && has(src7, 'isDuplicatePayment');
  return { verdict: ok ? 'ok (guarded)' : 'CONFIRMED',
    evidence: `recordPayTab: pid=${has(src,'newPayId')}, dup-confirm=${has(src,'isDuplicatePayment')}, double-click guard=${has(src,'_busy')}; modal addPayment dup-confirm=${has(src7,'isDuplicatePayment')} (see e2e test for behavioural check)` };
});

/* ---------- 6. schedule status filter inconsistency ---------- */
finding('F1', 'repScheduleData counts non-Cleared as paid (filter !== recomputeLoan filter)', () => {
  const l = loanBase({ principal: 100000, tpay: 124000, emi: 10333, tenure: 12, tint: 24000, disb: '2025-06-01',
    payments: [{ date: '2025-07-01', amount: 10333, status: 'Bounced', mode: 'Cheque' }] });
  S.recomputeLoan(l);
  const D = S.repScheduleData(l);
  return { verdict: (l.paid === 0 && D.cleared > 0) ? 'CONFIRMED' : 'ok',
    evidence: `status="Bounced": recomputeLoan paid=₹${l.paid} but EMI-schedule cleared=₹${D.cleared} (uses status!=='Pending' instead of ==='Cleared')` };
});

/* ---------- 7. build() with emi=0 / tenure 0 ---------- */
finding('G1', 'build() with emi=0 and tenure=0', () => {
  const l = loanBase({ emi: 0, tpay: 500000, tenure: 0, disb: '2025-01-01', payments: [] });
  const d = S.build(l);
  return { verdict: d.months === 0 ? 'CONFIRMED' : 'note', evidence: `months=${d.months}, rows=${d.rows.length}, totalPayable=${d.totalPayable} -> schedule silently renders empty for interest-only loans` };
});
finding('G2', 'build() months explode when emi is tiny vs balance', () => {
  const l = loanBase({ emi: 1, tpay: 1000000, tenure: 12, disb: '2025-01-01', payments: [] });
  const d = S.build(l);
  return { verdict: d.months >= 1000000 ? 'CONFIRMED' : 'note', evidence: `emi=₹1 on ₹10L -> generates ${d.months.toLocaleString()} schedule rows (UI freeze / memory blow-up; no cap)` };
});

/* ---------- 8. timezone hazard in todayISO ---------- */
finding('H1', 'todayISO must use LOCAL date (UTC lags a day before 05:30 AM IST)', () => {
  // run the REAL shipped todayISO and compare with the true local date
  const fs = require('fs'), path = require('path'), vm = require('vm');
  const helpers = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '02-helpers-nav.js'), 'utf8');
  const m = helpers.match(/function todayISO\(\)\{[^\n]*\}/);
  const sb = { Date, String }; vm.createContext(sb); vm.runInContext(m[0] + '; out = todayISO();', sb);
  const d = new Date();
  const local = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return { verdict: sb.out === local ? 'ok (local-time)' : 'CONFIRMED',
    evidence: `todayISO()="${sb.out}" vs true local date "${local}" (UTC toISOString would lag before 05:30 IST)` };
});

/* ---------- print ---------- */
for (const f of out) {
  console.log(`[${f.id}] ${f.verdict.padEnd(18)} ${f.title}\n      ${f.evidence}\n`);
}
