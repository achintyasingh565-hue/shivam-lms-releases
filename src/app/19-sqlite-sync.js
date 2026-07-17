  /* ===== ACID storage sync (SQLite in the main process) =====
     The DB is the AUTHORITATIVE store when available:
       - on startup, if the DB has data, it replaces what localStorage loaded (the DB
         survives cache clearing and half-written localStorage; the reverse is not true);
       - if the DB is empty but localStorage has loans (first run after this upgrade,
         or a fresh machine restored from backup), the data is migrated INTO the DB;
       - every save() also writes the full book to the DB in ONE transaction
         (see dbPersist below), so an interrupted save can never corrupt records.
     If the native module is unavailable, everything silently keeps working on
     localStorage + IndexedDB exactly as before. */
  var _dbOn=false, _dbWarned=false;
  function dbPersist(list){
    if(!_dbOn || !window.electronAPI || !window.electronAPI.dbSaveLoans) return;
    try{
      window.electronAPI.dbSaveLoans(JSON.parse(JSON.stringify(list||[]))).then(function(r){
        if((!r || !r.ok) && !_dbWarned){ _dbWarned=true; toast('⚠ Database write failed — your data is still saved locally. Please take a backup (Administration → Backup).'); }
      }).catch(function(){});
    }catch(_){ }
  }
  (function(){
    var api=window.electronAPI;
    if(!api || !api.dbAvailable) return;                    // browser / old desktop build
    api.dbAvailable().then(function(av){
      if(!av) return;                                       // native module missing — fallback mode
      _dbOn=true;
      return api.dbLoadLoans().then(function(r){
        if(r && r.ok && Array.isArray(r.loans) && r.loans.length){
          loans=r.loans;                                    // DB is authoritative
          try{ recomputeAll(); }catch(_){ }
          try{ localStorage.setItem(STORE, JSON.stringify(loans)); }catch(_){ }
          try{ if(typeof renderLoans==='function') renderLoans(); }catch(_){ }
          try{ if(typeof renderDash==='function') renderDash(); }catch(_){ }
          try{ if(typeof renderBackupStatus==='function') renderBackupStatus(); }catch(_){ }
        } else if(Array.isArray(loans) && loans.length){
          dbPersist(loans);                                 // first-run migration into the DB
        }
      });
    }).catch(function(){});
  })();
