// Proves interest-only ("byaj") loans: the customer pays only monthly interest, which is
// income and does NOT reduce the principal; the balance stays at the full principal until
// "Principal Returned" is recorded, which closes the loan. P&L counts interest as income
// and the principal return as principal (not income).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    // ₹1,00,000 at 2%/month, interest-only. Three ₹2,000 interest payments received.
    loans.splice(0, loans.length, {
      id: 'IO', name: 'Byaj Cust', acno: 'SE-IO', interestOnly: true,
      principal: 100000, rate: 2, tenure: 0, disb: '2025-01-01', paid: 0,
      payments: [
        { date: '2025-02-01', mode: 'Cash', amount: 2000, status: 'Cleared' },
        { date: '2025-03-01', mode: 'Cash', amount: 2000, status: 'Cleared' },
        { date: '2025-04-01', mode: 'Cash', amount: 2000, status: 'Cleared' }
      ]
    });
    let l = loans[0];
    recomputeLoan(l);
    const monthlyInterest = l.emi;                         // 100000 * 2% = 2000
    const outIsPrincipal = l.outstanding === 100000;        // interest didn't reduce it
    const notClosed = l.status !== 'Closed';

    // P&L before returning principal: interest income only.
    repPnl();
    document.getElementById('pnlFrom').value = '2025-01-01';
    document.getElementById('pnlTo').value = '2030-12-31';
    let D1 = repPnlData();
    const interestIncome = D1.interest;                     // 3 * 2000 = 6000
    const noPrincipalIncomeYet = D1.principal === 0;

    // Record the principal returned -> loan closes.
    window.confirm = () => true;
    const settled = settlePrincipal('IO');
    l = loans[0];
    const closed = l.status === 'Closed' && Number(l.outstanding) === 0;
    const hasPrincipalPay = (l.payments || []).some(x => x.kind === 'principal' && Number(x.amount) === 100000);

    // P&L after: interest income unchanged, principal return recorded as principal (not income).
    let D2 = repPnlData();
    const incomeStillInterestOnly = D2.interest === 6000 && D2.income === 6000 && D2.principal === 100000;

    return { monthlyInterest, outIsPrincipal, notClosed, interestIncome, noPrincipalIncomeYet, settled, closed, hasPrincipalPay, incomeStillInterestOnly };
  });

  const checks = {
    'monthly EMI = monthly interest (2000)':       out.monthlyInterest === 2000,
    'balance stays at full principal':             out.outIsPrincipal === true,
    'not closed while principal is outstanding':   out.notClosed === true,
    'interest counted as income (6000)':           out.interestIncome === 6000,
    'principal not counted as income yet':         out.noPrincipalIncomeYet === true,
    'Principal Returned closes the loan':          out.settled === true && out.closed === true,
    'principal-return payment recorded':           out.hasPrincipalPay === true,
    'P&L: interest income, principal not income':  out.incomeStillInterestOnly === true,
    'no page errors':                              errs.length === 0
  };

  console.log('\n===== INTEREST-ONLY (BYAJ) LOANS =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ INTEREST-ONLY: BALANCE=PRINCIPAL, INTEREST=INCOME, SETTLES ON RETURN' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
