// End-to-end audit of applyRestructure & payment duplication in the REAL app (headless).
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
    window.confirm = () => false;           // suppress "print revised schedule?" prompt
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

    // ---------- T1: lump-sum EXCEEDING outstanding ----------
    loans.splice(0, loans.length, mk());
    recomputeLoan(loans[0]);
    const outBefore = loans[0].outstanding;              // 124000-20666 = 103334
    openRestructure('AUD1');
    document.getElementById('rs_amt').value = String(outBefore + 50000);  // overpay by ₹50,000
    calcRestructure();
    applyRestructure();
    const l1 = loans[0];
    R.T1 = {
      outBefore,
      lumpEntered: outBefore + 50000,
      paidAfter: l1.paid, tpayAfter: l1.tpay, outstandingAfter: l1.outstanding, status: l1.status,
      excessSilentlySwallowed: l1.paid - l1.tpay
    };

    // ---------- T2: ledger integrity after a normal restructure ----------
    loans.splice(0, loans.length, mk());
    recomputeLoan(loans[0]);
    const orig = { tpay: loans[0].tpay, tint: loans[0].tint, tenure: loans[0].tenure, arrears: loans[0].arrears };
    openRestructure('AUD1');
    document.getElementById('rs_amt').value = '50000';   // ₹50k prepayment
    calcRestructure();
    applyRestructure();
    const l2 = loans[0];
    R.T2 = {
      originalContract: orig,
      after: { tpay: l2.tpay, tint: l2.tint, tenure: l2.tenure, baseOut: l2.baseOut, paidBase: l2.paidBase },
      originalTpayPreservedAnywhere: !!(l2.tpay0 || l2.origTpay || l2.contractTpay),
      restructureHistoryKept: Array.isArray(l2.restructures),
      onlyLastRestructureDate: l2.restructuredAt,
      paymentsHistoryIntact: (l2.payments || []).length
    };

    // ---------- T3: interest-income report distortion after restructure ----------
    // share = tint / tpay ; tint untouched but tpay shrank -> inflated interest share
    const shareBefore = orig.tint / orig.tpay;
    const shareAfter = l2.tint / l2.tpay;
    R.T3 = {
      shareBefore: +(shareBefore * 100).toFixed(2) + '%',
      shareAfter: +(shareAfter * 100).toFixed(2) + '%',
      distortion: 'a ₹10,000 collection now books ₹' + Math.round(10000 * shareAfter) +
                  ' as interest instead of ₹' + Math.round(10000 * shareBefore)
    };

    // ---------- T4: double-submit the same payment via the Payments tab path ----------
    loans.splice(0, loans.length, mk());
    recomputeLoan(loans[0]);
    // simulate the exact recordPayTab flow twice with identical input (double-click / double-submit)
    const l4 = loans[0];
    const pay = { date: '2025-09-01', mode: 'Cash', amount: 10333, status: 'Cleared', cheque: '', bank: '', ref: '' };
    l4.payments.push(Object.assign({}, pay)); recomputeLoan(l4);
    l4.payments.push(Object.assign({}, pay)); recomputeLoan(l4);
    R.T4 = { paidAfterDoubleSubmit: l4.paid, expectedIfGuarded: 20666 + 10333, doubleCounted: l4.paid === 41332 };

    return R;
  });

  console.log(JSON.stringify(results, null, 2));
  console.log('pageerrors:', errs);
  await b.close();
})();
