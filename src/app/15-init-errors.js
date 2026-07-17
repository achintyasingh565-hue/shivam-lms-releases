  /* ---------- init ---------- */
  load();
  bootStore();
  try{ migrateStore(); }catch(e){}
  /* ---------- global error reporting (errors used to vanish silently) ---------- */
  window._errSeen={}; window._errCount=0;
  function reportError(where, msg){
    try{
      const key=(where+'|'+msg).slice(0,180);
      if(window._errSeen[key]) return;          /* never spam the same fault twice */
      window._errSeen[key]=1;
      if(++window._errCount>25) return;          /* hard ceiling per session */
      logAudit('App Error', (where?where+': ':'')+String(msg).slice(0,300));
      if(window._errCount<=2) toast('\u26a0 Something went wrong \u2014 it has been recorded in the Audit Log (Administration).', 6000);
    }catch(_){}
  }
  window.addEventListener('error', function(e){ reportError((e.filename?'':'')+'line '+(e.lineno||'?'), (e.message||'Unknown error')); });
  window.addEventListener('unhandledrejection', function(e){ reportError('async', (e.reason && (e.reason.message||e.reason))||'Unhandled rejection'); });
  recomputeAll();
  loadTpl();
  try{ autoRemBoot(); }catch(e){}
  $('f_date').value=todayISO();
  setDoc('cert'); updateCert(); updateProp(); updateHP(); renderDash();
  $('loanOverlay').addEventListener('click', e=>{ if(e.target.id==='loanOverlay') closeLoan(); });
  setupPWA();
  if(navigator.userAgent.includes('Electron')){ const ib=document.getElementById('installBtn'); if(ib) ib.style.display='none'; }
  function loadABK(){ try{ return JSON.parse(localStorage.getItem('shivam_autobackup_v1')||'{}'); }catch(e){ return {}; } }
  function saveABK(c){ try{ localStorage.setItem('shivam_autobackup_v1', JSON.stringify(c)); }catch(e){} }
  function snapshotInfo(){ try{ return JSON.parse(localStorage.getItem('shivam_backup_snapshot')||'null'); }catch(e){ return null; } }
  let _abkTimer=null;
  function renderSafetyNudge(){ const el=$('safetyNudge'); if(!el) return; if(!currentUser||currentUser.role!=='admin'){ el.style.display='none'; return; }
    const msgs=[]; let rec=null; try{ rec=JSON.parse(localStorage.getItem('shivam_recovery_v1')||'null'); }catch(e){}
    if(!rec||!rec.hash) msgs.push('No password <b>recovery code</b> is set \u2014 generate one in Administration \u2192 Team Members so a forgotten password never locks you out.');
    const c=loadABK(); const badPh=(loans||[]).filter(l=>{ const d=String(l.phone||'').replace(/\D/g,''); return d && !((d.length===10 && /^[6-9]/.test(d)) || (d.length===12 && d.slice(0,2)==='91' && /^[6-9]/.test(d[2]))); }); if(badPh.length) msgs.push(badPh.length+' loan record(s) have an <b>invalid phone number</b> (e.g. '+esc(badPh[0].name||badPh[0].acno||'')+') \u2014 WhatsApp cannot deliver to them. Edit the record(s) to fix.'); const stale=!c.lastAt || (Date.now()-c.lastAt > 3*86400000);
    if(!c.folder) msgs.push('No <b>backup folder</b> chosen \u2014 pick one in the Backup section so your records are saved outside the app.');
    else if(stale) msgs.push('Last backup was '+(c.lastAt?Math.floor((Date.now()-c.lastAt)/86400000)+' day(s) ago':'never')+' \u2014 open the Backup section and run \u201cBack up now\u201d.');
    if(msgs.length){ el.innerHTML='\u26a0\ufe0f '+msgs.join('<br>\u26a0\ufe0f '); el.style.display='block'; } else { el.style.display='none'; } }
  function makeBackupPayload(){
    const grab=k=>{ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };
    const wc=grab('shivam_wacfg_v1')||{}; const wcSafe=Object.assign({},wc); delete wcSafe.token; delete wcSafe.tokenEnc;
    return JSON.stringify({ app:'ShivamLMS', v:2, schema:SCHEMA_VERSION, at:new Date().toISOString(), loans:loans, expenses:loadExpenses(), firm:(function(){ try{ return JSON.parse(localStorage.getItem('shivam_firm_v1')||'null'); }catch(e){ return null; } })(),
      recycle:grab('shivam_recycle_v1'), users:grab('shivam_users_v1'), watpl:grab('shivam_watpl_v1'), wacfg:wcSafe, audit:grab('shivam_audit_v1'), wahist:grab('shivam_wamsg_v1') }, null, 2);
  }
  function scheduleAutoBackup(){ clearTimeout(_abkTimer); _abkTimer=setTimeout(()=>checkAutoBackup(false), 1500); }
  async function checkAutoBackup(force){
    const c=loadABK();
    if(!force && c.enabled===false){ renderBackupStatus(); return; }
    const due = force || !c.lastAt || (Date.now()-c.lastAt >= (c.freqDays||1)*86400000);
    if(due && window.electronAPI && window.electronAPI.writeBackup && c.folder){
      try{ const fn='Shivam_Backup_'+todayISO()+'_'+new Date().toTimeString().slice(0,5).replace(':','')+'.json';
        const ok=await window.electronAPI.writeBackup({folder:c.folder, name:fn, content:makeBackupPayload()});
        if(ok){ c.lastAt=Date.now(); saveABK(c); logAudit('Auto Backup','Saved to backup folder'); } }catch(e){}
    }
    renderBackupStatus();
  }
  async function backupNow(){
    const c=loadABK();
    if(window.electronAPI && window.electronAPI.writeBackup && c.folder){
      try{ const fn='Shivam_Backup_'+todayISO()+'_'+new Date().toTimeString().slice(0,5).replace(':','')+'.json';
        const ok=await window.electronAPI.writeBackup({folder:c.folder, name:fn, content:makeBackupPayload()});
        if(ok){ c.lastAt=Date.now(); saveABK(c); logAudit('Backup','Saved to '+c.folder); toast('Backup saved to your folder'); } else toast('Could not write to the folder'); }catch(e){ toast('Backup failed'); }
    } else { exportJSON(); c.lastAt=Date.now(); saveABK(c); }
    renderBackupStatus();
  }
  async function chooseBackupFolder(){
    if(!(window.electronAPI && window.electronAPI.chooseBackupFolder)){ toast('Folder backup is available in the Mac desktop app'); return; }
    try{ const f=await window.electronAPI.chooseBackupFolder(); if(f){ const c=loadABK(); c.folder=f; saveABK(c); toast('Backup folder set'); checkAutoBackup(true); } }catch(e){}
  }
  function setAutoBackup(en){ const c=loadABK(); c.enabled=en; saveABK(c); renderBackupStatus(); if(en) checkAutoBackup(false); }
  function setAutoFreq(v){ const c=loadABK(); c.freqDays=parseInt(v)||1; saveABK(c); renderBackupStatus(); }
  function restoreSnapshot(){ const sn=snapshotInfo(); if(!sn||!sn.data){ toast('No in-app snapshot yet'); return; } if(!confirm('Restore the last in-app snapshot from '+new Date(sn.at).toLocaleString()+'? This replaces current data.')) return; loans=sn.data; try{recomputeAll();}catch(e){} save(); logAudit('Snapshot Restored',(sn.data.length||0)+' records'); if(typeof renderLoans==='function') renderLoans(); if(typeof renderDash==='function') renderDash(); toast('Restored from in-app snapshot'); }
  function renderBackupStatus(){
    const c=loadABK(); const sn=snapshotInfo();
    const en=$('bkEnabled'); if(en) en.checked=(c.enabled!==false);
    const fq=$('bkFreq'); if(fq) fq.value=String(c.freqDays||1);
    const isDesktop=!!(window.electronAPI && window.electronAPI.writeBackup);
    const fb=$('bkFolderBtn'); if(fb) fb.style.display=isDesktop?'inline-flex':'none';
    const fi=$('bkFolderInfo'); if(fi) fi.textContent = isDesktop ? (c.folder?('Auto-saving dated backups to: '+c.folder):'Choose a folder to enable silent automatic backups on this Mac.') : 'In the desktop app you can pick a folder for silent automatic backups. In the browser, use “Back up now” to download a copy.';
    const last=c.lastAt?new Date(c.lastAt):null;
    const overdue=(c.enabled!==false) && (!c.lastAt || (Date.now()-c.lastAt >= (c.freqDays||1)*86400000));
    const dot=$('bkStatusDot'); if(dot){ dot.textContent = !c.lastAt?'No backup yet':(overdue?'Backup due':'Up to date'); dot.className='wa-stat '+((!c.lastAt||overdue)?'off':'on'); }
    const st=$('bkStatus'); if(st){ st.innerHTML = (last?('Last backup: <b>'+last.toLocaleDateString('en-GB')+' '+last.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</b>'):'You have not made a backup yet.') + (sn?(' &middot; in-app safety snapshot updated '+new Date(sn.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})):''); }
    const banner=$('bkBanner'); if(banner){ if(isDesktop && !c.folder){ banner.style.display='block'; banner.innerHTML='⚠ <b>Automatic backups are not running yet.</b> Choose a backup folder below so a dated copy of your records is saved silently every day.'; } else if(overdue){ banner.style.display='block'; banner.innerHTML='⚠ '+(!c.lastAt?'You have not backed up your records yet.':'It has been a while since your last backup.')+' Use <b>Back up now</b> to keep them safe.'; } else banner.style.display='none'; }
    if(fb){ fb.classList.toggle('btn-primary', isDesktop && !c.folder); fb.classList.toggle('btn-ghost', !(isDesktop && !c.folder)); }
  }
  function autoBackupBoot(){ const c=loadABK(); if(c.enabled===undefined){ c.enabled=true; c.freqDays=1; saveABK(c); } renderBackupStatus(); checkAutoBackup(false);
    try{ if(window.electronAPI && window.electronAPI.writeBackup && !c.folder && !window._bkNudged){ window._bkNudged=true; setTimeout(function(){ toast('\u26a0 Automatic backups are not set up yet \u2014 choose a backup folder in Administration \u2192 Backup & Data.', 6000); }, 3000); } }catch(_){}
  }
  /* Accounts must be decrypted from the keychain BEFORE the lock screen decides whether
     an account exists - otherwise it would offer 'first-time setup' and lock you out. */
  (async function(){
    try{ await initUsersStore(); }catch(e){}
    initLock();
  })();
  applyTheme();
  autoBackupBoot();
  try{ if(window.electronAPI){ var _ib=document.getElementById('installBtn'); if(_ib) _ib.style.display='none'; } }catch(e){}
  /* ---------- global error safety net (covers the whole app) ---------- */
  (function(){
    var _lastErr=0;
    function notify(msg){ var now=Date.now(); if(now-_lastErr<4000) return; _lastErr=now; try{ if(typeof toast==='function') toast(msg, 8000); }catch(_){ } }
    function shortWhere(src,line){ try{ if(!src) return ''; var f=String(src).split('/').pop().split('?')[0]; return f?(' ['+f+(line?(':'+line):'')+']'):''; }catch(_){ return ''; } }
    function clean(m){ m=String(m||'').replace(/^Uncaught\s*/i,'').replace(/^Error:\s*/i,'').trim(); if(m.length>140) m=m.slice(0,140)+'\u2026'; return m||'Unknown error'; }
    window.addEventListener('error', function(e){
      if(e && e.target && e.target!==window && e.target.tagName) return; /* ignore image/script load errors */
      var detail=clean(e && (e.message||(e.error&&e.error.message)))+shortWhere(e&&e.filename, e&&e.lineno);
      notify('\u26a0 Something went wrong: '+detail+'\nYour saved data is safe. If this keeps happening, restart the app and restore your latest backup.');
    });
    window.addEventListener('unhandledrejection', function(e){
      var r=e&&e.reason; var detail=clean(r&&(r.message||r));
      notify('\u26a0 An action could not be completed: '+detail+'\nYour saved data is safe \u2014 please try again, and take a backup if it keeps happening.');
    });
  })();
  window.addEventListener('afterprint',()=>{ if(window._docTitleBak!=null){ document.title=window._docTitleBak; window._docTitleBak=null; } document.body.classList.remove('printing-cert','printing-proposal','printing-hp','printing-hp-all','printing-fullfile','printing-report'); const ff=$('fullFilePrint'); if(ff) ff.innerHTML=''; const rp=$('reportPrint'); if(rp) rp.innerHTML=''; });
