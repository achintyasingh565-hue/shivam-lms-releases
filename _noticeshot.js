const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil:'load' });
  await p.waitForTimeout(400);
  const html = await p.evaluate(() => {
    loans.splice(0, loans.length, { id:'L', name:'Ashish Maurya', reltype:'s/o', relname:'Ram Maurya', addr:'D-55, Indira Nagar, Lucknow', phone:'9839125800', acno:'SE-2627-0007', type:'Personal', principal:150000, rate:2, tenure:24, tint:72000, tpay:222000, emi:9250, disb:'2026-01-05', due:'2026-06-05', status:'Overdue', payments:[{date:'2026-02-05',mode:'Cash',amount:9250,status:'Cleared'}] });
    try { recomputeAll(); } catch(e){}
    let cap=null; const orig=document.createElement.bind(document);
    document.createElement=function(t){const el=orig(t); if(String(t).toLowerCase()==='iframe'&&!cap)cap=el; return el;};
    try { openDefaultNotice('L'); } catch(e){ return 'ERR_open:'+e.message; }
    try { printDefaultDoc(); } catch(e){ return 'ERR_print:'+e.message; }
    document.createElement=orig;
    return cap && cap.contentDocument ? '<!DOCTYPE html>'+cap.contentDocument.documentElement.outerHTML : 'NO_IFRAME';
  });
  console.log('errs=',errs.length,'ok=',html.startsWith('<!DOCTYPE'),'hasCorner=',html.includes('doc-corner'),'serif=',html.includes('Georgia'),'gst=',/GSTIN/.test(html));
  if(html.startsWith('<!DOCTYPE')){ fs.writeFileSync('/tmp/notice.html',html);
    const pg=await b.newPage(); await pg.setContent(html,{waitUntil:'networkidle'}); await pg.pdf({path:'/tmp/notice.pdf',format:'A4',printBackground:true}); await pg.close();
  } else { console.log(html.slice(0,160)); }
  await b.close();
})();
