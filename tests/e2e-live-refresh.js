// Proves the "no reload needed" fix: refreshActiveView() redraws whatever screen
// is open when data changes, preserves the current sub-tab, and does nothing while
// a dialog is open (so a background sync can't wipe an in-progress edit).
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
    const mkLoan = (id, name) => ({ id, name, acno: id, phone: '9838100000', type: 'Personal',
      principal: 50000, rate: 2, tenure: 0, tint: 0, tpay: 50000, emi: 5000,
      disb: '2026-01-01', due: '2026-08-01', paid: 0, outstanding: 50000, arrears: 0,
      status: 'Active', payments: [] });

    loans.splice(0, loans.length, mkLoan('LR1', 'Borrower One'));

    // Open Messages → Reminders, list "All active loans"
    go('messages');
    $('remFilter').value = 'all';
    renderReminders();
    const beforeCount = (window._remList || []).length;

    // Data changes in the background (as a cloud sync would deliver it)
    loans.push(mkLoan('LR2', 'Borrower Two'));
    window.refreshActiveView();                       // <-- the fix
    const afterCount = (window._remList || []).length;
    const showsNew = ($('remWrap').innerHTML.indexOf('Borrower Two') >= 0);

    // Sub-tab must be preserved (not reset to Reminders)
    setMsgView('history');
    const historyVisibleBefore = $('mv-history').style.display !== 'none';
    loans.push(mkLoan('LR3', 'Borrower Three'));
    window.refreshActiveView();
    const historyVisibleAfter = $('mv-history').style.display !== 'none';

    // Guard: while a dialog is open, refreshActiveView is a no-op
    setMsgView('reminders'); $('remFilter').value = 'all'; renderReminders();
    const guardBase = (window._remList || []).length;   // 3 now
    const ov = document.createElement('div'); ov.className = 'overlay show'; document.body.appendChild(ov);
    loans.push(mkLoan('LR4', 'Borrower Four'));
    window.refreshActiveView();                          // should skip (dialog open)
    const duringDialog = (window._remList || []).length;
    ov.remove();
    window.refreshActiveView();                          // now it refreshes
    const afterDialog = (window._remList || []).length;

    return { beforeCount, afterCount, showsNew, historyVisibleBefore, historyVisibleAfter, guardBase, duringDialog, afterDialog };
  });

  const checks = {
    'open view starts with 1 loan':          out.beforeCount === 1,
    'background change redraws the view':     out.afterCount === 2 && out.showsNew === true,
    'sub-tab preserved (stayed on History)':  out.historyVisibleBefore && out.historyVisibleAfter,
    'no-op while a dialog is open':           out.guardBase === 3 && out.duringDialog === 3,
    'refreshes once the dialog closes':       out.afterDialog === 4,
    'no page errors':                         errs.length === 0
  };
  console.log('\n===== LIVE REFRESH (no reload needed) =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ CHANGES REFLECT WITHOUT RESTARTING' : '❌ ' + bad + ' PROBLEM(S)') + '\n');
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
