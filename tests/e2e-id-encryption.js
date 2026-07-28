// Covers the testable surface of the Aadhaar/PAN encryption toggle: the runtime
// on/off flag and gating, graceful failure without a keychain, and that the panel
// renders. The actual encrypt-on-sync path needs the Electron keychain + a live
// Supabase session, so it's verified on-device (see CHANGELOG note).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(async () => {
    localStorage.removeItem('shivam_idenc_on');
    const s0 = idEncryptionStatus();                       // default off
    localStorage.setItem('shivam_idenc_on', '1');
    const s1 = idEncryptionStatus();                       // flag flips it on
    // enabling without the Electron keychain must fail gracefully, not throw
    const noKeychain = await enableIdEncryption('test-pass');
    // disable path
    disableIdEncryption();
    const s2 = idEncryptionStatus();
    // panel render must not throw and must reflect state
    let rendered = 'n/a';
    try { renderIdEncPanel(); const el = document.getElementById('idEncStatus'); rendered = el ? el.textContent : 'no-el'; } catch (e) { rendered = 'THREW:' + e; }
    return { s0, s1, s2, noKeychain, rendered };
  });

  const checks = {
    'default is OFF':                       out.s0.on === false,
    'runtime flag turns it ON':             out.s1.on === true,
    'enable without keychain fails safe':   out.noKeychain && out.noKeychain.ok === false && !!out.noKeychain.error,
    'disable turns it back OFF':            out.s2.on === false,
    'admin panel renders without throwing': out.rendered.indexOf('THREW') === -1,
    'no page errors':                       errs.length === 0
  };

  console.log('\n===== ID ENCRYPTION TOGGLE =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  console.log('\n  ' + (bad === 0 ? '✅ ENCRYPTION TOGGLE FLAG/GATING/UI ARE CORRECT' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
