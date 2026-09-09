const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file:///sessions/exciting-dreamy-newton/mnt/outputs/shivam-enterprises-letterhead.html', { waitUntil:'networkidle' });
  await p.pdf({ path:'/sessions/exciting-dreamy-newton/mnt/outputs/shivam-enterprises-letterhead.pdf', format:'A4', printBackground:true });
  await b.close(); console.log('PDF_OK');
})();
