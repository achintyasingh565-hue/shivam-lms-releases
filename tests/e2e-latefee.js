// Accruing late fees: ₹500/overdue month, sticky charges that add to the balance and
// arrears, one-click apply (idempotent), shown in the EMI schedule and messages, waivable.
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
    const d = new Date(today); d.setMonth(d.getMonth() - 9); const disb = d.toISOString().slice(0, 10);
    const RATE = 500;
    setLateFeeRate(RATE);
    // 12 × ₹3,100 (₹37,200), 3 EMIs paid, rest unpaid → several overdue months.
    loans.splice(0, loans.length, { id: 'LF', name: 'Sunil Shah', acno: 'SE-16277', phone: '9839661338', type: 'Personal',
      principal: 30000, rate: 2, tenure: 12, tint: 7200, tpay: 37200, emi: 3100, disb, due: '',
      payments: [
        { pid: 'a', date: '2026-01-03', mode: 'Cash', amount: 3100, status: 'Cleared' },
        { pid: 'b', date: '2026-02-03', mode: 'Cash', amount: 3100, status: 'Cleared' },
        { pid: 'c', date: '2026-03-03', mode: 'Cash', amount: 3100, status: 'Cleared' }], charges: [] });
    recomputeAll();
    const l = loans[0];
    const before = { arrears: l.arrears, outstanding: l.outstanding };
    const expOverdue = overdueEmiIdxs(l).length;      // how many months are overdue
    const expLate = expOverdue * RATE;

    // ---- one-click apply ----
    applyLateFees('LF');
    const lateCharges = (l.charges || []).filter(c => c.type === 'Late fee');
    const after = { arrears: l.arrears, outstanding: l.outstanding, lateFees: l.lateFees };

    // ---- idempotent: applying again adds nothing ----
    applyLateFees('LF');
    const countAfter2 = (l.charges || []).filter(c => c.type === 'Late fee').length;

    // ---- EMI schedule reflects it ----
    const D = repScheduleData(l);
    const lastBal = D.rows.length ? D.rows[D.rows.length - 1].bal : 0;
    const anOverdueRowHasFee = D.rows.some(r => r.st === 'Overdue' && r.lateFee === RATE);

    // ---- demand notice shows the higher arrears/outstanding ----
    $('grType').value = 'demandnotice'; $('grWho').value = 'all'; $('grOccasion').value = ''; $('grDate').value = '';
    renderGreetings();
    const dn = (window._grList || []).find(x => x.acno === 'SE-16277');
    const grp = n => Math.round(n).toLocaleString('en-IN');

    // ---- waive one late fee ----
    deleteCharge('LF', lateCharges[0].id);
    recomputeLoan(l);
    const afterWaive = { count: (l.charges || []).filter(c => c.type === 'Late fee').length, lateFees: l.lateFees };

    return {
      expOverdue, expLate,
      chargesAdded: lateCharges.length, countAfter2,
      outBefore: before.outstanding, outAfter: after.outstanding, lateFees: after.lateFees,
      arrBefore: before.arrears, arrAfter: after.arrears,
      schedTotalLate: D.totalLate, lastBal, anOverdueRowHasFee,
      dnArr: dn && dn.vars.arrears, dnOut: dn && dn.vars.outstanding, expDnArr: grp(after.arrears), expDnOut: grp(after.outstanding),
      waiveCount: afterWaive.count, waiveLateFees: afterWaive.lateFees
    };
  });

  const checks = {
    'account has overdue months to charge':      R.expOverdue > 0,
    'apply adds one ₹500 fee per overdue month':  R.chargesAdded === R.expOverdue && R.lateFees === R.expLate,
    'late fees added to outstanding':             R.outAfter === R.outBefore + R.expLate,
    'late fees added to arrears (overdue amt)':   R.arrAfter === R.arrBefore + R.expLate,
    'apply is idempotent (no double-charge)':     R.countAfter2 === R.expOverdue,
    'schedule shows the late fees':               R.schedTotalLate === R.expLate && R.anOverdueRowHasFee,
    'schedule balance carries the late fees':     R.lastBal === R.outAfter,
    'demand notice shows higher arrears/balance': R.dnArr === R.expDnArr && R.dnOut === R.expDnOut,
    'waiving a fee reduces the total':            R.waiveCount === R.expOverdue - 1 && R.waiveLateFees === R.expLate - 500,
    'no page errors':                             errs.length === 0
  };
  console.log('\n===== ACCRUING LATE FEES =====');
  console.log('  state:', JSON.stringify(R));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs.slice(0, 5));
  console.log('\n  ' + (bad === 0 ? '✅ LATE FEES ACCRUE, STICK, SHOW EVERYWHERE, WAIVABLE' : '❌ ' + bad + ' PROBLEM(S)') + '\n');
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
