// Extended EMI schedule: when a loan runs past its tenure, the schedule keeps going month by
// month, a payment made AFTER the tenure lands on its own row (not lost as an "advance"), the
// running balance reconciles exactly with the loan's outstanding (so the schedule and the
// customer statement agree), and a month missed DURING the tenure stays flagged (not back-filled).
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
    const today = todayISO();
    const disb = addM(today, -20);                 // disbursed 20 months ago → 12-mo tenure ended 8 months ago
    // ₹50,000 @ 2.5% flat, 12 × ₹5,416. Pay months 1–8 on time; miss 9–12; then a ₹3,000
    // catch-up payment 14 months after disbursement (2 months past the tenure).
    const pays = [];
    for (let i = 1; i <= 8; i++) pays.push({ date: addM(disb, i), amount: 5416, status: 'Cleared', mode: 'Cash' });
    pays.push({ date: addM(disb, 14), amount: 3000, status: 'Cleared', mode: 'Cash' });   // post-tenure
    loans.splice(0, loans.length, { id: 'EX', name: 'Extend Test', acno: 'SE-EXT1', phone: '9800000000',
      type: 'Personal', principal: 50000, rate: 2, tenure: 12, tint: 14992, tpay: 64992, emi: 5416, disb, payments: pays, charges: [] });
    recomputeLoan(loans[0]);
    const l = loans[0];
    const D = repScheduleData(l);
    const nonInt = D.rows.filter(r => !r.isInt);
    const last = nonInt[nonInt.length - 1];
    const paidRows = nonInt.reduce((a, r) => a + (Number(r.paid) || 0), 0);
    const postRow = D.rows.find(r => r.ext && r.paid > 0);
    // an in-tenure missed month (#9) must still be flagged, not back-filled by the catch-up
    const missed9 = nonInt.find(r => r.i === 9);
    return {
      extCount: D.extCount,
      cleared: D.cleared,
      outstanding: Number(l.outstanding) || 0,
      lastBal: last ? last.bal : null,
      paidRowsPlusAdvance: paidRows + D.advance,
      advance: D.advance,
      postRow: postRow ? { i: postRow.i, paid: postRow.paid } : null,
      missed9St: missed9 ? missed9.st : null,
    };
  });

  const checks = {
    'schedule extends past the 12-month tenure':        R.extCount > 0,
    'post-tenure payment shows on its own ext row':      !!R.postRow && R.postRow.paid === 3000,
    'no phantom advance (payment is on the schedule)':   R.advance === 0,
    'final balance == loan outstanding (reconciles)':    Math.abs(R.lastBal - R.outstanding) < 1,
    'rows paid == total cleared (matches statement)':    Math.abs(R.paidRowsPlusAdvance - R.cleared) < 1,
    'missed in-tenure month #9 stays Overdue':           R.missed9St === 'Overdue',
    'no page errors':                                    errs.length === 0,
  };
  console.log('\n===== EXTENDED SCHEDULE (past tenure) =====');
  console.log('  state:', JSON.stringify(R));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs.slice(0, 5));
  console.log('\n  ' + (bad === 0 ? '✅ SCHEDULE EXTENDS PAST TENURE & RECONCILES WITH STATEMENT' : '❌ ' + bad + ' PROBLEM(S)') + '\n');
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
