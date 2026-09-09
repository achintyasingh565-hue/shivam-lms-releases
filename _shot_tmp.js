const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:840, height:1188, deviceScaleFactor:2 } });
  await p.goto('file:///sessions/exciting-dreamy-newton/mnt/outputs/shivam-enterprises-letterhead.html', { waitUntil:'networkidle' });
  await p.screenshot({ path:'/sessions/exciting-dreamy-newton/mnt/outputs/_lh_preview.png', clip:{ x:0, y:0, width:840, height:1188 } });
  await b.close(); console.log('SHOT_OK');
})();
