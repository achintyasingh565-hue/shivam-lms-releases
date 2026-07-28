// Proves cheque-bounce fees: (1) a 'Cheque bounce' charge is ADDED to what the
// customer owes (outstanding), and (2) marking a cheque bounced in the loan form
// and saving records the fee charge, flips the payment to Bounced, and reflects it
// in the balance.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(async () => {
    // --- (1) recompute adds a bounce charge to outstanding ---
    var L = { id: 'B1', name: 'Bounce Test', acno: 'SE-7001', phone: '9000000001', principal: 120000, rate: 2, tenure: 12,
      tint: 28800, tpay: 148800, emi: 12400, disb: '2025-06-01', due: '2025-07-01',
      payments: [{ date: '2025-07-01', amount: 12400, status: 'Cleared', mode: 'Cash' }], charges: [] };
    loans.splice(0, loans.length, L);
    recomputeLoan(L);
    var base = L.outstanding;                 // 148800 - 12400 = 136400
    L.charges.unshift({ id: 'C1', date: '2025-07-05', type: 'Cheque bounce', amount: 500, cheque: '111' });
    recomputeLoan(L);
    var withFee = L.outstanding;              // + 500

    // --- (2) full flow: mark a cheque bounced in the form and save ---
    var L2 = { id: 'B2', name: 'Chq Bounce', acno: 'SE-7002', phone: '9000000002', principal: 120000, rate: 2, tenure: 12,
      tint: 28800, tpay: 148800, emi: 12400, disb: '2025-06-01', due: '2025-07-01',
      payments: [{ date: '2025-07-01', amount: 12400, status: 'Pending', mode: 'Cheque', cheque: '222', bank: 'HDFC' }], charges: [] };
    loans.splice(0, loans.length, L2);
    openLoan('B2');                           // populates the modal + modalPayments
    window.prompt = () => '600';              // bounce fee entered
    window.confirm = () => false;             // skip the "send notice" popup
    window.open = () => {};
    markPayBounced(0);                        // mark the cheque bounced
    await saveLoan();
    var saved = loans.find(l => l.id === 'B2') || {};
    var bounceChg = (saved.charges || []).find(c => c.type === 'Cheque bounce');
    var pay0 = (saved.payments || [])[0] || {};

    return {
      base, withFee,
      chargeAmount: bounceChg && bounceChg.amount,
      payStatus: pay0.status,
      savedOutstanding: saved.outstanding
    };
  });

  const checks = {
    'bounce charge adds to outstanding (+500)': out.withFee === out.base + 500,
    'mark bounced records the fee charge (600)': out.chargeAmount === 600,
    'the cheque payment is now Bounced':        out.payStatus === 'Bounced',
    'saved balance includes the fee':           out.savedOutstanding === 148800 + 600, // pending cheque never cleared
    'no page errors':                           errs.length === 0
  };

  console.log('\n===== CHEQUE BOUNCE FEE =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ BOUNCE FEE IS ADDED TO WHAT THE CUSTOMER OWES' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
