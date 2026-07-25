// Proves "Delete ALL records" (clearAll) propagates each deletion to the cloud.
// Before the fix, clearAll wiped only this device; cloud sync then re-hydrated
// every record on the next pull (they were never marked deleted in Supabase).
// This drives the REAL built app headless, stubs cloudDelete + confirm, and
// verifies clearAll marks every record deleted in the cloud.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    loans.splice(0, loans.length,
      { id: 'A1', name: 'Test One',   acno: 'SE-9001', phone: '9000000001', principal: 100000, rate: 2, tenure: 12 },
      { id: 'A2', name: 'Test Two',   acno: 'SE-9002', phone: '9000000002', principal: 50000,  rate: 2, tenure: 10 },
      { id: 'A3', name: 'Test Three', acno: 'SE-9003', phone: '9000000003', principal: 75000,  rate: 2, tenure: 8 });
    try { recomputeAll && recomputeAll(); } catch (e) {}
    save();

    const called = [];
    const realCloud = window.cloudDelete;
    window.cloudDelete = function (id) { called.push(id); };
    const realConfirm = window.confirm;
    window.confirm = function () { return true; };

    clearAll();

    window.confirm = realConfirm;
    window.cloudDelete = realCloud;

    let ls = [];
    try { ls = JSON.parse(localStorage.getItem('shivam_loans_v1') || '[]'); } catch (e) {}
    return { loansLen: loans.length, cloudCalls: called.slice().sort(), lsLen: ls.length };
  });

  const okIds = JSON.stringify(out.cloudCalls) === JSON.stringify(['A1', 'A2', 'A3']);
  const pass = out.loansLen === 0 && out.lsLen === 0 && okIds && errs.length === 0;

  console.log('\n===== CLEAR-ALL CLOUD PROPAGATION =====');
  console.log('  loans after clearAll:  ' + out.loansLen + '   (expect 0)');
  console.log('  localStorage rows:     ' + out.lsLen + '   (expect 0)');
  console.log('  cloudDelete called for: ' + JSON.stringify(out.cloudCalls) + '   (expect ["A1","A2","A3"])');
  console.log('  page errors:           ' + errs.length);
  console.log('\n  ' + (pass ? '✅ CLEAR-ALL PROPAGATES DELETE TO CLOUD' : '❌ FAIL') + '\n');

  await b.close();
  process.exit(pass ? 0 : 1);
})();
