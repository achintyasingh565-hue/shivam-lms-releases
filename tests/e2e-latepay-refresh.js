// A late payment must immediately reflect in the Reminders, Demand Notice and Reports —
// those screens now recompute on render, so figures are never stale.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const R = await p.evaluate(() => {
    const $ = id => document.getElementById(id);
    window.print = () => {}; window.confirm = () => true; window.alert = () => {};
    const today = todayISO();
    const d = new Date(today); d.setMonth(d.getMonth() - 8); const disb = d.toISOString().slice(0, 10);
    loans.splice(0, loans.length, { id: 'LP', name: 'Sunil Shah', acno: 'SE-16277', phone: '9839661338', type: 'Personal',
      principal: 30000, rate: 2, tenure: 12, tint: 7200, tpay: 37200, emi: 3100, disb, due: '',
      payments: [
        { pid: 'a', date: '2026-01-03', mode: 'Cash', amount: 3100, status: 'Cleared' },
        { pid: 'b', date: '2026-02-03', mode: 'Cash', amount: 3100, status: 'Cleared' },
        { pid: 'c', date: '2026-03-03', mode: 'Cash', amount: 3100, status: 'Cleared' }], charges: [] });
    recomputeAll();
    const before = { arrears: loans[0].arrears, outstanding: loans[0].outstanding };

    // record a late payment through the real pay-tab flow
    if (typeof refreshPayLoanDropdown === 'function') refreshPayLoanDropdown();
    $('payb_loan').value = 'LP'; $('payb_amt').value = '3100'; $('payb_mode').value = 'Cash'; $('payb_date').value = today;
    recordPayTab(); if (recordPayTab._busy) recordPayTab._busy = false;
    const after = { arrears: loans[0].arrears, outstanding: loans[0].outstanding };

    // Reminders (Overdue) — the reminder amount is the outstanding
    $('remFilter').value = 'all'; $('remLang').value = 'en'; renderReminders();
    const rem = (window._remList || []).find(x => x.acno === 'SE-16277');

    // Demand Notice
    $('grType').value = 'demandnotice'; $('grWho').value = 'all'; $('grOccasion').value = ''; $('grDate').value = '';
    renderGreetings();
    const dn = (window._grList || []).find(x => x.acno === 'SE-16277');

    // Reports (Overdue)
    go('reports'); if (typeof setReportView === 'function') setReportView('overdue');
    const repHtml = ($('repBody') || {}).innerHTML || '';

    const grp = n => Math.round(n).toLocaleString('en-IN');
    return {
      before, after,
      remShowsNewOut: rem && rem.amt === Math.round(after.outstanding),
      dnArrOk: dn && dn.vars.arrears === grp(after.arrears),
      dnOutOk: dn && dn.vars.outstanding === grp(after.outstanding),
      reportShowsNewOut: (repHtml.indexOf(grp(after.outstanding)) >= 0 || repHtml.indexOf(grp(after.arrears)) >= 0),
      reportNotStale: repHtml.indexOf(grp(before.outstanding)) < 0 && repHtml.indexOf(grp(before.arrears)) < 0
    };
  });

  const checks = {
    'payment reduced arrears 15,500 -> 12,400':   R.before.arrears === 15500 && R.after.arrears === 12400,
    'payment reduced outstanding 27,900 -> 24,800': R.before.outstanding === 27900 && R.after.outstanding === 24800,
    'overdue reminder shows the new balance':      R.remShowsNewOut === true,
    'demand notice shows new arrears':             R.dnArrOk === true,
    'demand notice shows new outstanding':         R.dnOutOk === true,
    'reports show the new outstanding':            R.reportShowsNewOut === true,
    'reports no longer show the stale balance':    R.reportNotStale === true,
    'no page errors':                              errs.length === 0
  };
  console.log('\n===== LATE PAYMENT REFLECTS EVERYWHERE =====');
  console.log('  state:', JSON.stringify({ before: R.before, after: R.after }));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs.slice(0, 5));
  console.log('\n  ' + (bad === 0 ? '✅ LATE PAYMENT UPDATES MESSAGES & REPORTS' : '❌ ' + bad + ' PROBLEM(S)') + '\n');
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
