// Proves the "Auto-generate" category toggles actually gate the scan: turning
// EMI off makes a due-soon loan produce no EMI reminder; turning it back on
// restores it.
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
    const due = new Date(base);  due.setDate(base.getDate() + 3);
    const disb = new Date(base); disb.setDate(base.getDate() - 27);
    localStorage.removeItem('shivam_autoqueue_v1');
    localStorage.removeItem('shivam_autorem_seen_v1');
    loans.splice(0, loans.length,
      { id: 'T1', name: 'Toggle Test', acno: 'SE-T101', phone: '9555500001', principal: 120000, rate: 2, tenure: 12,
        tint: 28800, tpay: 148800, emi: 12400, outstanding: 148800, arrears: 0, payments: [], disb: iso(disb), due: iso(due) });
    try { recomputeLoan(loans[0]); } catch (e) {}
    save();

    // EMI OFF -> scan should add nothing
    autoRemToggle('emi', false);
    localStorage.removeItem('shivam_autoqueue_v1'); localStorage.removeItem('shivam_autorem_seen_v1');
    const offAdded = autoRemScan().added;
    const cfgOff = autoRemCfg().emi;

    // EMI ON -> scan should add the reminder
    autoRemToggle('emi', true);
    localStorage.removeItem('shivam_autoqueue_v1'); localStorage.removeItem('shivam_autorem_seen_v1');
    const onAdded = autoRemScan().added;
    const cfgOn = autoRemCfg().emi;

    return { offAdded, onAdded, cfgOff, cfgOn };
  });

  const checks = {
    'toggle persisted to config (off=false, on=true)': out.cfgOff === false && out.cfgOn === true,
    'EMI off -> scan adds 0':                          out.offAdded === 0,
    'EMI on  -> scan adds the reminder':               out.onAdded >= 1,
    'no page errors':                                  errs.length === 0
  };

  console.log('\n===== REMINDER CATEGORY TOGGLE =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  console.log('\n  ' + (bad === 0 ? '✅ CATEGORY TOGGLES GATE THE SCAN' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
