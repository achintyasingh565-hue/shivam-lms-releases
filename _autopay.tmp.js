const { chromium } = require('playwright'); const path=require('path');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.resolve(process.cwd(),'index.html'),{waitUntil:'load'});
  await p.waitForTimeout(600);
  const out=await p.evaluate(()=>{
    const today=todayISO();
    const L={id:'PT1',name:'Ramesh Gupta',acno:'SE-0001',phone:'8528564196',principal:100000,rate:2,tenure:12,tint:24000,tpay:124000,emi:10333,disb:'2025-06-01',due:'2025-07-01',
      payments:[{date:today,amount:10333,status:'Cleared',mode:'Cash',ref:'UTR9'}]};
    loans.splice(0,loans.length,L); try{recomputeLoan(loans[0]);}catch(e){}
    localStorage.setItem('shivam_autoqueue_v1','[]');
    localStorage.setItem('shivam_autorem_seen_v1','[]');
    autoRemScan();
    const q=autoQueueLoad();
    const pc=q.find(x=>x.cat==='Payment Confirmation');
    return { count:q.length, pc: pc?{amount:pc.vars.amount, outstanding:pc.vars.outstanding, name:pc.vars.name, acno:pc.vars.acno}:null };
  });
  console.log('queue count:',out.count);
  console.log('payment-confirmation vars:',JSON.stringify(out.pc));
  const amt=out.pc&&out.pc.amount;
  const leak = amt && /[^\d.,\s]/.test(String(amt));
  console.log('amount has currency symbol?', leak? 'YES (BUG)':'no (plain, good)');
  console.log('pageerrors:',errs.length);
  await b.close();
  process.exit((out.pc && !leak && errs.length===0)?0:1);
})();
