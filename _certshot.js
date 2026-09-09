const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:900, height:1300, deviceScaleFactor:1.3 } });
  await p.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil:'load' });
  await p.waitForTimeout(400);
  const info = await p.evaluate(() => {
    loans.splice(0, loans.length, { id:'C1', name:'Ramesh Kumar', reltype:'s/o', relname:'Suresh Kumar', addr:'D-55, Indira Nagar, Lucknow', acno:'SE-2627-0001', type:'Personal Loan', secured:true, principal:100000, rate:2, tenure:6, tint:12000, tpay:112000, emi:18667, disb:'2026-04-05', status:'Closed', payments:[{date:'2026-05-05',mode:'Cash',amount:112000,status:'Cleared'}] });
    try { if (typeof certFromLoan==='function') certFromLoan('C1'); } catch(e){ return 'ERR:'+e; }
    const pc = document.getElementById('pageCert');
    return { hasWM: !!(pc && pc.querySelector('.pg-wm')), hasCorner: !!(pc && pc.querySelector('.pg-corner')), addr: pc? (pc.querySelector('.lh-addr')||{}).textContent : '' };
  });
  console.log(JSON.stringify(info));
  const pc = await p.$('#pageCert');
  if (pc) await pc.screenshot({ path:'/sessions/exciting-dreamy-newton/mnt/outputs/_cert_brand.png' });
  await b.close();
})();
