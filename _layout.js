const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
 for(const w of [1440,2560,3440]){
   const p=await b.newPage({viewport:{width:w,height:1440}});
   await p.goto('file://'+require('path').resolve(process.cwd(),'index.html'),{waitUntil:'load'});
   await p.waitForTimeout(300);
   const r=await p.evaluate(()=>{ document.body.classList.add('unlocked'); var c=document.querySelector('.content'); if(!c) return null; var cr=c.getBoundingClientRect(); var sb=document.querySelector('.sidebar'); var sw=sb?sb.getBoundingClientRect().width:0; var avail=window.innerWidth-sw; var gutterL=cr.left-sw; var gutterR=window.innerWidth-cr.right; return {vw:window.innerWidth, sidebar:Math.round(sw), contentW:Math.round(cr.width), gutterL:Math.round(gutterL), gutterR:Math.round(gutterR)}; });
   console.log('viewport',w,'->',JSON.stringify(r));
   await p.close();
 }
 await b.close();})();
