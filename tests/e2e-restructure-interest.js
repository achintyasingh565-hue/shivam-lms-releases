// Restructure with an OPTIONAL fresh interest rate:
//   - blank rate  -> re-spread the balance, no new interest (EMI = balance ÷ months)
//   - a rate      -> charge fresh flat interest on the balance over the new tenure
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const R = await p.evaluate(async () => {
    const $ = id => document.getElementById(id);
    window.print = () => {}; window.confirm = () => true; window.alert = () => {};
    // A loan whose current outstanding is exactly ₹1,00,000 (nothing paid yet).
    loans.splice(0, loans.length, { id: 'RS', name: 'Rate Test', acno: 'SE-RS1', phone: '9839125800', type: 'Personal',
      principal: 100000, rate: 2, tenure: 20, tint: 40000, tpay: 140000, emi: 7000, disb: '2026-01-01',
      payments: [], charges: [] });
    // pay it down so the outstanding to re-plan is a round ₹1,00,000
    loans[0].payments.push({ pid: 'x', date: '2026-02-01', mode: 'Cash', amount: 40000, status: 'Cleared' });
    recomputeAll();
    const oldOut = loans[0].outstanding;              // 140000 - 40000 = 100000

    const doRs = (months, rate) => {
      openRestructure('RS');
      $('rs_amt').value = '';                          // no lump this time
      document.querySelector('input[name="rsMode"][value="manual"]').checked = true;
      $('rs_mmonths').value = String(months); $('rs_memi').value = '';
      $('rs_rate').value = (rate == null ? '' : String(rate));
      calcRestructure();
      // read the preview values off the computed object by re-running compute via calc (values are on screen);
      // easier: assert on the saved loan after apply
    };

    // ---- (1) NO rate: re-spread ₹1,00,000 over 10 months → EMI 10,000, no interest ----
    doRs(10, null);
    await applyRestructure();
    const noRate = { tpay: loans[0].tpay, out: loans[0].outstanding, emi: loans[0].emi, tenure: loans[0].tenure };

    // reset the loan for the second scenario
    loans.splice(0, loans.length, { id: 'RS', name: 'Rate Test', acno: 'SE-RS1', phone: '9839125800', type: 'Personal',
      principal: 100000, rate: 2, tenure: 20, tint: 40000, tpay: 140000, emi: 7000, disb: '2026-01-01',
      payments: [{ pid: 'x', date: '2026-02-01', mode: 'Cash', amount: 40000, status: 'Cleared' }], charges: [] });
    recomputeAll();

    // ---- (2) 2% fresh interest: ₹1,00,000 over 10 months → interest 20,000, total 120,000, EMI 12,000 ----
    doRs(10, 2);
    await applyRestructure();
    const withRate = { tpay: loans[0].tpay, out: loans[0].outstanding, emi: loans[0].emi, tenure: loans[0].tenure, rate: loans[0].rate };

    return { oldOut, noRate, withRate };
  });

  const checks = {
    'balance to re-plan is ₹1,00,000':        R.oldOut === 100000,
    'blank rate: no interest (EMI 10,000)':    R.noRate.emi === 10000 && R.noRate.out === 100000 && R.noRate.tenure === 10,
    'blank rate: total unchanged at 1,00,000': R.noRate.tpay === 100000 + 0 || R.noRate.tpay === 40000 + 100000, // paid 40k + balance 100k
    '2% rate: fresh interest ₹20,000 added':   R.withRate.out === 120000,
    '2% rate: EMI becomes ₹12,000':            R.withRate.emi === 12000 && R.withRate.tenure === 10,
    '2% rate: total payable = paid + 1,20,000': R.withRate.tpay === 40000 + 120000,
    '2% rate: rate label saved as 2':          R.withRate.rate === 2,
    'no page errors':                          errs.length === 0
  };
  console.log('\n===== RESTRUCTURE — OPTIONAL FRESH INTEREST =====');
  console.log('  state:', JSON.stringify(R));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs.slice(0, 5));
  console.log('\n  ' + (bad === 0 ? '✅ RATE OPTIONAL: NONE FOR SOME, FRESH INTEREST FOR OTHERS' : '❌ ' + bad + ' PROBLEM(S)') + '\n');
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
