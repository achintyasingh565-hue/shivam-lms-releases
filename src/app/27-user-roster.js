  /* ---------- Central user list (cloud-synced roster) ----------
     Fixes roles being per-device: the owner-admin PUBLISHES the user list, and
     every device ADOPTS it on sync so a person has the same role everywhere.
     Non-destructive by design — it matches accounts by username (case-insensitive)
     and updates role/name, and adds users that are missing; it NEVER deletes a
     local account or overwrites a local password, so nobody can be locked out. */
  async function publishUserRoster(){
    if(!currentUser || currentUser.role!=='admin'){ toast('Only an administrator can publish the user list'); return; }
    if(typeof cloudSetSetting!=='function'){ toast('Cloud sync is not set up on this device'); return; }
    var roster=(typeof loadUsers==='function')?loadUsers():[];
    if(!roster.length){ toast('There are no users to publish'); return; }
    var r=await cloudSetSetting('users', {users:roster, at:Date.now(), by:(currentUser.user||'')});
    if(r && r.ok){ toast('User list published — other devices adopt it on their next sync'); try{ logAudit('User List Published', roster.length+' user(s)'); }catch(_){} }
    else { toast('Could not publish — check cloud sign-in / connection, and that the app_settings table exists.'); }
    try{ renderUserRosterPanel(); }catch(e){}
  }
  function applyUserRoster(cloudUsers){
    if(!Array.isArray(cloudUsers) || !cloudUsers.length) return false;
    if(typeof loadUsers!=='function' || typeof saveUsers!=='function') return false;
    var local=loadUsers().slice(); var changed=false;
    cloudUsers.forEach(function(cu){
      if(!cu || !cu.user) return;
      var m=null;
      for(var i=0;i<local.length;i++){ if((local[i].user||'').toLowerCase()===(cu.user||'').toLowerCase()){ m=local[i]; break; } }
      if(m){ if(cu.role && m.role!==cu.role){ m.role=cu.role; changed=true; } if(cu.name && m.name!==cu.name){ m.name=cu.name; changed=true; } }
      else { local.push({user:cu.user, name:cu.name||cu.user, role:cu.role||'staff', hash:cu.hash||''}); changed=true; }
    });
    if(changed){
      try{ saveUsers(local); }catch(e){}
      // reflect a role change for whoever is signed in right now
      if(currentUser){ for(var j=0;j<local.length;j++){ if((local[j].user||'').toLowerCase()===(currentUser.user||'').toLowerCase()){ currentUser.role=local[j].role; currentUser.name=local[j].name; break; } } }
      try{ if(typeof applyRole==='function') applyRole(); }catch(e){}
      try{ if(typeof renderSecPanel==='function') renderSecPanel(); }catch(e){}
      try{ logAudit('User List Updated','adopted the central user list'); }catch(e){}
    }
    return changed;
  }
  /* Silent auto-publish: keeps the cloud roster current whenever an admin adds a
     user, changes a role, renames, or sets a password — so a brand-new device
     always finds an up-to-date roster to adopt (fixes it defaulting to admin).
     No toast, no audit spam; guarded by admin + an active cloud session. */
  async function autoPublishRoster(){
    try{
      if(!currentUser || currentUser.role!=='admin') return false;
      if(typeof cloudSetSetting!=='function') return false;
      var roster=(typeof loadUsers==='function')?loadUsers():[];
      if(!roster.length) return false;
      var r=await cloudSetSetting('users', {users:roster, at:Date.now(), by:(currentUser.user||'')});
      return !!(r && r.ok);
    }catch(e){ return false; }
  }
  async function pullUserRoster(){
    if(typeof cloudGetSetting!=='function') return false;
    try{ var row=await cloudGetSetting('users'); if(row && row.data && Array.isArray(row.data.users)){ return applyUserRoster(row.data.users); } }catch(e){}
    return false;
  }
  function renderUserRosterPanel(){
    var el=document.getElementById('rosterMsg'); if(!el) return;
    var isAdmin = currentUser ? currentUser.role==='admin' : true;
    el.textContent = isAdmin ? 'You are an administrator — you can publish the master user list.' : 'Roles are managed centrally by the administrator.';
  }
  window.publishUserRoster=publishUserRoster; window.applyUserRoster=applyUserRoster; window.pullUserRoster=pullUserRoster; window.autoPublishRoster=autoPublishRoster; window.renderUserRosterPanel=renderUserRosterPanel;
