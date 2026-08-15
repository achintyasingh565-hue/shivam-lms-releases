// Proves foreclosure: only allowed after >=6 EMIs (or 6 months); it waives the interest
// on the unpaid months (customer pays only remaining principal + optional charge), records
// the settlement, adds the foreclosure charge, and closes the loan with a zero balance.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    // ---- Eligible loan: 100000 @ 2%/mo x 12  -> tint 24000, tpay 124000, emi 10333.
    // 6 EMIs paid (61998 cleared).
    const pays6 = [];
    for (let i = 0; i < 6; i++) pays6.push({ date: '2025-0' + (i + 1) + '-01', mode: 'Cash', amount: 10333, status: 'Cleared' });
    loans.splice(0, loans.length, {
      id: 'FC', name: 'Foreclose Cust', acno: 'SE-FC', principal: 100000, rate: 2, tenure: 12,
      tint: 24000, tpay: 124000, emi: 10333, disb: '2025-01-01', paid: 61998, payments: pays6, charges: []
    });

    // Open the in-app foreclosure dialog, set the charge, then confirm (no prompt()).
    const opened = forecloseLoan('FC');
    document.getElementById('fcCharge').value = '500';
    document.getElementById('fcMode').value = 'Cash';
    if (typeof fcUpdateTotal === 'function') fcUpdateTotal();
    confirmForeclose();
    const ok = opened;
    const l = loans.find(x => x.id === 'FC');
    const foreclosurePay = (l.payments || []).find(p => p.foreclosure);
    const fcCharge = (l.charges || []).find(c => c.type === 'Foreclosure charge');

    // ---- Ineligible loan: only 2 EMIs, 2 months old -> foreclosure must be refused.
    const twoAgo = (function () { const d = new Date(); d.setMonth(d.getMonth() - 2); return d.toISOString().slice(0, 10); })();
    loans.push({
      id: 'NG', name: 'Too Soon', acno: 'SE-NG', principal: 100000, rate: 2, tenure: 12,
      tint: 24000, tpay: 124000, emi: 10333, disb: twoAgo, paid: 20666,
      payments: [{ date: twoAgo, mode: 'Cash', amount: 10333, status: 'Cleared' }, { date: twoAgo, mode: 'Cash', amount: 10333, status: 'Cleared' }], charges: []
    });
    const ng = forecloseLoan('NG');
    const ngLoan = loans.find(x => x.id === 'NG');

    return {
      ok, status: l.status, outstanding: Number(l.outstanding) || 0, foreclosed: !!l.foreclosed,
      interestWaived: Number(l.interestWaived) || 0,
      settlement: foreclosurePay ? foreclosurePay.amount : -1,
      chargeAmt: fcCharge ? fcCharge.amount : -1,
      ngRefused: ng === false, ngStatus: ngLoan.status, ngHasForeclosurePay: (ngLoan.payments || []).some(p => p.foreclosure)
    };
  });

  const checks = {
    'foreclosure succeeds when eligible':       out.ok === true,
    'loan is marked Closed, balance zero':      out.status === 'Closed' && out.outstanding === 0,
    'foreclosed flag set':                      out.foreclosed === true,
    'future interest is waived (~Rs 12,000)':   out.interestWaived >= 11800 && out.interestWaived <= 12200,
    'settlement ≈ principal + charge (not full EMIs)': out.settlement >= 50000 && out.settlement <= 51500 && out.settlement < 62002,
    'manual foreclosure charge recorded (500)': out.chargeAmt === 500,
    'ineligible loan is refused (<6 EMIs)':     out.ngRefused === true && out.ngStatus !== 'Closed' && out.ngHasForeclosurePay === false,
    'no page errors':                           errs.length === 0
  };

  console.log('\n===== FORECLOSURE (EARLY SETTLEMENT) =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ FORECLOSURE WAIVES INTEREST, GATES AT 6 EMIs, CLOSES CLEANLY' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
