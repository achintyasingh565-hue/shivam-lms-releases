const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:960, height:900, deviceScaleFactor:1.4 } });
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil:'load' });
  await p.waitForTimeout(400);
  const html = await p.evaluate(() => {
    openBlankLetter();
    const body = document.getElementById('blBody');
    body.innerHTML = '<p>Dear Sir/Madam,</p><p>This is to certify that the following are true:</p><ul><li>Point <b>one</b> is important.</li><li>Point two follows.</li></ul><p>Kindly acknowledge receipt.</p>';
    document.getElementById('blRef').value = 'SE/2026/014';
    // capture print HTML
    let cap=null; const orig=document.createElement.bind(document);
    document.createElement=function(t){const el=orig(t); if(String(t).toLowerCase()==='iframe'&&!cap)cap=el; return el;};
    printBlankLetter();
    document.createElement=orig;
    return cap && cap.contentDocument ? '<!DOCTYPE html>'+cap.contentDocument.documentElement.outerHTML : 'NO';
  });
  console.log('errs=', errs.length, 'htmlok=', html.startsWith('<!DOCTYPE'));
  // modal screenshot
  const card = await p.$('#blOverlay > div');
  if (card) await card.screenshot({ path:'/sessions/exciting-dreamy-newton/mnt/outputs/_bl_modal.png' });
  // render printed letter
  if (html.startsWith('<!DOCTYPE')) {
    fs.writeFileSync('/tmp/bl.html', html);
    const pg = await b.newPage();
    await pg.setContent(html, {waitUntil:'networkidle'});
    await pg.pdf({ path:'/tmp/bl.pdf', format:'A4', printBackground:true });
    await pg.close();
  }
  await b.close(); console.log('DONE');
})();
