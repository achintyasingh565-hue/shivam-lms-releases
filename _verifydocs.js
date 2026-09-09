const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil:'load' });
  await p.waitForTimeout(400);
  // capture each document's print HTML by intercepting the iframe it writes into
  const grab = async (setup, fnName, arg) => {
    return await p.evaluate(({setup, fnName, arg}) => {
      try {
        // setup
        eval(setup);
        let cap = null;
        const orig = document.createElement.bind(document);
        document.createElement = function(t){ const el = orig(t); if(String(t).toLowerCase()==='iframe' && !cap) cap = el; return el; };
        try { window[fnName] ? window[fnName](arg) : eval(fnName+'('+(arg!==undefined?JSON.stringify(arg):'')+')'); } catch(e){ return 'ERR:'+e.message; }
        document.createElement = orig;
        const html = (cap && cap.contentDocument) ? '<!DOCTYPE html>'+cap.contentDocument.documentElement.outerHTML : 'NO_IFRAME';
        return html;
      } catch(e){ return 'ERR2:'+e.message; }
    }, {setup, fnName, arg});
  };
  // seed a loan with payments
  await p.evaluate(() => {
    loans.splice(0, loans.length, { id:'L', name:'Ashish Maurya', reltype:'s/o', relname:'Ram Maurya', addr:'D-55, Indira Nagar, Lucknow', phone:'9839125800', coname:'Sita Devi', acno:'SE-2627-0007', type:'Personal', secured:false, principal:150000, rate:2, tenure:24, tint:72000, tpay:222000, emi:9250, downpay:0, deductions:6000, disb:'2026-10-05', due:'2026-11-05', status:'Active', payments:[{date:'2026-11-05',mode:'Cash',amount:9250,status:'Cleared'}] });
  });
  const docs = {};
  docs.welcome  = await grab("openWelcomeLetter('L');", 'printWelcomeLetter');
  docs.schedule = await grab("openSchedule('L');", 'printScheduleDoc');
  docs.receipt  = await grab("", 'printPayReceipt', 'L');   // printPayReceipt(loanId, idx) — idx arg lost; handle below
  docs.notice   = await grab("window._defData={name:'Ashish Maurya',acno:'SE-2627-0007',type:'demand',phone:'9839125800',outstanding:80000,arrears:9250,principal:150000,l:loans[0]}; window._dnLang='en';", 'printDefaultDoc');
  // receipt needs 2 args; call via eval form
  docs.receipt  = await grab("", "printPayReceipt('L',0)", undefined);
  for (const [k,v] of Object.entries(docs)) {
    const ok = typeof v==='string' && v.startsWith('<!DOCTYPE');
    console.log(k, ok?('OK len='+v.length+' corners='+(v.split('doc-corner').length-1)+' wm='+(v.includes('doc-wm')||v.includes('opacity:.05')||v.includes('opacity:0.05'))):('=> '+v.slice(0,120)));
    if (ok) fs.writeFileSync('/tmp/doc_'+k+'.html', v);
  }
  // render page-1 (and page-2 for welcome/schedule) images
  for (const k of ['welcome','schedule','receipt','notice']) {
    if (!fs.existsSync('/tmp/doc_'+k+'.html')) continue;
    const pg = await b.newPage();
    await pg.setContent(fs.readFileSync('/tmp/doc_'+k+'.html','utf8'), {waitUntil:'networkidle'});
    await pg.pdf({ path:'/tmp/doc_'+k+'.pdf', format:'A4', printBackground:true });
    await pg.close();
  }
  await b.close(); console.log('DONE');
})();
