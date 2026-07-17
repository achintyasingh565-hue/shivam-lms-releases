// App health check — loads the built app headless and verifies 10 subsystems,
// with special focus on confirming storage still works after the SQLite layer
// was removed (localStorage primary + IndexedDB mirror + Supabase cloud remain).
// Exits non-zero if any check fails or any JS error is seen.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const jsErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => jsErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const out = await page.evaluate(() => {
    const checks = [];
    const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || '' });

    // 1. Lock screen rendered with the injected version footer
    const ver = (document.querySelector('.auth-verline') || {}).textContent || '';
    add('Lock screen + version footer render', /Version\s+\d+\.\d+\.\d+/.test(ver), ver.trim());

    // 2. Core store globals exist (loans is a global `let` binding, not a window prop)
    add('Core store present (loans/save/load/recomputeLoan)',
      typeof loans !== 'undefined' && Array.isArray(loans) && typeof save === 'function' &&
      typeof load === 'function' && typeof recomputeLoan === 'function');

    // 3. Renderers present
    add('Renderers present (renderDash/renderLoans)',
      typeof renderDash === 'function' && typeof renderLoans === 'function');

    // 4. SQLite bridge is fully gone (no electronAPI in browser, dbPersist undefined)
    add('SQLite layer absent (dbPersist undefined, no db bridge)',
      typeof dbPersist === 'undefined' &&
      (typeof window.electronAPI === 'undefined' ||
        (window.electronAPI && !window.electronAPI.dbSaveLoans)));

    // 5. PRIMARY STORAGE WORKS without SQLite: write via save(), read back from localStorage
    let storageOk = false, storageDetail = '';
    try {
      const testLoan = { id: 'HC-1', name: 'Health Check', acno: 'HC-1', principal: 100000,
        rate: 2, tenure: 12, tint: 24000, tpay: 124000, emi: 10333, disb: '2025-06-01',
        payments: [], status: 'Active' };
      loans.splice(0, loans.length, testLoan);
      save();                                        // must not throw now that dbPersist is gone
      const raw = localStorage.getItem(STORE);
      const parsed = raw ? JSON.parse(raw) : [];
      storageOk = parsed.length === 1 && parsed[0].id === 'HC-1';
      storageDetail = 'localStorage rows=' + parsed.length;
    } catch (e) { storageDetail = 'threw: ' + e.message; }
    add('save() persists to localStorage (no throw)', storageOk, storageDetail);

    // 6. IndexedDB durable mirror still wired
    add('IndexedDB mirror intact (idbSetLoans/idbGetLoans)',
      typeof idbSetLoans === 'function' && typeof idbGetLoans === 'function');

    // 7. Cloud sync module untouched
    add('Supabase cloud sync present (cloudPush)', typeof cloudPush === 'function');

    // 8. Firm-details module untouched
    add('Firm-details module present (renderFirmPanel)', typeof renderFirmPanel === 'function');

    // 9. Recompute math intact (flat-interest totals)
    let mathOk = false, mathDetail = '';
    try {
      const l = { id: 'M1', principal: 100000, rate: 2, tenure: 12, tint: 24000,
        tpay: 124000, emi: 10333, disb: '2025-06-01', payments: [
          { date: '2025-07-01', amount: 10333, status: 'Cleared', mode: 'Cash' } ], status: 'Active' };
      recomputeLoan(l);
      mathOk = l.outstanding === 124000 - 10333;
      mathDetail = 'outstanding=' + l.outstanding + ' (expect ' + (124000 - 10333) + ')';
    } catch (e) { mathDetail = 'threw: ' + e.message; }
    add('Loan math intact (recomputeLoan outstanding)', mathOk, mathDetail);

    // 10. Key screens present in the DOM
    const ids = ['sec-cert', 'sec-hpfile', 'sec-proposal'];
    const present = ids.filter(id => document.getElementById(id)).length;
    const anyNav = document.querySelectorAll('[onclick*="nav("], .navbtn, nav, aside').length > 0;
    add('Document sections + navigation render', present >= 1 && anyNav,
      'docSections=' + present + '/' + ids.length);

    return { checks };
  });

  const passed = out.checks.filter(c => c.pass).length;
  const total = out.checks.length;
  console.log('\n===== HEALTH CHECK =====');
  out.checks.forEach((c, i) =>
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  [${i + 1}/${total}] ${c.name}${c.detail ? '  — ' + c.detail : ''}`));
  console.log(`\n  RESULT: ${passed}/${total} checks passed`);
  console.log(`  JS page errors: ${jsErrors.length}`, jsErrors.length ? jsErrors : '');
  console.log(`  Console errors: ${consoleErrors.length}`, consoleErrors.length ? consoleErrors : '');

  await browser.close();
  const ok = passed === total && jsErrors.length === 0 && consoleErrors.length === 0;
  console.log(`\n  ${ok ? '✅ HEALTHY (10/10, zero JS errors)' : '❌ NOT HEALTHY'}\n`);
  process.exit(ok ? 0 : 1);
})();
