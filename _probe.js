const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + require('path').resolve(process.cwd(), 'index.html'), { waitUntil:'load' });
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => ({ showing:[...document.querySelectorAll('.overlay.show')].map(e=>e.id||('cls:'+e.className)) }));
  console.log("SHOWING="+JSON.stringify(r.showing)); await b.close();
})();
