// Proves the Collection Efficiency report counts EVERY EMI scheduled due in the chosen
// period (not just the single next-due one), so the % is accurate — and never counts
// EMIs that aren't due yet (capped at today).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    const $ = id => document.getElementById(id);

    // Case 1 — a 6-month loan, all 6 EMIs already due; 3 of 6 collected => 50%.
    loans.splice(0, loans.length, {
      id: 'E1', name: 'Eff Test', acno: 'SE-E1', tenure: 6, emi: 5000,
      principal: 30000, rate: 0, tpay: 30000, disb: '2025-09-01', paid: 15000,
      payments: [
        { date: '2025-10-01', mode: 'Cash', amount: 5000, status: 'Cleared' },
        { date: '2025-11-01', mode: 'Cash', amount: 5000, status: 'Cleared' },
        { date: '2026-01-01', mode: 'Cash', amount: 5000, status: 'Cleared' }
      ]
    });
    repEfficiency();
    $('effFrom').value = '2025-10-01'; $('effTo').value = '2026-03-01';
    const D1 = repEfficiencyData();
    const r1 = D1.rows.find(r => r.acno === 'SE-E1') || {};

    // Case 2 — capping: a loan whose later EMIs are in the FUTURE must not be counted.
    loans.splice(0, loans.length, {
      id: 'E2', name: 'Future Test', acno: 'SE-E2', tenure: 6, emi: 5000,
      principal: 30000, rate: 0, tpay: 30000, disb: '2026-06-01', paid: 0, payments: []
    });
    $('effFrom').value = '2026-07-01'; $('effTo').value = '2027-12-01';   // 'to' far in the future
    const D2 = repEfficiencyData();
    const r2 = D2.rows.find(r => r.acno === 'SE-E2') || {};

    return {
      expected1: D1.expected, collected1: D1.collected, pct1: D1.pct, dueCount1: r1.dueCount,
      dueCount2: r2.dueCount, expected2: D2.expected
    };
  });

  const checks = {
    'expected = ALL 6 EMIs due (Rs 30,000)':   out.expected1 === 30000 && out.dueCount1 === 6,
    'collected = payments in range (Rs 15,000)': out.collected1 === 15000,
    'efficiency is accurate (50%)':             out.pct1 === 50,
    'future EMIs are NOT counted (capped)':     out.dueCount2 >= 1 && out.dueCount2 < 6 && out.expected2 < 30000,
    'no page errors':                           errs.length === 0
  };

  console.log('\n===== COLLECTION EFFICIENCY (ALL DUE EMIs) =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ EFFICIENCY COUNTS ALL DUE EMIs, EXCLUDES FUTURE ONES' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
