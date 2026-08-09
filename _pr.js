const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const e=[];p.on('pageerror',x=>e.push(String(x)));
await p.goto('file://'+require('path').resolve(process.cwd(),'index.html'),{waitUntil:'load'});await p.waitForTimeout(400);
const r=await p.evaluate(()=>{ window.print=()=>{}; window.confirm=()=>true;
 loans.splice(0,loans.length,{id:'D1',name:'Achintya',acno:'SE-0003',phone:'9838100000',principal:100000,rate:2,tenure:12,tint:24000,tpay:124000,emi:10333,disb:'2025-06-01',due:'2026-01-01',arrears:20000,outstanding:190000,status:'Overdue',payments:[]});
 try{ defPickBorrower('D1'); defPreview(); printDefaultDoc(); return {ok:true}; }catch(err){ return {ok:false,err:String(err)}; }
});
console.log('RESULT',JSON.stringify(r),'ERRORS',JSON.stringify(e)); await b.close();})();
