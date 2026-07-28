const { chromium } = require('playwright'); const path=require('path');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:800}});
  await p.goto('file://'+path.resolve(process.cwd(),'index.html'),{waitUntil:'load'});
  await p.waitForTimeout(600);
  const mark=await p.$('.auth-mark');
  if(mark) await mark.screenshot({path:'/tmp/shot_authmark.png'});
  // force-show the sidebar brand regardless of lock state
  await p.evaluate(()=>{
    document.querySelectorAll('.lockscreen,.lock-screen,#lockOverlay').forEach(e=>e.style.display='none');
    const app=document.querySelector('.app'); if(app){app.style.display='';app.style.visibility='visible';app.style.opacity='1';}
    const sb=document.querySelector('.side-brand'); if(sb){sb.style.background='#0f1729';sb.style.padding='22px';}
  });
  await p.waitForTimeout(200);
  const sb=await p.$('.side-brand');
  if(sb) await sb.screenshot({path:'/tmp/shot_sidebar.png'});
  await b.close();
  console.log('mark?',!!mark,'sidebar?',!!sb);
})();
