// Behavioural verification of the Phase-1 fixes, in the real app (headless).
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(600);

  const results = await p.evaluate(() => {
    const R = {};
    window.print = () => {};
    const mk = () => ({
      id: 'AUD1', name: 'Audit Borrower', acno: 'A-1', phone: '', type: 'Personal',
      principal: 100000, rate: 2, tenure: 12, tint: 24000, tpay: 124000, emi: 10333,
      disb: '2025-06-01', due: '2025-07-01', paid: 0, outstanding: 124000, deductions: 0,
      status: 'Active', payments: [
        { date: '2025-07-01', amount: 10333, status: 'Cleared', mode: 'Cash' },
        { date: '2025-08-01', amount: 10333, status: 'Cleared', mode: 'Cash' }
      ], createdAt: '2025-06-01'
    });

    // ---------- V1: over-payment is capped, contract NOT rewritten ----------
    loans.splice(0, loans.length, mk());
    recomputeLoan(loans[0]);
    const outBefore = loans[0].outstanding;                     // 103334
    window.confirm = (m) => String(m).indexOf('MORE than the outstanding') >= 0; // accept overpay warning, decline print
    openRestructure('AUD1');
    document.getElementById('rs_amt').value = String(outBefore + 50000);
    calcRestructure();
    const warnShown = document.getElementById('rsAfter').innerHTML.indexOf('exceeds the outstanding') >= 0;
    applyRestructure();
    const l1 = loans[0];
    R.V1 = {
      warnShownInPreview: warnShown,
      lumpEntered: outBefore + 50000,
      paidAfter: l1.paid,                       // must be 20666 + 103334 = 124000, NOT 174000
      tpayAfter: l1.tpay,                       // must stay 124000 (contract intact)
      outstandingAfter: l1.outstanding, status: l1.status,
      excessRejected: (l1.restructures && l1.restructures[0] && l1.restructures[0].overpayRejected) || 0,
      PASS: l1.paid === 124000 && l1.tpay === 124000 && l1.status === 'Closed'
    };

    // ---------- V2: restructure preserves original contract + full history ----------
    loans.splice(0, loans.length, mk());
    recomputeLoan(loans[0]);
    window.confirm = () => false; // decline print prompt
    openRestructure('AUD1');
    document.getElementById('rs_amt').value = '50000';
    calcRestructure();
    applyRestructure();
    const l2 = loans[0];
    R.V2 = {
      originalPreserved: { tpay0: l2.tpay0, tint0: l2.tint0, tenure0: l2.tenure0, rate0: l2.rate0, emi0: l2.emi0 },
      historyEntries: (l2.restructures || []).length,
      historySample: (l2.restructures || [])[0],
      paymentsIntact: (l2.payments || []).length,
      PASS: l2.tpay0 === 124000 && l2.tint0 === 24000 && l2.tenure0 === 12 && (l2.restructures || []).length === 1
    };

    // ---------- V3: real double-submit through recordPayTab is blocked ----------
    loans.splice(0, loans.length, mk());
    recomputeLoan(loans[0]);
    if (typeof refreshPayLoanDropdown === 'function') refreshPayLoanDropdown();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    window.confirm = () => false;               // reject the duplicate warning
    set('payb_loan', 'AUD1'); set('payb_amt', '5000'); set('payb_mode', 'Cash'); set('payb_date', '2025-09-01');
    recordPayTab();
    const paidAfterFirst = loans[0].paid;
    recordPayTab._busy = false;                 // simulate a second click after the guard window
    set('payb_amt', '5000'); set('payb_date', '2025-09-01'); // same entry again
    recordPayTab();
    const l3 = loans[0];
    R.V3 = {
      paidAfterFirst,
      paidAfterSecondAttempt: l3.paid,
      paymentsHavePids: (l3.payments || []).filter(q => q.pid).length,
      PASS: paidAfterFirst === 25666 && l3.paid === 25666
    };

    return R;
  });

  console.log(JSON.stringify(results, null, 2));
  console.log('pageerrors:', errs);
  const pass = results.V1.PASS && results.V2.PASS && results.V3.PASS;
  console.log(pass ? 'ALL FIX VERIFICATIONS PASS' : 'SOME VERIFICATIONS FAILED');
  process.exitCode = pass ? 0 : 1;
  await b.close();
})();
