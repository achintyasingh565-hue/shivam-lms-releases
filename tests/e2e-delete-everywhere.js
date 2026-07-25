// Proves deleting a customer removes them from EVERYWHERE:
//  - the loans array (so all screens that derive from it: dashboard, customers,
//    payments, reports, greetings, reminders, documents)
//  - the greetings send list
//  - the pending auto-reminder queue
// and that a kept customer is untouched, and "Delete All" clears the queue.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    loans.splice(0, loans.length,
      { id: 'DEL',  name: 'Delete Me', acno: 'SE-D001', phone: '9111111111', principal: 100000, rate: 2, tenure: 12, disb: '2025-06-01', due: '2025-07-01' },
      { id: 'KEEP', name: 'Keep Me',   acno: 'SE-K001', phone: '9222222222', principal: 50000,  rate: 2, tenure: 10, disb: '2025-06-01', due: '2025-07-01' });
    try { recomputeAll && recomputeAll(); } catch (e) {}
    save();

    // queue a pending auto-reminder for each customer
    localStorage.setItem('shivam_autoqueue_v1', JSON.stringify([
      { id: 'q1', key: 'emi:DEL:2025-07-01:3',  name: 'Delete Me', phone: '9111111111', acno: 'SE-D001', cat: 'EMI Reminder', vars: {}, msg: 'x', createdAt: Date.now() },
      { id: 'q2', key: 'emi:KEEP:2025-07-01:3', name: 'Keep Me',   phone: '9222222222', acno: 'SE-K001', cat: 'EMI Reminder', vars: {}, msg: 'y', createdAt: Date.now() }
    ]));

    const cloudCalls = [];
    const rc = window.cloudDelete; window.cloudDelete = function (id) { cloudCalls.push(id); };
    const rcf = window.confirm;    window.confirm = function () { return true; };

    delLoan('DEL');

    const loansAfterDel = loans.map(l => l.id).sort();

    setV('grType', 'greeting'); setV('grWho', 'all'); setV('grLang', 'en'); setV('grOccasion', 'Diwali'); setV('grDate', '');
    renderGreetings();
    const grHasDel = (window._grList || []).some(x => x.acno === 'SE-D001');

    let q = JSON.parse(localStorage.getItem('shivam_autoqueue_v1') || '[]');
    const qHasDel = q.some(it => it.acno === 'SE-D001');
    const qHasKeep = q.some(it => it.acno === 'SE-K001');

    // Delete All should wipe the queue entirely
    localStorage.setItem('shivam_autoqueue_v1', JSON.stringify([{ id: 'q3', key: 'emi:KEEP:x', acno: 'SE-K001', phone: '9222222222', cat: 'EMI Reminder', createdAt: Date.now() }]));
    clearAll();
    const qAfterClear = JSON.parse(localStorage.getItem('shivam_autoqueue_v1') || '[]').length;

    window.confirm = rcf; window.cloudDelete = rc;
    return { loansAfterDel, cloudCalls, grHasDel, qHasDel, qHasKeep, qAfterClear };
  });

  const checks = {
    'DEL removed, KEEP kept in loans': JSON.stringify(out.loansAfterDel) === JSON.stringify(['KEEP']),
    'cloudDelete called for DEL':      out.cloudCalls.indexOf('DEL') >= 0,
    'greetings list excludes DEL':     out.grHasDel === false,
    'pending queue pruned of DEL':     out.qHasDel === false,
    'pending queue keeps KEEP':        out.qHasKeep === true,
    'Delete All empties the queue':    out.qAfterClear === 0,
    'no page errors':                  errs.length === 0
  };

  console.log('\n===== DELETE-EVERYWHERE =====');
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ CUSTOMER DELETE PROPAGATES EVERYWHERE' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
