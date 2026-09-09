const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil:'load' });
  await p.waitForTimeout(400);
  const html = await p.evaluate(() => {
    openBlankLetter();
    const body = document.getElementById('blBody');
    // mimic the user's loan-details letter
    let h = '<div><u><b>PRAVEEN SINGH [2%]</b></u></div><div style="text-align:center"><u><b>LOAN DETAILS</b></u></div><div><br></div>';
    const entries = [
      ['24/07/2022','17928','2,00,000','1,92,000','','38,333x6= 2,29,998'],
      ['31/01/2022','17961','3,00,000','2,44,834','Adjustment= 42,166','56,000x6= 3,36,000'],
      ['14/09/2022','17992','4,00,000 [Baba Medicals]','3,84,000','','58,000x8= 4,64,000'],
      ['23/10/2022','17801','2,00,000','1,92,000','Cash Received= 50,000 - 1,92,000= 1,42,000[Bank]','37,334x6= 2,24,004'],
      ['04/11/2023','17801','1,00,000','96,000','Cash Received= 50,000 - 96,000= 46,000[Bank]','18,666x6= 1,11,996'],
      ['20/02/2023','17824','4,00,000','3,28,000','Adjustment= 56,000','74,666x6= 4,47,996'],
      ['14/09/2023','17850','3,00,000','1,38,500','Adjustment= 1,49,500','31,000x12= 3,72,000'],
    ];
    entries.forEach(e=>{ h+='<div><u><b>'+e[0]+'</b></u></div><div><u><b>Acc No-'+e[1]+'</b></u></div><div>Loan Amount= '+e[2]+'</div>'+(e[4]?('<div>'+e[4]+'</div>'):'')+'<div>Disbursed Amount= '+e[3]+'</div><div><b>EMI= '+e[5]+'</b></div>'; });
    h+='<div><br></div><div><u><b>Amount Received till Date- 21,85,994</b></u></div>';
    body.innerHTML = h;
    document.getElementById('blRef').value = 'Old Case';
    let cap=null; const orig=document.createElement.bind(document);
    document.createElement=function(t){const el=orig(t); if(String(t).toLowerCase()==='iframe'&&!cap)cap=el; return el;};
    printBlankLetter();
    document.createElement=orig;
    return cap && cap.contentDocument ? '<!DOCTYPE html>'+cap.contentDocument.documentElement.outerHTML : 'NO';
  });
  fs.writeFileSync('/tmp/bllong.html', html);
  const pg = await b.newPage();
  await pg.setContent(html, {waitUntil:'networkidle'});
  await pg.pdf({ path:'/tmp/bllong.pdf', format:'A4', printBackground:true });
  await pg.close();
  await b.close(); console.log('DONE');
})();
