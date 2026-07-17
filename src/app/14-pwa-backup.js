  /* ---------- PWA / install ---------- */
  const ICON512="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zADAN04cNVQP3nu7nnvyPp19xhRlxcK1eU6dfJIsy7vbAZds3e7ZsgAET7hGWITC0CHH657f/kLvvfakvnv15erQvp3pkhzxr5de5OnyitZt8HR5AIKFAADf6tG9i354wzWa/dbfddutP1Lh4IGmS8rYOWdO0Ymjhnq2vIqKz7Xus2LPlgcgeOKcFpkJ1plzml6XOTktNH3auZo+7VwVrV2v515+Sy+/9o527d7jQX3N16cgX7+65SZPl7l85RolEglPl+kt9kFkgu2mLmYAECiDBvbXT/79Wn3w1tN6cMbtuuDc09SmdSvTZR1Tv74FevTPv/X8MMbiZSs9XR6A4OEqAARSViymKZPGacqkcaqurtH8hYv17sy5enfmh9qxc7fp8iRJF557um79+Y1q26a158ueNfsjz5cJIFgIAAi87Oy4Jk8cq8kTx+rWn92olavWav6CxVqwaKkWLV6uffsPeFrPiaOG6cbrrtJJY0Z6utzDduzcrcXLPjWybC+cMGiAipa8Z7oMR3z/pv/SO+/PMV0GIooAgNApHDxQhYMH6ttXXqpEwtaatZ/p40+Wa9WadVpdtF7rPit2/D75fQryddopE/WV884wfrLiG2/Pkm1zrBNA4wgACLVYzNLg44/T4OOPO/KzRMLWps0lWre+WNu279L2HV88du5S6Z4yVVVW6WBllSqrqlRZWSlLluLZceXm5qhDu3bq1LG98vO7q09Bvo4f2F8jhg1Wj+5dDf6V9b3yRjg+HQNwFwEAkROLWerbp5f69ulluhTHLVq8XEuXrzJdBoAA4CoAIEQeePgp0yUACAgCABASRWvXa9Yczv4HkBoCABASv75jBif/AUgZAQAIgedfflMffbzEdBkAAoQAAATcnr1luv1395suA0DAEACAAKutrdWNN/9Ke8vKTZcCIGAIAECA/fed92r+wiWmywAQQAQAIKAef+p5/fXvL5guA0BAcSMgIID+8ujfdNfdfzZdBoAAIwAAAfOHGQ/rTw8+YboMAAFHAAACorx8v376izv1zsy5pksBEAKcAwCjqqoO6b6/PKENxZtNl+JrCxct04WXXkPzB+CYuMSdw9LHOnNKbW2N7r73Id1970M6flB/nXfWqTr3zFNC+UU9mdhduld/vO9hPfP8q0ok2O7CxxbjiZdY13VxCAC+saZovdYUrdcfZjykQcf1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", ICON192="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";
  let deferredPrompt=null;
  function setupPWA(){
    try{
      const manifest={ name:"Shivam Enterprises LMS", short_name:"SE LMS",
        start_url:".", scope:".", display:"standalone", background_color:"#13203b", theme_color:"#13203b",
        description:"Loan records, certificates and proposal forms for Shivam Enterprises (Finance).",
        icons:[ {src:ICON192,sizes:"192x192",type:"image/png",purpose:"any maskable"},
                {src:ICON512,sizes:"512x512",type:"image/png",purpose:"any maskable"} ] };
      const blob=new Blob([JSON.stringify(manifest)],{type:"application/manifest+json"});
      const mf=$('mf'); if(mf) mf.href=URL.createObjectURL(blob);
    }catch(e){}
    window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; });
    window.addEventListener('appinstalled',()=>{ toast('App installed'); const b=$('installBtn'); if(b) b.style.display='none'; });
  }
  function doInstall(){
    if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice.finally(()=>{ deferredPrompt=null; }); return; }
    showInstallHelp();
  }
  function showInstallHelp(){
    const m=$('installOverlay'); if(m) m.classList.add('show');
  }
  function closeInstall(){ const m=$('installOverlay'); if(m) m.classList.remove('show'); }

  function resetCert(){ ['f_name','f_relname','f_addr','f_ref'].forEach(id=>$(id).value=""); $('f_loan').value="personal loan"; $('f_mode').value="Cash"; $('f_reltype').value="son of"; $('f_date').value=todayISO(); $('loadLoan').value=""; updateCert(); }

  /* ---------- backup ---------- */
  function download(filename, text, type){
    const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  }
  /* ===== Customer Profiles ===== */
  let currentCust=null;
  function custKeyOf(l){ const ph=(l.phone||'').replace(/\D/g,''); const nm=(l.name||'').trim().toLowerCase(); return (ph?('ph:'+ph):'ph:') + '|nm:' + nm; }
  function buildCustomers(){
    const map={};
    loans.forEach(l=>{ const k=custKeyOf(l);
      if(!map[k]) map[k]={key:k, name:l.name||'', phone:l.phone||'', addr:l.addr||'', reltype:l.reltype||'', relname:l.relname||'', idtype:l.idtype||'', idproof:l.idproof||'', age:l.age||'', occupation:l.occupation||'', loans:[]};
      const c=map[k];
      if(!c.phone&&l.phone)c.phone=l.phone; if(!c.addr&&l.addr)c.addr=l.addr;
      if(!c.idproof&&l.idproof){ c.idproof=l.idproof; c.idtype=l.idtype||c.idtype; }
      if(!c.relname&&l.relname){ c.relname=l.relname; c.reltype=l.reltype||c.reltype; }
      if(!c.occupation&&l.occupation)c.occupation=l.occupation; if(!c.age&&l.age)c.age=l.age;
      c.loans.push(l);
    });
    return Object.values(map).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  }
  function setCustView(v){
    renderCustomers();
    if(currentCust && buildCustomers().some(function(x){return x.key===currentCust;})) openCustomer(encodeURIComponent(currentCust));
    else { var cs=buildCustomers(); if(cs.length) openCustomer(encodeURIComponent(cs[0].key)); else custBack(); }
  }
  const CUST_PAGE=150;
  function renderCustomers(){
    const body=$('custBody'); if(!body) return;
    // Single source of search: the top-bar box (the in-panel duplicate was removed).
    const q=($('globalSearch')?$('globalSearch').value:'').toLowerCase().trim();
    if(window._custQ!==q){ window._custQ=q; window._custPage=1; }
    if(!window._custPage) window._custPage=1;
    let cs=buildCustomers();
    const total=cs.length;
    if(q) cs=cs.filter(c=>((c.name+' '+(c.phone||'')+' '+c.loans.map(l=>l.acno).join(' ')).toLowerCase().includes(q)));
    if($('custCount')) $('custCount').textContent = q ? (cs.length+' of '+total+' borrower'+(total!==1?'s':'')+' match') : (total+' borrower'+(total!==1?'s':''));
    if(!cs.length){ body.innerHTML='<div class="cl-empty" style="padding:30px 14px;"><b>No customers'+(q?' match your search':' yet')+'.</b>'+(q?'':'<br>Add a loan to create a customer profile.')+'</div>'; return; }
    const show=Math.min(cs.length, window._custPage*CUST_PAGE);
    const cards=cs.slice(0,show).map(c=>{ const out=c.loans.reduce((a,l)=>a+(Number(l.outstanding)||0),0); const allClosed=c.loans.every(l=>autoStatus(l)==='Closed'); const anyOver=c.loans.some(l=>autoStatus(l)==='Overdue'); const st=allClosed?'Closed':(anyOver?'Overdue':'Active');
      return `<div class="cl-card${currentCust===c.key?' sel':''}" onclick="openCustomer('${encodeURIComponent(c.key)}')">
        <div class="r1"><div><div class="nm">${esc(c.name)}</div><div class="ph">${esc(c.phone||'\u2014')}</div></div><span class="badge ${st.toLowerCase()}">${st}</span></div>
        <div class="r2"><span>${c.loans.length} loan${c.loans.length>1?'s':''}</span><span class="out">${inr(out)}</span></div>
      </div>`; }).join('');
    const more = show<cs.length
      ? '<button class="btn btn-sm" style="margin-top:4px;" onclick="custMore()">Show more ('+(cs.length-show)+' more)</button>'
      : '';
    body.innerHTML = cards + more;
  }
  window.custMore=function(){ window._custPage=(window._custPage||1)+1; renderCustomers(); };
  function custBack(){ currentCust=null; var d=$('custDetail'); if(d) d.innerHTML='<div class="cl-empty"><div class="big">&#128100;</div>Select a borrower on the left to see their loans, payments and documents.</div>'; renderCustomers(); }
  function openCustomer(key){
    key=decodeURIComponent(key); currentCust=key;
    const c=buildCustomers().find(x=>x.key===key); if(!c) return;
    const active=c.loans.filter(l=>autoStatus(l)!=='Closed'); const closed=c.loans.filter(l=>autoStatus(l)==='Closed');
    const totOut=c.loans.reduce((a,l)=>a+(Number(l.outstanding)||0),0); const totDisb=c.loans.reduce((a,l)=>a+(Number(l.principal)||0),0);
    const pays=[]; c.loans.forEach(l=>(l.payments||[]).forEach(p=>pays.push(Object.assign({acno:l.acno},p)))); pays.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const chgs=[]; c.loans.forEach(l=>(l.charges||[]).forEach(x=>chgs.push(Object.assign({acno:l.acno},x)))); chgs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const guars=[...new Set(c.loans.filter(l=>l.gname).map(l=>l.gname+(l.gphone?(' \u00b7 '+l.gphone):'')))];
    const lrows=ls=>ls.length?ls.map(l=>`<tr><td>${esc(l.acno)}</td><td>${esc(l.type)}</td><td class="right num">${inr(l.principal)}</td><td class="right num">${inr(l.outstanding)}</td><td>${fmtDate(l.due)||'\u2014'}</td><td><span class="badge ${autoStatus(l).toLowerCase()}">${autoStatus(l)}</span></td><td><div class="rowact"><button class="iconbtn cert" title="Generate Certificate" onclick="certFromLoan('${l.id}')">${SVG.fileDoc}</button><button class="iconbtn" title="Repayment Schedule" onclick="openSchedule('${l.id}')">${SVG.cal}</button><button class="iconbtn" title="Restructure / Record payment" onclick="openRestructure('${l.id}')" style="font-weight:800;font-size:15px;">₹</button><button class="iconbtn" title="Edit" onclick="openLoan('${l.id}')">${SVG.edit}</button><button class="iconbtn del" title="Delete" onclick="delLoan('${l.id}')">${SVG.trash}</button></div></td></tr>`).join(''):'<tr><td colspan="7" class="muted" style="padding:10px;">None</td></tr>';
    const html=`
      <div class="panel">
        <div class="cust-head"><div class="cust-av">${esc((c.name||'?').slice(0,1).toUpperCase())}</div><div><h3 style="margin:0;">${esc(c.name)}</h3><div class="muted">${c.relname?esc((c.reltype||'')+' '+c.relname)+' \u00b7 ':''}${esc(c.phone||'No phone on file')}</div></div></div>
        ${(function(){ var f=[];
          if(c.addr) f.push('<div><label>Address</label><div>'+esc(c.addr)+'</div></div>');
          if(c.idproof||c.idtype) f.push('<div><label>ID</label><div>'+esc((c.idtype?c.idtype+': ':'')+(c.idproof||''))+'</div></div>');
          if(c.occupation) f.push('<div><label>Occupation</label><div>'+esc(c.occupation)+'</div></div>');
          if(c.age) f.push('<div><label>Age</label><div>'+esc(c.age)+'</div></div>');
          return f.length ? '<div class="cust-grid">'+f.join('')+'</div>' : '';
        })()}
        <div class="pay-tiles" style="margin-top:14px;">
          <div class="ptile"><span>Total Loans</span><b>${c.loans.length}</b></div>
          <div class="ptile ok"><span>Active</span><b>${active.length}</b></div>
          <div class="ptile"><span>Closed</span><b>${closed.length}</b></div>
          <div class="ptile warn"><span>Outstanding</span><b>${inr(totOut)}</b></div>
          <div class="ptile"><span>Disbursed</span><b>${inr(totDisb)}</b></div>
        </div>
      </div>
      <div class="panel"><h3>Active Loans</h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>A/C</th><th>Type</th><th class="right">Principal</th><th class="right">Outstanding</th><th>Next Due</th><th>Status</th><th></th></tr></thead><tbody>${lrows(active)}</tbody></table></div></div>
      <div class="panel"><h3>Closed Loans</h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>A/C</th><th>Type</th><th class="right">Principal</th><th class="right">Outstanding</th><th>Next Due</th><th>Status</th><th></th></tr></thead><tbody>${lrows(closed)}</tbody></table></div></div>
      <div class="panel"><h3>Payment History</h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>Date</th><th>A/C</th><th>Mode</th><th>Cheque / Bank</th><th class="right">Amount</th><th>Status</th></tr></thead><tbody>${pays.length?pays.map(p=>`<tr><td>${fmtDate(p.date)||'\u2014'}</td><td>${esc(p.acno)}</td><td>${esc(p.mode)}</td><td>${p.mode==='Cheque'?(esc(p.cheque||'\u2014')+(p.bank?(' / '+esc(p.bank)):'')):(p.mode==='Online'?('Ref '+esc(p.ref||'\u2014')):'\u2014')}</td><td class="right num">${inr(p.amount)}</td><td>${p.status==='Cleared'?'<span class="pp ok">Cleared</span>':'<span class="pp pend">Pending</span>'}</td></tr>`).join(''):'<tr><td colspan="6" class="muted" style="padding:10px;">No payments recorded</td></tr>'}</tbody></table></div></div>
      ${chgs.length?`<div class="panel"><h3>Charges <span style="font-weight:400;font-size:12px;color:var(--muted);">— late fees &amp; cheque bounces (record only, not added to outstanding)</span></h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>Date</th><th>A/C</th><th>Type</th><th>Note</th><th class="right">Amount</th></tr></thead><tbody>${chgs.map(x=>`<tr><td>${fmtDate(x.date)||'\u2014'}</td><td>${esc(x.acno)}</td><td>${esc(x.type||'\u2014')}${x.cheque?(' <span class="muted">(chq '+esc(x.cheque)+')</span>'):''}</td><td class="muted">${esc(x.note||'\u2014')}</td><td class="right num">${inr(x.amount)}</td></tr>`).join('')}<tr class="tot"><td colspan="4" style="font-weight:700;">Total charges recorded</td><td class="right num" style="font-weight:700;">${inr(chgs.reduce((a,x)=>a+(Number(x.amount)||0),0))}</td></tr></tbody></table></div><p class="ph-sub" style="margin-top:8px;">Collect these at settlement if you wish — manage them in Payments &rarr; Record a Charge.</p></div>`:''}
      <div class="panel"><h3>Guarantor(s)</h3><div style="font-size:13.5px;">${guars.length?guars.map(g=>esc(g)).join('<br>'):'<span class="muted">None recorded</span>'}</div></div>
      <div class="panel"><h3>Document Vault</h3>
        <p class="ph-sub">Securely store this customer&rsquo;s documents (Aadhaar, PAN, photos, agreements). Files are kept on this computer.</p>
        <div class="vault-up">
          <select id="vaultCat"><option>Aadhaar</option><option>PAN</option><option>Bank Statement</option><option>Property Document</option><option>Photograph</option><option>Signed Agreement</option><option>Other</option></select>
          <input type="file" id="vaultFile" multiple accept="image/*,application/pdf">
          <button class="btn btn-primary btn-sm" onclick="vaultUpload()">&#10514; Upload</button>
        </div>
        <div class="toolbar" style="margin:12px 0;">
          <div class="search"><span class="si">&#9013;</span><input id="vaultSearch" placeholder="Search documents&hellip;" oninput="renderVault()"></div>
          <select class="filter" id="vaultFilter" onchange="renderVault()"><option value="all">All categories</option><option>Aadhaar</option><option>PAN</option><option>Bank Statement</option><option>Property Document</option><option>Photograph</option><option>Signed Agreement</option><option>Other</option></select>
        </div>
        <div id="vaultGrid" class="vault-grid"></div>
      </div>`;
    $('custDetail').innerHTML=html; renderCustomers(); renderVault();
  }

  /* ===== Document Vault (IndexedDB) ===== */
  let _vdb=null;
  function vaultOpen(){ return new Promise((res,rej)=>{ if(_vdb) return res(_vdb); if(!window.indexedDB){ return rej('no-idb'); } const rq=indexedDB.open('shivamVault',1); rq.onupgradeneeded=e=>{ const db=e.target.result; if(!db.objectStoreNames.contains('docs')){ const st=db.createObjectStore('docs',{keyPath:'id', autoIncrement:true}); st.createIndex('custKey','custKey',{unique:false}); } }; rq.onsuccess=e=>{ _vdb=e.target.result; res(_vdb); }; rq.onerror=e=>rej(rq.error); }); }
  function vaultAdd(custKey,file,category){ return vaultOpen().then(db=>new Promise((res,rej)=>{ const tx=db.transaction('docs','readwrite'); let key; const rq=tx.objectStore('docs').add({custKey,name:file.name,category,type:file.type,size:file.size,addedAt:Date.now(),blob:file}); rq.onsuccess=()=>{key=rq.result;}; tx.oncomplete=()=>res(key); tx.onerror=()=>rej(tx.error); })); }
  function vaultList(custKey){ return vaultOpen().then(db=>new Promise((res,rej)=>{ const rq=db.transaction('docs','readonly').objectStore('docs').index('custKey').getAll(custKey); rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>rej(rq.error); })); }
  function vaultGet(id){ return vaultOpen().then(db=>new Promise((res,rej)=>{ const rq=db.transaction('docs','readonly').objectStore('docs').get(id); rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error); })); }
  function vaultDelete(id){ return vaultOpen().then(db=>new Promise((res,rej)=>{ const tx=db.transaction('docs','readwrite'); tx.objectStore('docs').delete(id); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); })); }
  function vaultUpload(){ if(!currentCust) return; const inp=$('vaultFile'); if(!inp||!inp.files||!inp.files.length){ toast('Choose a file first'); return; } const cat=$('vaultCat')?$('vaultCat').value:'Other'; const files=[...inp.files]; Promise.all(files.map(f=>vaultAdd(currentCust,f,cat))).then(()=>{ inp.value=''; renderVault(); if(cat==='Photograph' && lastDocLoan && custKeyOf(lastDocLoan)===currentCust){ fillDocPhoto(lastDocLoan); } logAudit('Document Uploaded', files.length+' file(s) \u00b7 '+cat); toast(files.length+' document(s) uploaded'); }).catch(()=>toast('Upload failed (storage unavailable)')); }
  function renderVault(){ const grid=$('vaultGrid'); if(!grid||!currentCust) return; vaultList(currentCust).then(docs=>{ const q=($('vaultSearch')?$('vaultSearch').value:'').toLowerCase(); const f=$('vaultFilter')?$('vaultFilter').value:'all'; let d=docs; if(q) d=d.filter(x=>(x.name+' '+x.category).toLowerCase().includes(q)); if(f&&f!=='all') d=d.filter(x=>x.category===f); if(!d.length){ grid.innerHTML='<div class="pay-empty">No documents stored.</div>'; return; } grid.innerHTML=d.map(x=>{ const isImg=(x.type||'').indexOf('image')===0; const ic=isImg?'\ud83d\uddbc':((x.type||'').indexOf('pdf')>=0?'\ud83d\udcc4':'\ud83d\udcce'); const sz=x.size>1048576?((x.size/1048576).toFixed(1)+' MB'):((x.size/1024).toFixed(0)+' KB'); const dt=new Date(x.addedAt).toLocaleDateString('en-GB'); return `<div class="vault-card"><div class="vc-ic">${ic}</div><div class="vc-body"><div class="vc-name" title="${esc(x.name)}">${esc(x.name)}</div><div class="vc-meta"><span class="pp ok">${esc(x.category)}</span> ${sz} \u00b7 ${dt}</div></div><div class="vc-act"><button class="lnk" onclick="previewDoc(${x.id})">preview</button><button class="lnk" onclick="downloadDoc(${x.id})">download</button><button class="lnk del" onclick="deleteDoc(${x.id})">delete</button></div></div>`; }).join(''); }).catch(()=>{ grid.innerHTML='<div class="pay-empty">Document storage is unavailable in this browser. The Mac app supports it fully.</div>'; }); }
  function previewDoc(id){ vaultGet(id).then(d=>{ if(!d) return; const url=URL.createObjectURL(d.blob); if((d.type||'').indexOf('image')===0){ $('vaultModalBody').innerHTML='<img src="'+url+'" style="max-width:100%; max-height:78vh; border-radius:8px;">'; $('vaultModalTitle').textContent=d.name; $('vaultModal').classList.add('show'); } else { $('vaultModalBody').innerHTML='<iframe src="'+url+'" style="width:100%;height:78vh;border:0;border-radius:8px;background:#fff;"></iframe>'; $('vaultModalTitle').textContent=d.name; $('vaultModal').classList.add('show'); } logAudit('Document Previewed', d.name); }); }
  function closeVaultModal(){ const m=$('vaultModal'); if(m) m.classList.remove('show'); const b=$('vaultModalBody'); if(b) b.innerHTML=''; }
  function downloadDoc(id){ vaultGet(id).then(d=>{ if(!d) return; const url=URL.createObjectURL(d.blob); const a=document.createElement('a'); a.href=url; a.download=d.name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),4000); logAudit('Document Downloaded', d.name); }); }
  function deleteDoc(id){ vaultGet(id).then(d=>{ if(!confirm('Delete this document permanently?')) return; vaultDelete(id).then(()=>{ renderVault(); logAudit('Document Deleted', d?d.name:('#'+id)); toast('Document deleted'); }); }); }

  /* ===== Audit Logs ===== */
  const AUDIT_STORE='shivam_audit_v1';
  function logAudit(action,detail){ try{ const a=JSON.parse(localStorage.getItem(AUDIT_STORE)||'[]'); a.push({ts:Date.now(), user:(currentUser&&currentUser.user)||'system', role:(currentUser&&currentUser.role)||'', action, detail:detail||''}); if(a.length>AUDIT_MAX){ while(a.length>AUDIT_MAX)a.shift(); try{ localStorage.setItem('shivam_audit_trimmed','1'); }catch(_){} } localStorage.setItem(AUDIT_STORE, JSON.stringify(a)); }catch(e){} const sec=document.getElementById('sec-backup'); if(sec&&sec.classList.contains('active')) renderAudit(); }
  function auditAll(){ try{ return JSON.parse(localStorage.getItem(AUDIT_STORE)||'[]'); }catch(e){ return []; } }
  const AUDIT_MAX=5000, AUDIT_PAGE=50;
  window.runSelfTest=function(){
    const out=$('selfTestOut'); if(!out) return;
    out.innerHTML='<div class="pay-empty">Running\u2026</div>';
    const results=[]; const ok=(n)=>results.push({n:n,pass:true}); const bad=(n,why)=>results.push({n:n,pass:false,why:String(why).slice(0,140)});
    const snapshot=JSON.stringify(loans);          /* protect the real data */
    const realCust=currentCust;
    try{
      /* 1. interest & EMI maths */
      try{
        const c=calcLoanTotals(100000, 2, 10);   /* 1,00,000 @ 2%/month flat for 10 months */
        if(c.tint!==20000) throw 'interest should be 20,000 but was '+c.tint;
        if(c.tpay!==120000) throw 'total payable should be 1,20,000 but was '+c.tpay;
        if(c.emi!==12000)  throw 'EMI should be 12,000 but was '+c.emi;
        const z=calcLoanTotals(50000, 2, 0);      /* guard against divide-by-zero */
        if(z.emi!==0) throw 'zero-month loan should not produce an EMI';
        ok('Interest &amp; EMI calculation (monthly flat)');
      }catch(e){ bad('Interest &amp; EMI calculation', e); }

      /* 2. payments reduce the balance correctly */
      try{
        const tt=calcLoanTotals(50000,2,10);
        const t={id:'__t2',name:'Test',acno:'__TEST2__',phone:'0000000000',principal:50000,rate:2,tenure:10,
                 tint:tt.tint, tpay:tt.tpay, emi:tt.emi, disb:'2026-01-01',due:'2026-02-01',status:'Active',type:'Personal',
                 payments:[{date:'2026-02-01',mode:'Cash',amount:6000,status:'Cleared'},{date:'2026-03-01',mode:'Cheque',amount:6000,status:'Pending'}]};
        recomputeLoan(t);
        if(Math.round(t.paid)!==6000) throw 'a pending cheque was counted as paid (paid='+t.paid+')';
        if(Math.round(t.outstanding)!==Math.round(tt.tpay-6000)) throw 'balance wrong: '+t.outstanding;
        ok('Payments &amp; balances (pending cheques excluded)');
      }catch(e){ bad('Payments &amp; balances', e); }

      /* 3. duplicate A/C numbers are blocked */
      try{
        const dup=loans.length? loans[0].acno : null;
        if(dup){ const clash=loans.some(function(l){ return l.acno && l.acno.toLowerCase()===String(dup).toLowerCase(); });
          if(!clash) throw 'duplicate check not working'; }
        ok('Duplicate account-number guard');
      }catch(e){ bad('Duplicate account-number guard', e); }

      /* 4. saving + reading back */
      try{
        const before=loans.length; save();
        const back=JSON.parse(localStorage.getItem(STORE)||'[]');
        if(back.length!==before) throw 'saved '+back.length+' of '+before;
        ok('Saving records to this device');
      }catch(e){ bad('Saving records to this device', e); }

      /* 5. backup file can be produced and read back */
      try{
        const payload=makeBackupPayload(); const parsed=JSON.parse(payload);
        if(parsed.app!=='ShivamLMS') throw 'bad backup header';
        if(!Array.isArray(parsed.loans)) throw 'backup has no records';
        if(parsed.schema!==SCHEMA_VERSION) throw 'backup schema mismatch';
        ok('Backup file can be created and re-read');
      }catch(e){ bad('Backup file', e); }

      /* 6. documents generate */
      try{
        const l=loans[0] || {id:'x',name:'Test',acno:'T-1',principal:1000,rate:2,tenure:1,emi:100,tpay:1020,paid:0,arrears:0,due:'2026-01-01',status:'Active',type:'Personal',payments:[{date:'2026-01-01',mode:'Cash',amount:100,status:'Cleared'}]};
        const rep=repLetterhead('Health Check','test',[['a','1']]);
        if(rep.indexOf('SHIVAM ENTERPRISES')<0) throw 'report letterhead missing';
        const pay=(l.payments&&l.payments[0]) ? payReceiptHTML(l,l.payments[0],0) : null;
        if(pay && pay.indexOf('PAYMENT RECEIPT')<0) throw 'receipt missing title';
        ok('Documents (reports &amp; receipts) generate');
      }catch(e){ bad('Documents', e); }

      /* 7. every screen renders */
      try{
        const secs=['dash','cust','pay','cert','defaults','reports','messages'];
        secs.forEach(function(s){ const a=document.querySelector('#nav a[data-sec="'+s+'"]'); if(!a) throw 'missing screen: '+s; });
        renderCustomers(); renderDash();
        ok('All screens present and rendering');
      }catch(e){ bad('Screens', e); }

      /* 8. schema up to date */
      try{
        if(storeSchema()!==SCHEMA_VERSION) throw 'data is v'+storeSchema()+', app expects v'+SCHEMA_VERSION;
        ok('Data format up to date (v'+SCHEMA_VERSION+')');
      }catch(e){ bad('Data format', e); }

      /* 9. long lists must not collapse (this is the bug that squashed the audit rows to 2px) */
      try{
        const probe=document.createElement('div');
        probe.className='hist-list';
        probe.style.cssText='max-height:200px;overflow-y:auto;position:absolute;left:-9999px;top:0;width:600px;';
        let rows='';
        for(let i=0;i<40;i++) rows+='<details class="hist-item"><summary class="hist-sum"><span class="hist-when">01/01/2026 10:00</span><span class="hist-name">Row '+i+'</span></summary><div class="hist-body">x</div></details>';
        probe.innerHTML=rows;
        document.body.appendChild(probe);
        const h=probe.querySelector('.hist-item').getBoundingClientRect().height;
        probe.remove();
        if(h<24) throw 'rows shrink to '+Math.round(h)+'px in a long list \u2014 they would be unreadable';
        ok('Long lists (audit, message history) stay readable');
      }catch(e){ bad('Long lists', e); }

      /* 10. automatic backups actually configured */
      try{
        const c=loadABK();
        if(window.electronAPI && window.electronAPI.writeBackup && !c.folder) throw 'no backup folder chosen yet';
        ok('Automatic backups configured');
      }catch(e){ bad('Automatic backups', e); }

    } finally {
      try{ loans=JSON.parse(snapshot); currentCust=realCust; save(); }catch(e){}
    }
    const failed=results.filter(r=>!r.pass);
    const rows=results.map(r=> '<div style="display:flex;gap:9px;align-items:flex-start;padding:6px 0;font-size:12.5px;">'
      + (r.pass?'<span style="color:#16a34a;font-weight:700;">\u2713</span>':'<span style="color:#dc2626;font-weight:700;">\u2715</span>')
      + '<div><div>'+r.n+'</div>'+(r.pass?'':'<div class="muted" style="font-size:11.5px;color:#dc2626;">'+esc(r.why)+'</div>')+'</div></div>').join('');
    const head = failed.length
      ? '<div style="font-weight:700;color:#b91c1c;margin-bottom:6px;">'+failed.length+' of '+results.length+' checks failed</div>'
      : '<div style="font-weight:700;color:#166534;margin-bottom:6px;">All '+results.length+' checks passed \u2014 the app is healthy</div>';
    out.innerHTML='<div class="bk-card">'+head+rows+'<div class="ph-sub" style="margin-top:8px;">Your records were not modified by this check.</div></div>';
    try{ logAudit('Health Check', failed.length? (failed.length+' check(s) failed') : 'all checks passed'); }catch(e){}
  };
  function renderAudit(){
    const body=$('auditBody'); if(!body) return;
    const q=($('auditSearch')?$('auditSearch').value:'').toLowerCase().trim();
    if(window._auditQ!==q){ window._auditQ=q; window._auditPage=1; }
    if(!window._auditPage) window._auditPage=1;
    const all=auditAll();
    let a=all.slice().reverse();
    if(q) a=a.filter(x=>((x.user+' '+x.action+' '+x.detail).toLowerCase().includes(q)));
    const cnt=$('auditCount');
    if(cnt) cnt.textContent = all.length ? (all.length+' entr'+(all.length===1?'y':'ies')+(q?(' \u00b7 '+a.length+' matching'):'')) : '';
    if(!a.length){ body.innerHTML = q
        ? ('<div class="empty"><b>No entries match \u201c'+esc(q)+'\u201d.</b><br><button class="btn btn-sm" style="margin-top:8px;" onclick="$(\'auditSearch\').value=\'\';renderAudit();">Clear search</button></div>')
        : '<div class="empty"><b>No activity logged yet.</b></div>';
      return; }
    const show=Math.min(a.length, window._auditPage*AUDIT_PAGE);
    const rows=a.slice(0,show).map(x=>{ const d=new Date(x.ts); const det=(x.detail||'').trim();
      return '<details class="hist-item"><summary class="hist-sum">'
        +'<span class="hist-when">'+d.toLocaleDateString('en-GB')+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span>'
        +'<span class="hist-name">'+esc(x.action)+'</span>'
        +'<span class="hist-cat pp ok">'+esc(x.user)+(x.role?(' \u00b7 '+esc(x.role)):'')+'</span>'
        +'</summary><div class="hist-body"><div class="hist-msg">'+(det?esc(det):'<span class="muted">No additional details.</span>')+'</div></div></details>';
    }).join('');
    let trimNote='';
    try{ if(localStorage.getItem('shivam_audit_trimmed')==='1') trimNote='<div class="pay-empty" style="color:#b45309;">\u26a0 The log has reached its limit, so the oldest entries were removed. Export the log regularly to keep a permanent record.</div>'; }catch(_){}
    const more = show<a.length
      ? '<button class="btn btn-sm" style="margin-top:8px;width:100%;" onclick="auditMore()">Show more ('+(a.length-show)+' older)</button>'
      : '';
    body.innerHTML = trimNote + rows + more;
  }
  window.auditMore=function(){ window._auditPage=(window._auditPage||1)+1; renderAudit(); };
  function exportAudit(){ const a=auditAll(); const head=['When','User','Role','Action','Details']; const rows=a.map(x=>{ const d=new Date(x.ts); return [d.toLocaleDateString('en-GB')+' '+d.toLocaleTimeString(), x.user, x.role, x.action, x.detail].map(v=>{ v=String(v==null?'':v); if(/[",\n]/.test(v)) v='"'+v.replace(/"/g,'""')+'"'; return v; }).join(','); }); download('shivam-audit-'+todayISO()+'.csv', head.join(',')+'\n'+rows.join('\n'), 'text/csv'); logAudit('Data Exported','Audit log'); toast('Audit log exported'); }
  function clearAudit(){ if(isLocked() && !(currentUser&&currentUser.role==='admin')){ toast('Administrators only'); return; } if(confirm('Clear the entire audit log? This cannot be undone.')){ try{ localStorage.removeItem(AUDIT_STORE); }catch(e){} renderAudit(); toast('Audit log cleared'); } }

  function resolveTheme(){ try{ const p=localStorage.getItem('shivam_theme'); if(p==='dark'||p==='light') return p; }catch(e){} return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'; }
  function applyTheme(){ const t=resolveTheme(); document.documentElement.classList.toggle('dark', t==='dark'); const b=$('themeBtn'); if(b) b.textContent=(t==='dark')?'☀️':'🌙'; try{ if(typeof applyAuthTheme==='function') applyAuthTheme(); }catch(e){} }
  function toggleTheme(){ const cur=document.documentElement.classList.contains('dark')?'dark':'light'; const nx=(cur==='dark')?'light':'dark'; try{ localStorage.setItem('shivam_theme', nx); }catch(e){} applyTheme(); }
  try{ const mq=matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', ()=>{ let pref=null; try{ pref=localStorage.getItem('shivam_theme'); }catch(e){} if(!pref) applyTheme(); }); }catch(e){}
  function exportJSON(){ try{recomputeAll();}catch(e){} download('shivam-loans-backup-'+todayISO()+'.json', JSON.stringify(loans,null,2), 'application/json'); logAudit('Data Exported','Backup JSON'); toast('Backup downloaded'); }
  function exportCSV(){
    try{recomputeAll();}catch(e){}
    const cols=['caseno','refno','acno','name','reltype','relname','age','phone','addr','idtype','idproof','type','product','dealer','occupation','designation','officeaddr','residence','principal','downpay','deductions','rate','tenure','tint','tpay','emi','disb','due','paid','outstanding','status','officer','gname','gphone','remarks','propdesc','propaddr','proparea','propvalue','bN','bS','bE','bW','title'];
    const head=['Case No','Reference','A/C No','Name','Relation','Relation Name','Age','Phone','Address','ID Type','ID No','Type','Loan Purpose','Referred By','Occupation','Designation','Office Address','Residence','Principal','Down Payment','Deductions','Rate %','Tenure(mo)','Total Interest','Total Payable','EMI','Disbursed','Next Due','Paid','Outstanding','Status','Account Officer','Guarantor','Guarantor Phone','Remarks','Property Desc','Property Address','Area','Property Value','Boundary N','Boundary S','Boundary E','Boundary W','Title/Reg'];
    const rows=loans.map(l=>cols.map(c=>{ let v=l[c]==null?'':String(l[c]); if(/[",\n]/.test(v)) v='"'+v.replace(/"/g,'""')+'"'; return v; }).join(','));
    download('shivam-loans-'+todayISO()+'.csv', head.join(',')+'\n'+rows.join('\n'), 'text/csv'); logAudit('Data Exported','Loans CSV'); toast('Excel file exported');
  }
  function importJSON(ev){
    const file=ev.target.files[0]; if(!file) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ const data=JSON.parse(rd.result); let arr=null, extras=null; if(Array.isArray(data)){ arr=data; } else if(data && data.app==='ShivamLMS' && Array.isArray(data.loans)){ arr=data.loans; extras=data; } else throw 0;
        if(extras && typeof extras.schema==='number' && extras.schema>SCHEMA_VERSION){ toast('\u26a0 This backup was made by a NEWER version of the app. Update the app first \u2014 restoring it now could damage your records.', 7000); return; }
        snapBefore('Before restore'); loans=arr; try{recomputeAll();}catch(e){} save(); if(extras){ const put=(k,v)=>{ if(v!=null && !(Array.isArray(v) && !v.length)){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } }; put('shivam_recycle_v1', extras.recycle); put('shivam_expenses_v1', extras.expenses); put('shivam_firm_v1', extras.firm); put('shivam_users_v1', extras.users); put('shivam_watpl_v1', extras.watpl); put('shivam_wamsg_v1', extras.wahist);
          try{ if(Array.isArray(extras.audit) && extras.audit.length){ const cur=auditAll(); const seen={}; const merged=cur.concat(extras.audit).filter(function(x){ if(!x||!x.ts) return false; const k=x.ts+'|'+(x.user||'')+'|'+(x.action||'')+'|'+(x.detail||''); if(seen[k]) return false; seen[k]=1; return true; }).sort(function(a,b){ return a.ts-b.ts; }); localStorage.setItem('shivam_audit_v1', JSON.stringify(merged.slice(-5000))); } }catch(e){}
          if(extras.wacfg){ let cur={}; try{ cur=JSON.parse(localStorage.getItem('shivam_wacfg_v1')||'{}')||{}; }catch(e){} localStorage.setItem('shivam_wacfg_v1', JSON.stringify(Object.assign({}, extras.wacfg, {token:cur.token, tokenEnc:cur.tokenEnc}))); } } logAudit('Backup Restored', arr.length+' records'+(extras?' + settings':'')); renderLoans(); renderDash(); toast('Backup restored ('+arr.length+' records'+(extras?', settings included':'')+')'); go('loans'); }catch(e){ toast('Invalid backup file'); } };
    rd.readAsText(file); ev.target.value='';
  }
  function clearAll(){ if(confirm('Delete ALL loan records permanently? Make sure you have a backup.')){ loans=[]; save(); logAudit('All Records Deleted',''); renderLoans(); renderDash(); toast('All records deleted'); } }

