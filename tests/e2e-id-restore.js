// Proves the "Restore readable IDs" recovery actually decrypts enc1: values back
// to plain text and turns encryption off — the fix for IDs showing as enc1:… .
// Uses the in-page crypto (WebCrypto is available headless) via the __idcrypto hook.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(async () => {
    // derive a key from a passphrase, then encrypt two ID values to enc1: tokens
    await window.__idcrypto.setKey('secret-pass');
    var encAadhaar = await window.__idcrypto.enc('123456789012');
    var encPan = await window.__idcrypto.enc('ABCDE1234F');
    var looksEncrypted = String(encAadhaar).indexOf('enc1:') === 0 && String(encPan).indexOf('enc1:') === 0;

    // simulate a book where the ID fields are stored encrypted (as the bug showed)
    loans.splice(0, loans.length,
      { id: 'R1', name: 'Enc One', acno: 'SE-9001', idproof: encAadhaar, coid: encPan, principal: 1000 });
    localStorage.setItem('shivam_idenc_on', '1');

    // run the recovery with the passphrase
    var res = await restoreReadableIds('secret-pass');

    var l = loans[0];
    return {
      looksEncrypted, res,
      idproofAfter: l.idproof, coidAfter: l.coid,
      flagAfter: localStorage.getItem('shivam_idenc_on')
    };
  });

  const checks = {
    'values were genuinely encrypted (enc1:)': out.looksEncrypted === true,
    'restore reported success':                out.res && out.res.ok === true && out.res.done === 2,
    'Aadhaar decrypted to plain text':         out.idproofAfter === '123456789012',
    'co-applicant ID decrypted to plain text': out.coidAfter === 'ABCDE1234F',
    'encryption flag turned OFF':              out.flagAfter === '0',
    'no page errors':                          errs.length === 0
  };

  console.log('\n===== RESTORE READABLE IDs =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  console.log('\n  ' + (bad === 0 ? '✅ RECOVERY DECRYPTS IDs AND DISABLES ENCRYPTION' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
