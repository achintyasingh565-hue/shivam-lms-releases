  const $ = id => document.getElementById(id);
  const A_='fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const SVG={
    cal:`<svg viewBox="0 0 24 24" ${A_}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    users:`<svg viewBox="0 0 24 24" ${A_}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    check:`<svg viewBox="0 0 24 24" ${A_}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    alert:`<svg viewBox="0 0 24 24" ${A_}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    lock:`<svg viewBox="0 0 24 24" ${A_}><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    bank:`<svg viewBox="0 0 24 24" ${A_}><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 21 7 3 7"/></svg>`,
    trend:`<svg viewBox="0 0 24 24" ${A_}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    clock:`<svg viewBox="0 0 24 24" ${A_}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`,
    fileDoc:`<svg viewBox="0 0 24 24" ${A_}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`,
    edit:`<svg viewBox="0 0 24 24" ${A_}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
    trash:`<svg viewBox="0 0 24 24" ${A_}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
  };

  const STORE = "shivam_loans_v1";
  const STORE_TS = "shivam_loans_ts_v1";   // last-write timestamp, used to reconcile localStorage vs the IndexedDB mirror on boot
  let loans = [];
  let editId = null;
  let modalPayments = [];

  /* ---------- storage (safe) ---------- */
  /* Fail-safe: a corrupt/partial record must never crash rendering or the maths.
     Drops junk entries (no id / not an object), guarantees payments & charges are
     arrays, and coerces clearly-invalid numeric fields to 0. Non-destructive for
     valid data. */
  function normalizeLoans(arr){
    if(!Array.isArray(arr)) return [];
    var out=[], dropped=0;
    for(var i=0;i<arr.length;i++){
      var l=arr[i];
      if(!l || typeof l!=='object' || l.id==null){ dropped++; continue; }
      if(!Array.isArray(l.payments)) l.payments=[];
      if(!Array.isArray(l.charges)) l.charges=[];
      if(l.ids!=null && !Array.isArray(l.ids)) l.ids=[];   // identity-document list must be an array
      ['principal','rate','tenure','tint','tpay','emi','outstanding','arrears','deductions'].forEach(function(k){ if(l[k]!=null && l[k]!=='' && isNaN(Number(l[k]))) l[k]=0; });
      out.push(l);
    }
    if(dropped){ try{ logAudit('Data Repaired', dropped+' unreadable record(s) skipped on load'); }catch(e){} }
    return out;
  }
  function load(){ try{ const r=localStorage.getItem(STORE); loans = r?JSON.parse(r):[]; }catch(e){ loans = window._mem||[]; } loans = normalizeLoans(loans); }
  function save(){ var lsOK=true; var _ts=Date.now();
    try{ (loans||[]).forEach(function(l){ if(l && l.v===undefined) l.v=SCHEMA_VERSION; }); }catch(e){}
    try{ localStorage.setItem(STORE, JSON.stringify(loans)); }
    catch(e){
      /* localStorage full: the in-localStorage snapshot duplicates the whole book
         (also mirrored in IndexedDB), so free it and retry once before giving up. */
      try{ localStorage.removeItem('shivam_backup_snapshot'); localStorage.setItem(STORE, JSON.stringify(loans)); }
      catch(e2){ lsOK=false; window._mem = loans; if(!window._storageWarned){ window._storageWarned=true; toast('\u26a0 Device fast-storage is full. Your records are still saved in the app database \u2014 please take a backup now (Administration \u2192 Backup), then contact support to expand storage.'); } }
    }
    try{ localStorage.setItem(STORE_TS, String(_ts)); }catch(_){ }
    if(lsOK){ try{ localStorage.setItem('shivam_backup_snapshot', JSON.stringify({at:_ts, data:loans})); }catch(_){ } }
    try{ if(typeof idbSetLoans==='function') idbSetLoans(loans, _ts); }catch(_){ }
    /* Shared cloud copy (Supabase) — pushes changed loans to the other device.
       No-op when cloud is off or offline; see 20-cloud-sync.js. */
    try{ if(typeof cloudPush==='function') cloudPush(loans); }catch(_){ }
    if(typeof scheduleAutoBackup==='function') scheduleAutoBackup();
    // Safety net: reflect this change on whatever screen is currently open, so the
    // user never has to reopen the app to see it. Guarded (skips open dialogs and
    // in-progress typing) so it can't disturb an edit in progress.
    try{ if(typeof window.refreshActiveView==='function') window.refreshActiveView(); }catch(_){ } }
  /* ---------- durable storage (IndexedDB) ---------- */
  var _seidb=null;
  function idbOpen(){ return new Promise(function(res,rej){ if(_seidb) return res(_seidb); try{ var rq=indexedDB.open('shivam_lms_db',1); rq.onupgradeneeded=function(){ try{ rq.result.createObjectStore('kv'); }catch(e){} }; rq.onsuccess=function(){ _seidb=rq.result; res(_seidb); }; rq.onerror=function(){ rej(rq.error); }; }catch(e){ rej(e); } }); }
  function idbSetLoans(arr, ts){ return idbOpen().then(function(db){ return new Promise(function(res,rej){ try{ var tx=db.transaction('kv','readwrite'); var os=tx.objectStore('kv'); os.put(JSON.stringify(arr),'loans'); os.put(String(ts||Date.now()),'loans_ts'); tx.oncomplete=function(){res(true);}; tx.onerror=function(){rej(tx.error);}; }catch(e){ rej(e); } }); }); }
  function idbGetLoans(){ return idbOpen().then(function(db){ return new Promise(function(res){ try{ var tx=db.transaction('kv','readonly'); var rq=tx.objectStore('kv').get('loans'); rq.onsuccess=function(){ try{ res(rq.result?JSON.parse(rq.result):null); }catch(e){ res(null); } }; rq.onerror=function(){ res(null); }; }catch(e){ res(null); } }); }); }
  function idbGetMetaTs(){ return idbOpen().then(function(db){ return new Promise(function(res){ try{ var tx=db.transaction('kv','readonly'); var rq=tx.objectStore('kv').get('loans_ts'); rq.onsuccess=function(){ res(Number(rq.result)||0); }; rq.onerror=function(){ res(0); }; }catch(e){ res(0); } }); }); }
  /* ---------- schema version & migrations ---------- */
  const SCHEMA_VERSION=1;
  function storeSchema(){ try{ return parseInt(localStorage.getItem('shivam_schema_v')||'0',10)||0; }catch(e){ return 0; } }
  function setStoreSchema(v){ try{ localStorage.setItem('shivam_schema_v', String(v)); }catch(e){} }
  function migrateStore(){
    let from=storeSchema();
    if(from===SCHEMA_VERSION) return;
    let changed=false;
    /* v0 -> v1: stamp every record with its schema version (baseline for all future migrations) */
    if(from<1){
      try{ (loans||[]).forEach(function(l){ if(l && l.v===undefined){ l.v=1; changed=true; } }); }catch(e){}
    }
    /* future migrations append here as:  if(from<2){ ...transform loans...; changed=true; } */
    setStoreSchema(SCHEMA_VERSION);
    if(changed){ try{ save(); }catch(e){} }
    try{ logAudit('Data Migrated','schema v'+from+' \u2192 v'+SCHEMA_VERSION); }catch(e){}
  }
  function bootStore(){ try{ Promise.all([idbGetLoans(), idbGetMetaTs()]).then(function(vals){
        var idbLoans=vals[0], idbTs=vals[1]||0;
        var lsTs=0; try{ lsTs=Number(localStorage.getItem(STORE_TS)||'0')||0; }catch(e){}
        var lsEmpty=!loans || !loans.length;
        // Restore from the durable IndexedDB mirror ONLY when localStorage looks lost:
        //   * localStorage empty  -> restore if the mirror is at least as new (wipe recovery)
        //   * localStorage present -> restore only if the mirror is strictly NEWER
        // Equal timestamps mean localStorage is the current copy (including a deliberate
        // delete), so its rows are NOT resurrected. (Old fix compared array LENGTHS,
        // which wrongly brought deleted records back.)
        if(idbLoans && idbLoans.length && (lsEmpty ? (idbTs>=lsTs) : (idbTs>lsTs))){
          loans=idbLoans;
          try{ localStorage.setItem(STORE, JSON.stringify(loans)); localStorage.setItem(STORE_TS, String(idbTs||Date.now())); }catch(e){}
          if(typeof currentUser!=='undefined' && currentUser && typeof renderLoans==='function'){ try{ renderLoans(); if(typeof renderDash==='function') renderDash(); }catch(e){} }
        } else if(loans && loans.length){ idbSetLoans(loans, lsTs||Date.now()); }
      }).catch(function(){}); }catch(e){} }

