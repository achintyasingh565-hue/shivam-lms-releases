// Proves the OFFLINE path still persists a loan across an app "restart" (reload):
// with no cloud session, a saved loan must survive because localStorage is the
// primary store (SQLite removal must not have weakened this).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');

  await page.goto(url, { waitUntil: 'load' });
  // Work offline: dismiss the sign-in prompt if it appears (no cloud session).
  try { await page.waitForSelector('#cloudSkip', { timeout: 3000 }); await page.click('#cloudSkip'); } catch (_) {}

  // Add a loan and save (offline path -> localStorage).
  const beforeRestart = await page.evaluate(() => {
    loans.splice(0, loans.length, { id: 'OFF1', name: 'Offline Borrower', acno: 'A-OFF', principal: 75000,
      rate: 2, tenure: 10, tint: 15000, tpay: 90000, emi: 9000, disb: '2025-06-01', payments: [], status: 'Active' });
    try { recomputeAll(); } catch (_) {}
    save();
    return { count: loans.length, inLocalStorage: !!(localStorage.getItem(STORE) || '').includes('OFF1') };
  });

  // "Restart" the app.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(400);

  const afterRestart = await page.evaluate(() => {
    const l = (loans || []).find(x => x && x.id === 'OFF1');
    return { count: (loans || []).length, found: !!l, name: l && l.name,
             outstanding: l && l.outstanding, inLocalStorage: !!(localStorage.getItem(STORE) || '').includes('OFF1') };
  });

  console.log('\n===== OFFLINE PERSISTENCE ACROSS RESTART =====');
  console.log('  before restart:', JSON.stringify(beforeRestart));
  console.log('  after  restart:', JSON.stringify(afterRestart));
  console.log('  JS page errors:', errs.length, errs.length ? errs : '');

  await browser.close();
  const ok = beforeRestart.inLocalStorage && afterRestart.found && afterRestart.name === 'Offline Borrower' && errs.length === 0;
  console.log('\n  ' + (ok ? '✅ OFFLINE LOAN SURVIVED RESTART' : '❌ OFFLINE PERSISTENCE FAILED') + '\n');
  process.exit(ok ? 0 : 1);
})();
