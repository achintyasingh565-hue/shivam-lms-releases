const { chromium } = require('playwright'); const path=require('path');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  await p.goto('file://'+path.resolve(process.cwd(),'index.html'),{waitUntil:'load'}); await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{
    const iso=dt=>dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
    const base=new Date(); const due=new Date(base); due.setDate(base.getDate()+3); const disb=new Date(base); disb.setDate(base.getDate()-27);
    localStorage.removeItem('shivam_autoqueue_v1'); localStorage.removeItem('shivam_autorem_seen_v1'); localStorage.removeItem('shivam_autorem_cfg_v1');
    loans.splice(0,loans.length,{id:'R1',name:'Due Soon',acno:'SE-R001',phone:'9333333333',principal:120000,rate:2,tenure:12,tint:28800,tpay:148800,emi:12400,outstanding:148800,arrears:0,payments:[],disb:iso(disb),due:iso(due)});
    try{recomputeLoan(loans[0]);}catch(e){}
    save();
    const c=autoRemCfg();
    const t=todayISO();
    const l=loans[0];
    const dleft=repDaysBetween(t,l.due);
    const before=autoQueueLoad().length;
    const scan=autoRemScan();
    return { cEnabled:c.enabled, cEmi:c.emi, emiDays:c.emiDays, t, due:l.due, st:autoStatus(l), dleft, outstanding:l.outstanding, before, added:scan.added, qAfter:autoQueueLoad().length };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
