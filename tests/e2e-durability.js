// Proves the boot-time storage reconciliation is timestamp-based ("newest wins"),
// NOT length-based. A deliberate delete (localStorage newer, mirror stale-larger)
// must NOT be resurrected; a genuine localStorage wipe must still recover from the
// IndexedDB mirror.
const { chromium } = require('playwright');
const path = require('path');

function seedScript(arr, ts, lsEmptyTs) {
  // returns a function body string executed in-page; seeds idb + localStorage
  return async () => {};
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const seedIdb = `function(arr, ts){ return new Promise(function(res){ var rq=indexedDB.open('shivam_lms_db',1); rq.onupgradeneeded=function(){ try{ rq.result.createObjectStore('kv'); }catch(e){} }; rq.onsuccess=function(){ var db=rq.result; var tx=db.transaction('kv','readwrite'); var os=tx.objectStore('kv'); os.put(JSON.stringify(arr),'loans'); os.put(String(ts),'loans_ts'); tx.oncomplete=function(){ res(true); }; tx.onerror=function(){ res(false); }; }; rq.onerror=function(){ res(false); }; }); }`;

  // ---- Scenario A: deliberate delete — localStorage empty & NEWER, mirror stale-larger
  await p.evaluate(async (seedSrc) => {
    const seed = eval('(' + seedSrc + ')');
    const older = Date.now() - 100000;
    await seed([{ id: 'X1', name: 'Stale One' }, { id: 'X2', name: 'Stale Two' }], older);
    localStorage.setItem('shivam_loans_v1', '[]');
    localStorage.setItem('shivam_loans_ts_v1', String(Date.now()));  // newer than the mirror
  }, seedIdb);
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(700);
  const a = await p.evaluate(() => ({ loansLen: (typeof loans !== 'undefined' && loans) ? loans.length : -1 }));

  // ---- Scenario B: genuine wipe — localStorage empty & ts absent, mirror has data
  await p.evaluate(async (seedSrc) => {
    const seed = eval('(' + seedSrc + ')');
    await seed([{ id: 'Y1', name: 'Backup One' }, { id: 'Y2', name: 'Backup Two' }, { id: 'Y3', name: 'Backup Three' }], Date.now());
    localStorage.setItem('shivam_loans_v1', '[]');
    localStorage.removeItem('shivam_loans_ts_v1');   // wiped -> ts 0
  }, seedIdb);
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(700);
  const c = await p.evaluate(() => ({ loansLen: (typeof loans !== 'undefined' && loans) ? loans.length : -1 }));

  const checks = {
    'deliberate delete NOT resurrected (A = 0)': a.loansLen === 0,
    'genuine wipe recovered from mirror (B = 3)': c.loansLen === 3,
    'no page errors': errs.length === 0
  };

  console.log('\n===== STORAGE DURABILITY =====');
  console.log('  A(deliberate delete).loans =', a.loansLen, '| B(wipe).loans =', c.loansLen);
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ NEWEST-WINS RECONCILIATION IS CORRECT' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
