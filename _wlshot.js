const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:900, height:1400, deviceScaleFactor:2 } });
  await p.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil:'load' });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    loans.splice(0, loans.length, { id:'WL', name:'Ramesh Kumar', reltype:'s/o', relname:'Suresh Kumar', addr:'D-55, Indira Nagar, Lucknow', acno:'SE-9001', type:'Personal Loan', secured:false, principal:100000, rate:2, tenure:10, tint:20000, tpay:120000, emi:12000, disb:'2026-10-05', due:'2026-11-05', status:'Active', payments:[] });
    openWelcomeLetter('WL');
  });
  await p.waitForTimeout(300);
  const card = await p.$('#wlOverlay > div');
  await card.screenshot({ path:'/sessions/exciting-dreamy-newton/mnt/outputs/_wl_preview.png' });
  await b.close(); console.log('SHOT_OK');
})();
