// Proves a reminder the user dismissed by mistake comes back on the next scan.
// Before the fix, dismissing left the reminder's key in a 60-day "seen" list, so
// "Scan now" refused to regenerate it and kept reporting 0.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    const iso = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    const base = new Date();
    const due = new Date(base);  due.setDate(base.getDate() + 3);   // 3 days out -> hits emiDays [7,3,1]
    const disb = new Date(base); disb.setDate(base.getDate() - 27);

    localStorage.removeItem('shivam_autoqueue_v1');
    localStorage.removeItem('shivam_autorem_seen_v1');

    loans.splice(0, loans.length,
      { id: 'R1', name: 'Due Soon', acno: 'SE-R001', phone: '9333333333', principal: 120000, rate: 2, tenure: 12,
        tint: 28800, tpay: 148800, emi: 12400, outstanding: 148800, arrears: 0, payments: [], disb: iso(disb), due: iso(due) });
    try { recomputeLoan(loans[0]); } catch (e) {}
    save();

    const scan1 = autoRemScan();
    const q1 = autoQueueLoad().length;

    const ids = autoQueueLoad().map(it => it.id);
    ids.forEach(id => autoRemDismiss(id));
    const qAfterDismiss = autoQueueLoad().length;

    const scan2 = autoRemScan();          // should REGENERATE the dismissed reminder
    const q2 = autoQueueLoad().length;

    return {
      st: (typeof autoStatus === 'function') ? autoStatus(loans[0]) : '?',
      dleft: (typeof repDaysBetween === 'function') ? repDaysBetween(todayISO(), iso(due)) : null,
      scan1Added: scan1 && scan1.added, q1, qAfterDismiss, scan2Added: scan2 && scan2.added, q2
    };
  });

  const checks = {
    'loan is Active on a trigger day': out.st === 'Active' && out.dleft === 3,
    'first scan created a reminder':   out.scan1Added >= 1 && out.q1 >= 1,
    'dismiss emptied the queue':       out.qAfterDismiss === 0,
    'RE-SCAN regenerated it':          out.scan2Added >= 1 && out.q2 >= 1,
    'no page errors':                  errs.length === 0
  };

  console.log('\n===== REMINDER RE-SCAN =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  console.log('\n  ' + (bad === 0 ? '✅ DISMISSED REMINDER RETURNS ON RE-SCAN' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
