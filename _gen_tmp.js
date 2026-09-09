const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:840, height:1188, deviceScaleFactor:2 } });
  const url = 'file:///sessions/exciting-dreamy-newton/mnt/outputs/shivam-enterprises-letterhead.html';
  await p.goto(url, { waitUntil:'networkidle' });
  await p.pdf({ path:'/sessions/exciting-dreamy-newton/mnt/outputs/shivam-enterprises-letterhead.pdf', format:'A4', printBackground:true });
  await p.screenshot({ path:'/sessions/exciting-dreamy-newton/mnt/outputs/_lh_preview.png', clip:{ x:0, y:0, width:840, height:1188 } });
  await b.close(); console.log('DONE');
})();
