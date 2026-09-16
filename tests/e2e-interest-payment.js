// Interest-only payment (byaj month): the customer pays only the month's interest.
// It is income and pushes the due date forward one month, keeps the account current, and
// does NOT reduce principal. Shown in the payment register and the EMI schedule.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const out = await p.evaluate(() => {
    const today = todayISO();
    const disb = repAddMonths(today, -1);              // 1 month ago → EMI 1 is due today
    const L = { id: 'IO', name: 'Byaj Test', principal: 300000, rate: 2, tenure: 48, tint: 288000, tpay: 588000, emi: 12250, disb: disb, due: repAddMonths(disb, 1), status: 'Active', payments: [] };
    loans.splice(0, loans.length, L);
    recomputeLoan(L);
    const before = { out: L.outstanding, status: L.status, due: L.due };
    const mi = monthlyInterestOf(L);

    // record an interest-only payment
    L.payments.push({ pid: 'i1', date: today, mode: 'Cash', amount: mi, status: 'Cleared', intOnly: true, type: 'Interest' });
    recomputeLoan(L);
    const afterInt = { out: L.outstanding, status: L.status, due: L.due, intServiced: L.intServiced, intIncome: L.intIncome, paid: L.paid };

    // schedule shows an interest row + a shifted schedule
    const d = window._schedBuild(L);
    const hasIntRow = d.rows.some(r => r.isInt);

    // a normal EMI afterwards still reduces principal / balance
    L.payments.push({ pid: 'e1', date: today, mode: 'Cash', amount: 12250, status: 'Cleared' });
    recomputeLoan(L);
    const afterEmi = { out: L.outstanding, paid: L.paid, intServiced: L.intServiced };

    return { mi, before, afterInt, hasIntRow, intCount: d.intCount, afterEmi };
  });

  const dueMovedForward = out.afterInt.due > out.before.due;
  const checks = {
    "month's interest auto-calculated (6,000)":  out.mi === 6000,
    'starts overdue before servicing':           out.before.status === 'Overdue',
    'balance unchanged by interest-only':         out.afterInt.out === 588000,
    'principal paid stays zero':                  out.afterInt.paid === 0,
    'account becomes current (Active)':           out.afterInt.status === 'Active',
    'due date moves forward one month':           dueMovedForward === true,
    'interest income tracked':                    out.afterInt.intIncome === 6000,
    'one interest month serviced':                out.afterInt.intServiced === 1,
    'schedule shows an interest row':             out.hasIntRow === true,
    'schedule counts the interest month':         out.intCount === 1,
    'later real EMI reduces the balance':         out.afterEmi.out === 575750,
    'real EMI counts as principal payment':       out.afterEmi.paid === 12250,
    'no page errors':                             errs.length === 0
  };

  console.log('\n===== INTEREST-ONLY PAYMENT (BYAJ MONTH) =====');
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ INTEREST-ONLY: INCOME, DUE MOVES FORWARD, PRINCIPAL UNCHANGED' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
