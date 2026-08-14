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
    const D = repScheduleData(l);
    const byIdx = {}; D.rows.forEach(r => byIdx[r.i] = r);

    try { recomputeLoan(l); } catch (e) {}
    const od = (overdueEmiIdxs(l) || []).map(x => x.i);

    return {
      emi1: byIdx[1].st, emi2: byIdx[2].st, emi2bal: byIdx[2].bal,
      emi3: byIdx[3].st, emi3paid: byIdx[3].paid, emi3bal: byIdx[3].bal,
      emi4: byIdx[4].st, emi4paid: byIdx[4].paid, emi4bal: byIdx[4].bal,
      emi5: byIdx[5].st, emi6: byIdx[6].st,
      paidCount: D.paidCount, od, outstanding: Number(l.outstanding) || 0
    };
  });

  const checks = {
    'paid months show Paid (EMI1, EMI2)':       out.emi1 === 'Paid' && out.emi2 === 'Paid',
    'SKIPPED month (EMI3/Dec) is Overdue':      out.emi3 === 'Overdue' && out.emi3paid === 0,
    'later paid month (EMI4/Jan) is Paid':      out.emi4 === 'Paid' && out.emi4paid === 5000,
    'balance stays flat across the skip':       out.emi3bal === out.emi2bal && out.emi2bal === 20000,
    'balance drops only when actually paid':    out.emi4bal === 15000,
    'remaining unpaid months are Overdue':      out.emi5 === 'Overdue' && out.emi6 === 'Overdue',
    'paid count is 3 (non-contiguous)':         out.paidCount === 3,
    'overdue list = the real skipped months':   JSON.stringify(out.od) === JSON.stringify([3, 5, 6]),
    'outstanding (amount-based) unchanged':     out.outstanding === 15000,
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
