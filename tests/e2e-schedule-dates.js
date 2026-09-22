// Proves the EMI schedule credits each payment to the MONTH it was actually received —
// a skipped month stays Overdue (not back-filled from the running total), the later
// paid month shows Paid, the running balance stays flat across the skip, and the
// amount-based outstanding is unchanged.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    // 6-month loan; due dates: 2025-10-01 .. 2026-03-01 (all in the past).
    // Paid EMI1 (Oct) & EMI2 (Nov), SKIPPED Dec, paid EMI4 (Jan). Feb & Mar unpaid.
    loans.splice(0, loans.length, {
      id: 'SK', name: 'Skip Test', acno: 'SE-SK', tenure: 6, emi: 5000,
      principal: 30000, rate: 0, tpay: 30000, disb: '2025-09-01', paid: 15000,
      payments: [
        { date: '2025-10-01', mode: 'Cash', amount: 5000, status: 'Cleared' },
        { date: '2025-11-01', mode: 'Cash', amount: 5000, status: 'Cleared' },
        { date: '2026-01-01', mode: 'Cash', amount: 5000, status: 'Cleared' }
      ]
    });
    const l = loans[0];
    try { recomputeLoan(l); } catch (e) {}
    const D = repScheduleData(l);
    const paidEmis = D.rows.filter(r => !r.isInt && !r.missed && r.st === 'Paid');
    const deferred = D.rows.filter(r => r.missed);
    const lastPaid = paidEmis[paidEmis.length - 1] || {};
    const od = (overdueEmiIdxs(l) || []).map(x => x.i);

    return {
      paidCount: D.paidCount,
      paidEmiCount: paidEmis.length,
      deferredCount: deferred.length,
      lastPaidBal: lastPaid.bal,
      od, outstanding: Number(l.outstanding) || 0
    };
  });

  const checks = {
    // 3 payments (Oct, Nov, Jan) → 3 installments paid; the skipped Dec is a Deferred month, not back-filled.
    'three installments show Paid':              out.paidCount === 3 && out.paidEmiCount === 3,
    'skipped months become Deferred rows':      out.deferredCount >= 1,
    'balance after the 3rd payment is 15000':   out.lastPaidBal === 15000,
    'outstanding (amount-based) unchanged':     out.outstanding === 15000,
    'overdue detection flags the skipped Dec, not paid months': out.od.indexOf(3) >= 0 && out.od.indexOf(1) < 0 && out.od.indexOf(2) < 0 && out.od.indexOf(4) < 0,
    'no page errors':                           errs.length === 0
  };

  console.log('\n===== EMI SCHEDULE: DATE-MATCHED PAYMENTS =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ SCHEDULE MATCHES THE PAYMENT REGISTER (SKIPS STAY SKIPPED)' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
