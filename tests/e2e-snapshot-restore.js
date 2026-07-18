// End-to-end proof that a CLOUD daily snapshot can be CREATED and then RESTORED
// exactly. It drives the real app functions — maybeDailySnapshot() (via the real
// sign-in -> initialSync path) and window.cloudRestoreSnapshot() — against a
// mocked Supabase REST backend (fetch is intercepted). No sync logic is modified;
// the test only stands in for the network so the real create/restore code runs.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));

  // Install the mock cloud BEFORE any app script runs.
  await page.addInitScript(() => {
    window.confirm = () => true;                 // auto-accept the restore confirmation
    const store = { snapshots: [], loans: [], seq: 0 };
    window.__cloud = store;
    const mkRes = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (url, opts) => {
      url = String(url); opts = opts || {};
      const method = (opts.method || 'GET').toUpperCase();
      let body = null; try { body = opts.body ? JSON.parse(opts.body) : null; } catch (_) {}
      if (url.includes('/auth/v1/token'))
        return mkRes({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 });
      if (url.includes('/rest/v1/snapshots')) {
        if (method === 'POST') {
          const rows = (body || []).map(r => ({ id: ++store.seq, taken_at: r.day, ...r }));
          store.snapshots.push(...rows); return mkRes(rows, 201);
        }
        if (method === 'DELETE') return mkRes([], 200);
        if (url.includes('day=eq.')) {
          const day = decodeURIComponent(url.split('day=eq.')[1].split('&')[0]);
          return mkRes(store.snapshots.filter(s => s.day === day));
        }
        if (url.includes('id=eq.')) {
          const id = decodeURIComponent(url.split('id=eq.')[1].split('&')[0]);
          return mkRes(store.snapshots.filter(s => String(s.id) === String(id)));
        }
        return mkRes(store.snapshots.map(s => ({ id: s.id, day: s.day, taken_at: s.taken_at })));
      }
      if (url.includes('/rest/v1/loans')) {
        if (method === 'POST') {
          (body || []).forEach(r => { const i = store.loans.findIndex(x => x.id === r.id); if (i >= 0) store.loans[i] = r; else store.loans.push(r); });
          return mkRes([], 201);
        }
        return mkRes([]);            // GET loans -> nothing remote
      }
      return mkRes([]);
    };
  });

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });

  // 1) Seed a known loan book and capture its exact serialized form (post-recompute).
  const original = await page.evaluate(() => {
    loans.splice(0, loans.length,
      { id: 'S1', name: 'Ramesh', acno: 'A-1', principal: 100000, rate: 2, tenure: 12, tint: 24000,
        tpay: 124000, emi: 10333, disb: '2025-06-01', payments: [{ date: '2025-07-01', amount: 10333, status: 'Cleared', mode: 'Cash' }], status: 'Active' },
      { id: 'S2', name: 'Suresh', acno: 'A-2', principal: 50000, rate: 2, tenure: 10, tint: 10000,
        tpay: 60000, emi: 6000, disb: '2025-06-05', payments: [], status: 'Active' });
    try { recomputeAll(); } catch (_) {}
    save();
    return JSON.stringify(loans);
  });

  // 2) Sign in (boot shows the form ~800ms after load) -> initialSync -> maybeDailySnapshot() creates the snapshot.
  await page.waitForSelector('#cloudSignIn', { timeout: 4000 });
  await page.fill('#cloudEmail', 'staff@example.com');
  await page.fill('#cloudPass', 'whatever');
  await page.click('#cloudSignInBtn');

  // 3) Wait until the REAL maybeDailySnapshot() has POSTed a snapshot to the (mock) cloud.
  await page.waitForFunction(() => window.__cloud && window.__cloud.snapshots.length >= 1, { timeout: 6000 });
  const snapInfo = await page.evaluate(() => {
    const s = window.__cloud.snapshots[0];
    return { id: s.id, day: s.day, rowsInSnapshot: (s.data || []).length };
  });

  // 4) CHANGE the local data (rename one loan, delete the other), so restore has something to undo.
  const afterChange = await page.evaluate(() => {
    loans[0].name = 'CHANGED NAME';
    loans.splice(1, 1);                 // delete the 2nd loan locally
    try { recomputeAll(); } catch (_) {}
    save();
    return { count: loans.length, firstName: loans[0].name };
  });

  // 5) RESTORE the snapshot through the real function, then read the data back.
  const restored = await page.evaluate(async (id) => {
    await window.cloudRestoreSnapshot(id);
    // give the async restore a tick to finish its save/rerender
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify(loans);
  }, snapInfo.id);

  const exact = restored === original;
  const origObj = JSON.parse(original), restObj = JSON.parse(restored);

  console.log('\n===== CLOUD SNAPSHOT CREATE -> RESTORE =====');
  console.log('  1. Original book:      ', origObj.length, 'loans', origObj.map(l => l.id + '/' + l.name).join(', '));
  console.log('  2. Snapshot created:   id=' + snapInfo.id + ', day=' + snapInfo.day + ', rows=' + snapInfo.rowsInSnapshot + '  (via real maybeDailySnapshot)');
  console.log('  3. Local data changed: ', afterChange.count, 'loan(s), first name now "' + afterChange.firstName + '"');
  console.log('  4. Restored book:      ', restObj.length, 'loans', restObj.map(l => l.id + '/' + l.name).join(', '), '  (via real cloudRestoreSnapshot)');
  console.log('  5. Exact match to original JSON: ' + exact);
  console.log('  JS page errors: ' + errs.length, errs.length ? errs : '');

  await browser.close();
  const ok = exact && errs.length === 0 &&
    origObj.length === 2 && afterChange.count === 1 && restObj.length === 2 && restObj[0].name === 'Ramesh';
  console.log('\n  ' + (ok ? '✅ RESTORE PROVEN: data came back exactly' : '❌ RESTORE TEST FAILED') + '\n');
  process.exit(ok ? 0 : 1);
})();
