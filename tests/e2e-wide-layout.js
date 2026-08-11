// Proves the certificate form, loan-documents form and the sign-in card widen to
// use a big monitor instead of sitting as a small centered island (860px / 940px).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2560, height: 1400 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    const w = sel => { const e = document.querySelector(sel); if (!e) return 0; return Math.round(e.getBoundingClientRect().width); };
    const activate = id => { document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); const s = document.getElementById(id); if (s) s.classList.add('active'); };

    activate('sec-cert');
    const certForm = w('#sec-cert .cert-form');
    activate('sec-hpfile');
    const hpForm = w('#sec-hpfile .hp-form');

    // sign-in card
    let authWrap = 0;
    try { if (typeof showLock === 'function') showLock(); } catch (e) {}
    const ls = document.querySelector('.lockscreen'); if (ls) ls.classList.add('show');
    authWrap = w('.auth-wrap');

    return { certForm, hpForm, authWrap };
  });

  const checks = {
    'certificate form widens on big screen (>1100px)': out.certForm > 1100,
    'loan-documents form widens on big screen (>1100px)': out.hpForm > 1100,
    'sign-in card widens on big screen (>1100px)':       out.authWrap > 1100,
    'no page errors':                                    errs.length === 0
  };

  console.log('\n===== WIDE-SCREEN LAYOUT (2560px) =====');
  console.log('  widths:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ FORMS & SIGN-IN USE THE FULL DISPLAY' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
