  /* ---------- PWA / install ---------- */
  const ICON512="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", ICON192="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";
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

  function resetCert(){ ['f_name','f_relname','f_addr','f_ref','f_amount'].forEach(id=>{ if($(id)) $(id).value=""; }); $('f_loan').value="personal loan"; $('f_mode').value="Cash"; $('f_reltype').value="son of"; if($('f_secured'))$('f_secured').value="no"; $('f_date').value=todayISO(); $('loadLoan').value=""; updateCert(); }

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
      if(!map[k]) map[k]={key:k, name:l.name||'', phone:l.phone||'', addr:l.addr||'', reltype:l.reltype||'', relname:l.relname||'', coname:l.coname||'', idtype:l.idtype||'', idproof:l.idproof||'', pan:l.pan||'', ids:(Array.isArray(l.ids)&&l.ids.length?l.ids:null), age:l.age||'', occupation:l.occupation||'', loans:[]};
      const c=map[k];
      if(!c.phone&&l.phone)c.phone=l.phone; if(!c.addr&&l.addr)c.addr=l.addr;
      if(!c.coname&&l.coname) c.coname=l.coname;
      if(!c.idproof&&l.idproof){ c.idproof=l.idproof; c.idtype=l.idtype||c.idtype; }
      if(!c.pan&&l.pan) c.pan=l.pan;
      if((!c.ids||!c.ids.length)&&Array.isArray(l.ids)&&l.ids.length) c.ids=l.ids;
      if(!c.relname&&l.relname){ c.relname=l.relname; c.reltype=l.reltype||c.reltype; }
      if(!c.occupation&&l.occupation)c.occupation=l.occupation; if(!c.dob&&l.dob)c.dob=l.dob;
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
    const cards=cs.slice(0,show).map((c,_i)=>{ const out=c.loans.reduce((a,l)=>a+(Number(l.outstanding)||0),0); const allClosed=c.loans.every(l=>autoStatus(l)==='Closed'); const anyOver=c.loans.some(l=>autoStatus(l)==='Overdue'); const st=allClosed?'Closed':(anyOver?'Overdue':'Active');
      return `<div class="cl-card${currentCust===c.key?' sel':''}" onclick="openCustomer('${encodeURIComponent(c.key)}')">
        <div class="r1"><div><div class="nm"><span class="cl-no">${_i+1}</span>${esc(c.name)}</div><div class="ph">${esc(c.phone||'\u2014')}</div></div><span class="badge ${st.toLowerCase()}">${st}</span></div>
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
    /* Loans a borrower has taken recently were getting lost among older ones,
       so each table is split under two headings using the app's existing
       definition of NEW (isNewLoan). A heading only appears when both groups
       have rows, so a borrower with one loan still sees a plain list. */
    const lgroup=(ls,label)=>ls.length?('<tr class="lgrp"><td colspan="7">'+label+' \u00b7 '+ls.length+'</td></tr>'+lrows(ls)):'';
    const lsplit=ls=>{
      if(!ls.length) return lrows(ls);
      const isNew=(typeof isNewLoan==='function')?isNewLoan:function(){return false;};
      const n=ls.filter(isNew), o=ls.filter(l=>!isNew(l));
      if(!n.length || !o.length) return lrows(ls);          // nothing to separate
      return lgroup(n,'New Loans')+lgroup(o,'Earlier Loans');
    };
    const lrows=ls=>ls.length?ls.map(l=>`<tr><td>${esc(l.acno)}${(typeof newBadge==='function')?newBadge(l):''}</td><td>${esc(l.type)}</td><td class="right num">${inr(l.principal)}</td><td class="right num">${inr(l.outstanding)}</td><td>${fmtDate(l.due)||'\u2014'}</td><td><span class="badge ${autoStatus(l).toLowerCase()}">${autoStatus(l)}</span></td><td><div class="rowact"><button class="iconbtn" title="Welcome Letter" onclick="openWelcomeLetter('${l.id}')">${SVG.mail}</button><button class="iconbtn" title="Loan File (booklet)" onclick="openLoanFile('${l.id}')">${SVG.book}</button><button class="iconbtn cert" title="Generate Certificate" onclick="certFromLoan('${l.id}')">${SVG.fileDoc}</button><button class="iconbtn" title="Repayment Schedule" onclick="openSchedule('${l.id}')">${SVG.cal}</button><button class="iconbtn" title="Restructure / Record payment" onclick="openRestructure('${l.id}')" style="font-weight:800;font-size:15px;">₹</button><button class="iconbtn" title="Edit" onclick="openLoan('${l.id}')">${SVG.edit}</button><button class="iconbtn del" title="Delete" onclick="delLoan('${l.id}')">${SVG.trash}</button></div></td></tr>`).join(''):'<tr><td colspan="7" class="muted" style="padding:10px;">None</td></tr>';
    const html=`
      <div class="panel">
        <div class="cust-head"><div class="cust-av">${esc((c.name||'?').slice(0,1).toUpperCase())}</div><div><h3 style="margin:0;">${esc(c.name)}</h3><div class="muted">${c.relname?esc((c.reltype||'')+' '+c.relname)+' \u00b7 ':''}${c.coname?('Co-applicant: '+esc(c.coname)+' \u00b7 '):''}${esc(c.phone||'No phone on file')}</div></div></div>
        ${(function(){ var f=[];
          if(c.addr) f.push('<div><label>Address</label><div>'+esc(c.addr)+'</div></div>');
          // Show every ID the customer has, each labelled with its ACTUAL type
          // (Aadhaar, PAN, Voter…) instead of a generic "ID".
          var _idrows = (Array.isArray(c.ids)&&c.ids.length) ? c.ids.slice()
                      : [].concat(c.idproof?[{t:(c.idtype||'ID Proof'),n:c.idproof}]:[], c.pan?[{t:'PAN',n:c.pan}]:[]);
          _idrows.forEach(function(id){ if(id&&id.n) f.push('<div><label>'+esc(id.t||'ID')+'</label><div>'+esc(id.n)+'</div></div>'); });
          if(c.occupation) f.push('<div><label>Occupation</label><div>'+esc(c.occupation)+'</div></div>');
          if(c.dob) f.push('<div><label>Date of Birth</label><div>'+esc(fmtDate(c.dob)||c.dob)+'</div></div>');
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
      <div class="panel"><h3>Active Loans</h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>A/C</th><th>Type</th><th class="right">Principal</th><th class="right">Outstanding</th><th>Next Due</th><th>Status</th><th></th></tr></thead><tbody>${lsplit(active)}</tbody></table></div></div>
      <div class="panel"><h3>Closed Loans</h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>A/C</th><th>Type</th><th class="right">Principal</th><th class="right">Outstanding</th><th>Next Due</th><th>Status</th><th></th></tr></thead><tbody>${lsplit(closed)}</tbody></table></div></div>
      <div class="panel"><h3>Payment History</h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>Date</th><th>A/C</th><th>Mode</th><th>Cheque / Bank</th><th class="right">Amount</th><th>Status</th></tr></thead><tbody>${pays.length?pays.map(p=>`<tr><td>${fmtDate(p.date)||'\u2014'}</td><td>${esc(p.acno)}</td><td>${esc(p.mode)}</td><td>${p.mode==='Cheque'?(esc(p.cheque||'\u2014')+(p.bank?(' / '+esc(p.bank)):'')):(p.mode==='Online'?('Ref '+esc(p.ref||'\u2014')):'\u2014')}</td><td class="right num">${inr(p.amount)}</td><td>${p.status==='Cleared'?'<span class="pp ok">Cleared</span>':'<span class="pp pend">Pending</span>'}</td></tr>`).join(''):'<tr><td colspan="6" class="muted" style="padding:10px;">No payments recorded</td></tr>'}</tbody></table></div></div>
      ${chgs.length?`<div class="panel"><h3>Charges <span style="font-weight:400;font-size:12px;color:var(--muted);">— late fees, overdue interest &amp; cheque bounces (added to the outstanding balance)</span></h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>Date</th><th>A/C</th><th>Type</th><th>Note</th><th class="right">Amount</th></tr></thead><tbody>${chgs.map(x=>`<tr><td>${fmtDate(x.date)||'\u2014'}</td><td>${esc(x.acno)}</td><td>${esc(x.type||'\u2014')}${x.cheque?(' <span class="muted">(chq '+esc(x.cheque)+')</span>'):''}</td><td class="muted">${esc(x.note||'\u2014')}</td><td class="right num">${inr(x.amount)}</td></tr>`).join('')}<tr class="tot"><td colspan="4" style="font-weight:700;">Total charges recorded</td><td class="right num" style="font-weight:700;">${inr(chgs.reduce((a,x)=>a+(Number(x.amount)||0),0))}</td></tr></tbody></table></div></div>`:''}
      <div class="panel"><h3>Guarantor(s)</h3><div style="font-size:13.5px;">${guars.length?guars.map(g=>esc(g)).join('<br>'):'<span class="muted">None recorded</span>'}</div></div>
      <div class="panel"><h3>Document Vault</h3>
        
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
  /* ===== Whole-vault backup =====
     KYC scans / photographs live ONLY in this device's IndexedDB. The JSON backup
     and the cloud sync do NOT include them, so provide a dedicated document backup
     that packs every uploaded file (base64) into one restorable file. */
  function vaultGetAll(){ return vaultOpen().then(db=>new Promise((res)=>{ try{ const rq=db.transaction('docs','readonly').objectStore('docs').getAll(); rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>res([]); }catch(e){ res([]); } })); }
  function _blobToDataURL(blob){ return new Promise((res)=>{ try{ const fr=new FileReader(); fr.onload=()=>res(String(fr.result||'')); fr.onerror=()=>res(''); fr.readAsDataURL(blob); }catch(e){ res(''); } }); }
  function _dataURLToBlob(durl){ try{ const parts=String(durl).split(','); const mime=(parts[0].match(/:(.*?);/)||[])[1]||'application/octet-stream'; const bin=atob(parts[1]||''); const n=bin.length; const u8=new Uint8Array(n); for(var i=0;i<n;i++) u8[i]=bin.charCodeAt(i); return new Blob([u8],{type:mime}); }catch(e){ return null; } }
  // Core (exposed so it can be exercised by tests) — build the restorable payload.
  window._vaultBackupData=async function(){
    const docs=await vaultGetAll(); const items=[];
    for(const d of docs){ if(!d||!d.blob) continue; const durl=await _blobToDataURL(d.blob); if(!durl) continue; items.push({custKey:d.custKey,name:d.name,category:d.category,type:d.type,size:d.size,addedAt:d.addedAt,data:durl}); }
    return { app:'ShivamVault', v:1, at:new Date().toISOString(), count:items.length, docs:items };
  };
  // Core — restore payload additively (never deletes; skips duplicates). Returns count added.
  window._vaultRestoreData=async function(data){
    if(!data || data.app!=='ShivamVault' || !Array.isArray(data.docs)) throw new Error('bad-vault-file');
    const existing=await vaultGetAll(); const seen={}; existing.forEach(function(d){ seen[(d.custKey||'')+'|'+(d.name||'')+'|'+(d.addedAt||'')]=1; });
    let added=0;
    for(const it of data.docs){ const key=(it.custKey||'')+'|'+(it.name||'')+'|'+(it.addedAt||''); if(seen[key]) continue; const blob=_dataURLToBlob(it.data); if(!blob) continue;
      await vaultOpen().then(db=>new Promise((res)=>{ try{ const tx=db.transaction('docs','readwrite'); tx.objectStore('docs').add({custKey:it.custKey,name:it.name,category:it.category,type:it.type||blob.type,size:it.size||blob.size,addedAt:it.addedAt||Date.now(),blob:blob}); tx.oncomplete=()=>res(); tx.onerror=()=>res(); }catch(e){ res(); } })); added++; }
    return added;
  };
  window.exportVault=async function(){
    try{
      toast('Preparing document backup — this can take a moment…');
      const out=await window._vaultBackupData();
      if(!out.count){ toast('No documents in the vault to back up yet'); return; }
      download('shivam-documents-backup-'+todayISO()+'.json', JSON.stringify(out), 'application/json');
      logAudit('Documents Exported', out.count+' document(s)'); toast(out.count+' document(s) backed up');
    }catch(e){ toast('Could not back up documents'); }
  };
  window.importVault=function(ev){
    const file=ev.target.files[0]; if(!file) return; const rd=new FileReader();
    rd.onload=async ()=>{ try{
      const data=JSON.parse(rd.result); const total=(data&&Array.isArray(data.docs))?data.docs.length:0;
      const added=await window._vaultRestoreData(data);
      logAudit('Documents Restored', added+' document(s)'); toast(added+' document(s) restored'+((added<total)?(' — '+(total-added)+' were already present'):''));
      try{ renderVault(); }catch(e){}
    }catch(e){ toast('Invalid documents backup file'); } };
    rd.readAsText(file); ev.target.value='';
  };

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
    out.innerHTML='<div class="bk-card">'+head+rows+'</div>';
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
    const cols=['caseno','refno','acno','name','reltype','relname','dob','phone','addr','idtype','idproof','pan','type','product','dealer','occupation','designation','officeaddr','residence','principal','downpay','deductions','rate','tenure','tint','tpay','emi','disb','due','paid','outstanding','status','officer','gname','gphone','remarks','propdesc','propaddr','proparea','propvalue','bN','bS','bE','bW','title'];
    const head=['Case No','Reference','A/C No','Name','Relation','Relation Name','Age','Phone','Address','ID Type','ID No','PAN','Type','Loan Purpose','Referred By','Occupation','Designation','Office Address','Residence','Principal','Adjustment','Deductions','Rate %','Tenure(mo)','Total Interest','Total Payable','EMI','Disbursed','Next Due','Paid','Outstanding','Status','Account Officer','Guarantor','Guarantor Phone','Remarks','Property Desc','Property Address','Area','Property Value','Boundary N','Boundary S','Boundary E','Boundary W','Title/Reg'];
    const rows=loans.map(l=>cols.map(c=>{ let v=l[c]==null?'':String(l[c]); if(/[",\n]/.test(v)) v='"'+v.replace(/"/g,'""')+'"'; return v; }).join(','));
    download('shivam-loans-'+todayISO()+'.csv', head.join(',')+'\n'+rows.join('\n'), 'text/csv'); logAudit('Data Exported','Loans CSV'); toast('Excel file exported');
  }
  /* Deterministic checksum of the loan book, stored in each backup so a corrupted
     or hand-edited file is caught on restore instead of silently loading bad data. */
  function _backupChecksum(arr){ try{ var s=JSON.stringify(arr||[]); var h=5381; for(var i=0;i<s.length;i++){ h=((h<<5)+h+s.charCodeAt(i))>>>0; } return h; }catch(e){ return 0; } }
  function importJSON(ev){
    const file=ev.target.files[0]; if(!file) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ const data=JSON.parse(rd.result); let arr=null, extras=null; if(Array.isArray(data)){ arr=data; } else if(data && data.app==='ShivamLMS' && Array.isArray(data.loans)){ arr=data.loans; extras=data; } else throw 0;
        if(extras && typeof extras.schema==='number' && extras.schema>SCHEMA_VERSION){ toast('\u26a0 This backup was made by a NEWER version of the app. Update the app first \u2014 restoring it now could damage your records.', 7000); return; }
        /* integrity check \u2014 count + checksum must match what the backup recorded */
        if(extras && (extras.sum!=null || extras.count!=null)){
          var okCount=(extras.count==null)||(extras.count===arr.length);
          var okSum=(extras.sum==null)||(extras.sum===_backupChecksum(arr));
          if(!okCount || !okSum){ if(!confirm('\u26a0 This backup failed its integrity check \u2014 it may be corrupted or was edited by hand.\n\nExpected '+(extras.count!=null?extras.count:'?')+' record(s); the file contains '+arr.length+'.\n\nRestore anyway?')){ toast('Restore cancelled'); return; } }
        }
        if(typeof normalizeLoans==='function') arr=normalizeLoans(arr);   // repair any bad rows before applying
        snapBefore('Before restore'); loans=arr; try{recomputeAll();}catch(e){} save(); if(extras){ const put=(k,v)=>{ if(v!=null && !(Array.isArray(v) && !v.length)){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } }; put('shivam_recycle_v1', extras.recycle); put('shivam_expenses_v1', extras.expenses); put('shivam_firm_v1', extras.firm); put('shivam_users_v1', extras.users); put('shivam_watpl_v1', extras.watpl); put('shivam_msg_v1', extras.msgtpl); put('shivam_wamsg_v1', extras.wahist);
          try{ if(Array.isArray(extras.audit) && extras.audit.length){ const cur=auditAll(); const seen={}; const merged=cur.concat(extras.audit).filter(function(x){ if(!x||!x.ts) return false; const k=x.ts+'|'+(x.user||'')+'|'+(x.action||'')+'|'+(x.detail||''); if(seen[k]) return false; seen[k]=1; return true; }).sort(function(a,b){ return a.ts-b.ts; }); localStorage.setItem('shivam_audit_v1', JSON.stringify(merged.slice(-5000))); } }catch(e){}
          if(extras.wacfg){ let cur={}; try{ cur=JSON.parse(localStorage.getItem('shivam_wacfg_v1')||'{}')||{}; }catch(e){} localStorage.setItem('shivam_wacfg_v1', JSON.stringify(Object.assign({}, extras.wacfg, {token:cur.token, tokenEnc:cur.tokenEnc}))); } } logAudit('Backup Restored', arr.length+' records'+(extras?' + settings':'')); renderLoans(); renderDash(); toast('Backup restored ('+arr.length+' records'+(extras?', settings included':'')+')'); go('loans'); }catch(e){ toast('Invalid backup file'); } };
    rd.readAsText(file); ev.target.value='';
  }
  function clearAll(){ if(confirm('Delete ALL loan records permanently? Make sure you have a backup.')){
      /* Capture before wiping so we can propagate each deletion to the cloud.
         Without this, "Delete ALL" cleared only this device and cloud sync
         re-hydrated every record on the next pull (they were never marked
         deleted in Supabase). Mirror delLoan's per-record cloudDelete. */
      var _all=(loans||[]).slice();
      loans=[]; save();
      try{ if(typeof cloudDelete==='function'){ _all.forEach(function(l){ if(l && l.id!=null) cloudDelete(l.id, l); }); } }catch(_){ }
      try{ if(typeof autoQueueClearAll==='function') autoQueueClearAll(); }catch(_){ }
      logAudit('All Records Deleted', _all.length+' record(s)'); renderLoans(); renderDash(); toast('All records deleted'); } }

