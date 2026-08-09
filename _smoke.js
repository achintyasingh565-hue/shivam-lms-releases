const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const e=[];p.on('pageerror',x=>e.push(String(x)));
await p.goto('file://'+require('path').resolve(process.cwd(),'index.html'),{waitUntil:'load'});await p.waitForTimeout(500);
const r=await p.evaluate(()=>{ try{ openLoan(null); addIdRow(); idRowNum(0,'721585602980'); idRowType(0,'Aadhaar'); addIdRow(); idRowType(1,'PAN'); idRowNum(1,'JXBPK7550J'); var res=_collectIds(); var mir=_idMirror(res.ids); return {ok:res.ok, ids:res.ids, mir:mir, rows:document.querySelectorAll('#m_idlist .id-row').length}; }catch(err){ return {err:String(err)}; } });
console.log(JSON.stringify(r)); console.log('ERRORS',JSON.stringify(e)); await b.close();})();
