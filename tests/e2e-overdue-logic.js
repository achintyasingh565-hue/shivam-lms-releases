// Overdue / late-fee / interest rules (the lender's model):
//  - a month with NOTHING paid  -> late fee + that month's overdue interest (byaj)
//  - a month paid INTEREST-ONLY -> serviced, EMI defers, NO late fee, NO overdue interest
//  - a month PARTIALLY paid     -> late fee, remainder pending, NO overdue interest
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const R = await p.evaluate(() => {
    const addM = (iso, n) => { const d = new Date(iso); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
    const disb = addM(todayISO(), -20);           // ended ~8 months ago
    // 6 EMIs paid on time; month7 nothing; month8 interest-only; month9 partial; rest nothing.
    const monthInt = Math.round(14992 / 12);      // fixed flat monthly interest ~1249
    const pays = [];
    for (let i = 1; i <= 6; i++) pays.push({ date: addM(disb, i), amount: 5416, status: 'Cleared', mode: 'Cash' });
    pays.push({ date: addM(disb, 8), amount: monthInt, status: 'Cleared', mode: 'Cash', intOnly: true, type: 'Interest' });
    pays.push({ date: addM(disb, 9), amount: 2000, status: 'Cleared', mode: 'Cash' });
    window.confirm = () => true;
    loans.splice(0, loans.length, { id: 'OL', name: 'Overdue Logic', acno: 'SE-OL', phone: '9800000000',
      principal: 50000, rate: 2.5, tenure: 12, tint: 14992, tpay: 64992, emi: 5416, disb, payments: pays, charges: [] });
    recomputeLoan(loans[0]);
    applyLateFees('OL');
    const l = loans[0];
    const chg = t => (l.charges || []).filter(c => c.type === t);
    const D = repScheduleData(l);
    // Rows are keyed by CALENDAR MONTH now (deferrals push installments forward), so find each
    // special month by its date rather than by an installment number.
    const mkey = (i) => addM(disb, i).slice(0, 7);
    const rowInMonth = (i) => D.rows.find(r => r.due && String(r.due).slice(0, 7) === mkey(i) && !r.isInt);
    const intRowInMonth = (i) => D.rows.find(r => r.due && String(r.due).slice(0, 7) === mkey(i) && r.isInt);
    const nothing = rowInMonth(7) || {};      // fully-missed month → Deferred row
    const intOnly = intRowInMonth(8) || {};   // interest-only month → its own interest row
    const partial = rowInMonth(9) || {};      // partial payment month
    return {
      monthInt,
      lateCount: chg('Late fee').length,
      intCount: chg('Overdue interest').length,
      nothing_isMissed: !!nothing.missed,
      nothing_lateFee: nothing.lateFee, nothing_intFee: nothing.intFee,
      intOnly_found: !!intRowInMonth(8),
      intOnly_lateFee: intOnly.lateFee || 0, intOnly_intFee: intOnly.intFee || 0,
      partial_lateFee: partial.lateFee, partial_intFee: partial.intFee, partial_due: partial.dueAmt, partial_paid: partial.paid,
      lastBal: D.rows.filter(r => !r.isInt).slice(-1)[0].bal, outstanding: Number(l.outstanding) || 0,
      hasInterestRow: D.rows.some(r => r.isInt),
    };
  });

  const checks = {
    'missed month: Deferred with late fee + interest': R.nothing_isMissed === true && R.nothing_lateFee === 500 && R.nothing_intFee === R.monthInt,
    'interest-only month: no late fee, no interest': R.intOnly_found === true && R.intOnly_lateFee === 0 && R.intOnly_intFee === 0,
    'interest-only shows as its own row':           R.hasInterestRow === true,
    'partial month: late fee but NO overdue interest': R.partial_lateFee === 500 && R.partial_intFee === 0,
    'partial month: remainder left pending':        R.partial_paid === 2000 && R.partial_due === 3416,
    'schedule balance reconciles with outstanding': Math.abs(R.lastBal - R.outstanding) < 1,
    'no page errors':                               errs.length === 0,
  };
  console.log('\n===== OVERDUE / LATE-FEE / INTEREST RULES =====');
  console.log('  state:', JSON.stringify(R));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs.slice(0, 5));
  console.log('\n  ' + (bad === 0 ? '✅ OVERDUE INTEREST/LATE-FEE LOGIC MATCHES THE LENDER MODEL' : '❌ ' + bad + ' PROBLEM(S)') + '\n');
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
