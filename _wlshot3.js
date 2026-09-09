const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:920, height:1700, deviceScaleFactor:1.4 } });
  await p.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil:'load' });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    loans.splice(0, loans.length, { id:'WL', name:'Ramesh Kumar', reltype:'s/o', relname:'Suresh Kumar', addr:'D-55, Indira Nagar, Lucknow', phone:'9839125800', coname:'Sunita Devi', acno:'SE-2627-0001', type:'Personal Loan', secured:false, principal:100000, rate:2, tenure:6, tint:12000, tpay:112000, emi:18667, disb:'2026-10-05', due:'2026-11-05', status:'Active', payments:[] });
    openWelcomeLetter('WL');
    const inner = document.querySelector('#wlOverlay > div > div:last-child');
    inner.style.maxHeight='none'; inner.style.overflow='visible';
  });
  await p.waitForTimeout(300);
  const card = await p.$('#wlOverlay > div');
  await card.screenshot({ path:'/sessions/exciting-dreamy-newton/mnt/outputs/_wl_brand.png' });
  await b.close(); console.log('OK');
})();
