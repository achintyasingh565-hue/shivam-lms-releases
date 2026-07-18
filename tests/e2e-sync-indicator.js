// Proves the top-bar sync pill reflects REAL sync state (not cosmetic):
//   signed-out -> "Sign in";  signed-in+ok -> "Synced";  push fails -> "Offline — N pending".
// Uses the real setStatus/pushChanged path with a mock backend whose "online"
// flag we flip to simulate the network dropping.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));

  await page.addInitScript(() => {
    window.confirm = () => true;
    const store = { online: true, loans: [], snapshots: [], seq: 0 };
    window.__cloud = store;
    const res = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (url, opts) => {
      url = String(url); opts = opts || {}; const m = (opts.method || 'GET').toUpperCase();
      if (url.includes('/auth/v1/token')) return res({ access_token: 't', refresh_token: 'r', expires_in: 3600 });
      if (url.includes('/rest/v1/loans')) {
        if (m === 'POST') { if (!store.online) throw new TypeError('Failed to fetch'); return res([], 201); }
        if (!store.online) throw new TypeError('Failed to fetch');
        return res([]);
      }
      if (url.includes('/rest/v1/snapshots')) { if (m === 'POST') return res([{ id: ++store.seq }], 201); return res([]); }
      return res([]);
    };
  });

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });

  const readPill = () => page.evaluate(() => {
    const el = document.getElementById('cloudStatus');
    return { state: el && el.getAttribute('data-state'), label: el && el.querySelector('.cs-label').textContent,
             visible: el && el.style.display !== 'none', info: window.cloudSyncInfo ? window.cloudSyncInfo() : null };
  });

  // A) signed-out state
  await page.waitForSelector('#cloudSignIn', { timeout: 4000 });
  const signedOut = await readPill();

  // B) sign in -> Synced
  await page.evaluate(() => { loans.splice(0, loans.length, { id: 'K1', name: 'A', principal: 1000, rate: 2, tenure: 10, tint: 200, tpay: 1200, emi: 120, disb: '2025-06-01', payments: [], status: 'Active' }); try { recomputeAll(); } catch (_) {} save(); });
  await page.fill('#cloudEmail', 's@e.com'); await page.fill('#cloudPass', 'x'); await page.click('#cloudSignInBtn');
  await page.waitForFunction(() => { const e = document.getElementById('cloudStatus'); return e && e.getAttribute('data-state') === 'synced'; }, { timeout: 6000 });
  const synced = await readPill();

  // C) drop the network, make a change -> "Offline — N pending"
  await page.evaluate(() => { window.__cloud.online = false; loans.push({ id: 'K2', name: 'B', principal: 500, rate: 2, tenure: 5, tint: 50, tpay: 550, emi: 110, disb: '2025-06-02', payments: [], status: 'Active' }); try { recomputeAll(); } catch (_) {} save(); });
  await page.waitForFunction(() => { const e = document.getElementById('cloudStatus'); return e && e.getAttribute('data-state') === 'offline' && /pending/.test(e.querySelector('.cs-label').textContent); }, { timeout: 6000 });
  const offline = await readPill();

  console.log('\n===== SYNC INDICATOR (real state) =====');
  console.log('  A) signed out ->', JSON.stringify(signedOut));
  console.log('  B) signed in  ->', JSON.stringify(synced));
  console.log('  C) offline    ->', JSON.stringify(offline));
  console.log('  JS page errors:', errs.length, errs.length ? errs : '');

  await browser.close();
  const ok =
    signedOut.label === 'Sign in' &&
    synced.state === 'synced' && synced.label === 'Synced' && synced.info && synced.info.signedIn === true &&
    offline.state === 'offline' && /Offline — \d+ pending/.test(offline.label) && offline.info.pending >= 1 &&
    errs.length === 0;
  console.log('\n  ' + (ok ? '✅ INDICATOR READS REAL STATE' : '❌ INDICATOR TEST FAILED') + '\n');
  process.exit(ok ? 0 : 1);
})();
