// Blank letterhead composer: a stray backdrop click must NOT close/erase it, the draft
// must survive close+reopen, paste must insert, and font/size controls must not error.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const out = await p.evaluate(() => {
    openBlankLetter();
    const body = document.getElementById('blBody');
    body.innerHTML = '<p>Test paragraph one.</p>';
    blSaveDraft();

    let fontErr = false;
    try { blFont("Arial, sans-serif"); blSize('5'); } catch (e) { fontErr = String(e); }

    // a stray click on the dim backdrop must NOT close the composer
    const ov = document.getElementById('blOverlay');
    ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const stillOpen = ov.style.display !== 'none';

    // close then reopen -> the typed content is preserved
    closeBlankLetter();
    const hid = ov.style.display === 'none';
    openBlankLetter();
    const preserved = document.getElementById('blBody').innerHTML.indexOf('Test paragraph one') >= 0;

    // paste inserts text
    let pasted = false;
    try {
      const dt = new DataTransfer(); dt.setData('text/plain', 'Pasted line');
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      document.getElementById('blBody').focus();
      document.getElementById('blBody').dispatchEvent(ev);
      pasted = document.getElementById('blBody').innerText.indexOf('Pasted line') >= 0;
    } catch (e) { pasted = false; }

    return { fontErr, stillOpen, hid, preserved, pasted };
  });

  const checks = {
    'font & size controls do not error':          out.fontErr === false,
    'backdrop click does NOT close (no data loss)': out.stillOpen === true,
    'Close button hides the composer':            out.hid === true,
    'draft is preserved across close + reopen':   out.preserved === true,
    'paste inserts content':                      out.pasted === true,
    'no page errors':                             errs.length === 0
  };

  console.log('\n===== BLANK LETTERHEAD COMPOSER =====');
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ COMPOSER: NO ACCIDENTAL LOSS, PASTE & FONT CONTROLS WORK' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
