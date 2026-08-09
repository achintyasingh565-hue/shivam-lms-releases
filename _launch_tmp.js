const { chromium } = require('playwright');
(async () => {
  try {
    console.log('launching...');
    const b = await chromium.launch({ args:['--no-sandbox'] });
    console.log('launched');
    const p = await b.newPage();
    await p.goto('data:text/html,<h1>hi</h1>');
    console.log('title bytes', await p.evaluate(()=>document.body.innerText));
    await b.close();
    console.log('OK');
  } catch(e){ console.log('ERR', String(e)); }
})();
