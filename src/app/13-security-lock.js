  /* ---------- App Lock & Security ---------- */
  const LOCK_STORE="shivam_lock_v1";
  const USERS_STORE="shivam_users_v1";
  let currentUser=null;
  let authMode='login';
  /* ---- Staff permissions ----
     Roles decide what a signed-in person may DO:
       staff   : view everything + record payments
       manager : + add / edit loans and restructure
       admin   : + delete loans, users, settings, backup (everything)
     Deletion is the most destructive action, so it is admin-only by default.
     (To let managers delete too, add delete:1 to the manager row below.)
     When the app has no lock set up (single user), everything is allowed. */
  const ROLE_PERMS={
    admin:   { view:1, payment:1, edit:1, delete:1, admin:1 },
    manager: { view:1, payment:1, edit:1 },
    staff:   { view:1, payment:1 }
  };
  function can(perm){
    if(!currentUser) return true;                 // app not locked -> full local access
    var r=ROLE_PERMS[currentUser.role]||ROLE_PERMS.admin;
    return !!r[perm];
  }
  window.can=can;
  function lockCfg(){ try{ const r=localStorage.getItem(LOCK_STORE); return r?JSON.parse(r):null; }catch(e){ return null; } }
  function saveLockCfg(c){ try{ localStorage.setItem(LOCK_STORE, JSON.stringify(c)); }catch(e){} }
  /* ---- User accounts (with their password hashes) ----
     Kept encrypted with the Mac keychain (safeStorage) so that someone copying the
     app's data files off the machine cannot brute-force the hashes offline.
     A decrypted copy is held in memory for the session only.
     If the keychain is unavailable (e.g. running in a browser) we fall back to the
     old plaintext store, so the app can never lock you out of your own records. */
  let _usersCache = null;
  function loadUsers(){
    if(_usersCache) return _usersCache;
    try{ const v=JSON.parse(localStorage.getItem(USERS_STORE)||'null'); if(Array.isArray(v)){ _usersCache=v; return v; } }catch(e){}
    return [];
  }
  function saveUsers(u){
    _usersCache = Array.isArray(u) ? u : [];
    const api = window.electronAPI;
    if(api && api.secureEncrypt){
      (async function(){
        try{
          const enc = await api.secureEncrypt(JSON.stringify(_usersCache));
          if(enc){
            localStorage.setItem('shivam_users_enc', enc);
            localStorage.removeItem(USERS_STORE);      /* plaintext copy removed */
            return;
          }
        }catch(e){}
        try{ localStorage.setItem(USERS_STORE, JSON.stringify(_usersCache)); }catch(e){}
      })();
    } else {
      try{ localStorage.setItem(USERS_STORE, JSON.stringify(_usersCache)); }catch(e){}
    }
  }
  /* Runs before the lock screen decides anything. Decrypts the accounts, and migrates
     any old plaintext copy into the keychain. */
  async function initUsersStore(){
    const api = window.electronAPI;
    if(!(api && api.secureDecrypt)) return;                 /* browser: leave as-is */
    try{
      const enc = localStorage.getItem('shivam_users_enc');
      if(enc){
        const txt = await api.secureDecrypt(enc);
        if(txt){
          const arr = JSON.parse(txt);
          if(Array.isArray(arr)){ _usersCache = arr; localStorage.removeItem(USERS_STORE); return; }
        }
        /* decryption failed - fall back to any plaintext copy rather than lock the user out */
        try{ logAudit('Account Store','could not be decrypted; using local copy'); }catch(e){}
        return;
      }
      /* first run after this update: migrate plaintext accounts into the keychain */
      const plain = localStorage.getItem(USERS_STORE);
      if(plain){
        const arr = JSON.parse(plain);
        if(Array.isArray(arr) && arr.length){
          _usersCache = arr;
          const e2 = await api.secureEncrypt(JSON.stringify(arr));
          if(e2){
            localStorage.setItem('shivam_users_enc', e2);
            localStorage.removeItem(USERS_STORE);
            try{ logAudit('Accounts Secured','password hashes moved into the Mac keychain'); }catch(e){}
          }
        }
      }
    }catch(e){}
  }
  async function hashPass(p){
    try{ const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode('shivam::'+p));
      return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
    catch(e){ let h=5381; const s='shivam::'+p; for(let i=0;i<s.length;i++){ h=((h<<5)+h)+s.charCodeAt(i); h|=0; } return 'f'+(h>>>0).toString(16); }
  }
  const PBKDF2_ITERS=210000;
  function _hexBuf(a){ return [...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  async function makeHash(p){
    try{
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const key=await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);
      const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:salt,iterations:PBKDF2_ITERS}, key, 256);
      return 'pbkdf2$'+PBKDF2_ITERS+'$'+_hexBuf(salt)+'$'+_hexBuf(bits);
    }catch(e){ return await hashPass(p); }
  }
  async function checkPass(p, stored){
    if(!stored) return false;
    if(String(stored).indexOf('pbkdf2$')===0){
      try{
        const parts=String(stored).split('$'); const iters=parseInt(parts[1],10)||PBKDF2_ITERS;
        const salt=new Uint8Array((parts[2].match(/../g)||[]).map(x=>parseInt(x,16)));
        const key=await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);
        const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:salt,iterations:iters}, key, 256);
        return _hexBuf(bits)===parts[3];
      }catch(e){ return false; }
    }
    return (await hashPass(p))===stored;
  }
  function lockFails(){ try{ return JSON.parse(localStorage.getItem('shivam_lockfails_v1')||'{}'); }catch(e){ return {}; } }
  function saveLockFails(o){ try{ localStorage.setItem('shivam_lockfails_v1', JSON.stringify(o||{})); }catch(e){} }
  function ensureMigrated(){ let u=loadUsers(); if(!u||!u.length){ const c=lockCfg(); if(c&&c.hash){ u=[{user:'admin',name:'Administrator',role:'admin',hash:c.hash}]; saveUsers(u); } } return loadUsers(); }
  function isLocked(){ const u=loadUsers(); if(u&&u.length) return true; const c=lockCfg(); return !!(c&&c.hash); }
  function showLock(){ const e=$('lockScreen'); if(!e) return; document.body.classList.remove('unlocked'); document.documentElement.classList.remove('unlocked'); e.classList.add('show');
    if($('lockUser'))$('lockUser').value=''; if($('lockPass')){ $('lockPass').value=''; $('lockPass').type='password'; } if($('pwToggle'))$('pwToggle').textContent='Show';
    $('lockErr').textContent=''; const sb=$('signinBtn'); if(sb){ sb.classList.remove('loading'); sb.disabled=false; }
    try{ const ru=localStorage.getItem('shivam_remember_user'); if(ru){ if($('lockUser'))$('lockUser').value=ru; if($('rememberMe'))$('rememberMe').checked=true; } }catch(_){}
    if($('authInfo')){ $('authInfo').style.display='none'; $('authInfo').innerHTML=''; } renderAuthMeta(); applyAuthTheme();
    setTimeout(()=>{try{ (($('lockUser')&&!$('lockUser').value)?$('lockUser'):$('lockPass')).focus(); }catch(_){}} ,80); maybeTouch();
  }
  function hideLock(){ const e=$('lockScreen'); if(e) e.classList.remove('show'); document.body.classList.add('unlocked'); document.documentElement.classList.add('unlocked'); }
  async function tryUnlock(){
    const sb=$('signinBtn'); if(sb){ sb.classList.add('loading'); sb.disabled=true; } $('lockErr').textContent='';
    const lf=lockFails();
    if(lf.until && Date.now()<lf.until){
      const secs=Math.ceil((lf.until-Date.now())/1000);
      if(sb){ sb.classList.remove('loading'); sb.disabled=false; }
      $('lockErr').textContent='Too many failed attempts — please wait '+secs+'s and try again.';
      return;
    }
    const users=ensureMigrated();
    const uname=(($('lockUser')&&$('lockUser').value)||'').trim().toLowerCase();
    const pass=$('lockPass').value;
    let u=null;
    if(users&&users.length){
      let cand=users.find(x=>x.user.toLowerCase()===uname);
      if(!cand && !uname && users.length===1) cand=users[0];
      if(cand && await checkPass(pass, cand.hash)) u=cand;
    }
    if(u){
      saveLockFails({});
      if(String(u.hash).indexOf('pbkdf2$')!==0){
        try{ u.hash=await makeHash(pass); saveUsers(users);
          if(u.role==='admin'){ const c=lockCfg()||{}; c.hash=u.hash; saveLockCfg(c); } }catch(_){}
      }
      try{ if($('rememberMe')&&$('rememberMe').checked) localStorage.setItem('shivam_remember_user',u.user); else localStorage.removeItem('shivam_remember_user'); }catch(_){}
      recordLogin(u.user);
      currentUser=u; logAudit('Signed In',''); if(sb){ sb.classList.remove('loading'); sb.disabled=false; } hideLock(); applyRole(); renderSecPanel(); renderSafetyNudge();
    } else {
      const n=(lf.n||0)+1;
      if(n>=5){ saveLockFails({n:0, until:Date.now()+30000}); $('lockErr').textContent='Too many failed attempts — sign-in paused for 30 seconds.'; }
      else { saveLockFails({n:n}); $('lockErr').textContent='Incorrect username or password'; }
      if(sb){ sb.classList.remove('loading'); sb.disabled=false; }
      if($('lockPass'))$('lockPass').value='';
      const card=$('authCard'); if(card){ card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
      if($('lockPass'))$('lockPass').focus();
    }
  }
  function lockNow(){ currentUser=null; setAuthMode('login'); showLock(); }
  function autoLockCfg(){ try{ var c=JSON.parse(localStorage.getItem('shivam_autolock_v1')||'null'); if(c && typeof c.mins==='number') return c; }catch(e){} return {mins:10}; }
  function saveAutoLockCfg(c){ try{ localStorage.setItem('shivam_autolock_v1', JSON.stringify(c||{mins:10})); }catch(e){} }
  window._lastActivity=Date.now();
  ['mousemove','keydown','mousedown','touchstart','scroll'].forEach(function(ev){ document.addEventListener(ev, function(){ window._lastActivity=Date.now(); }, {passive:true}); });
  setInterval(function(){
    try{
      var c=autoLockCfg(); if(!c.mins) return;
      if(!isLocked() || !currentUser) return;
      var ls=$('lockScreen'); if(ls && ls.classList.contains('show')) return;
      if(Date.now()-window._lastActivity > c.mins*60000){ logAudit('Auto-Locked','inactive for '+c.mins+' min'); lockNow(); }
    }catch(e){}
  }, 30000);
  window.setAutoLockMins=function(v){
    var m=Math.max(0, Math.min(240, parseInt(v,10)||0));
    saveAutoLockCfg({mins:m});
    toast(m?('\uD83D\uDD12 Auto-lock after '+m+' minute'+(m>1?'s':'')+' of inactivity'):'Auto-lock turned off');
  };
  async function enableLock(){
    const a=$('secNew').value, b=$('secNew2').value;
    if(a.length<4){ toast('Password must be at least 4 characters'); return; }
    if(a!==b){ toast('Passwords do not match'); return; }
    const h=await makeHash(a);
    saveUsers([{user:'admin',name:'Administrator',role:'admin',hash:h}]);
    saveLockCfg({hash:h, touch:false});
    currentUser={user:'admin',name:'Administrator',role:'admin'};
    $('secNew').value=''; $('secNew2').value=''; logAudit('App Lock Enabled','admin account created'); renderSecPanel(); applyRole(); toast('App lock enabled - admin account created (username: admin)');
  }
  function toggleChange(){ const e=$('secChange'); e.style.display=(e.style.display==='none'||!e.style.display)?'block':'none'; if($('secOff'))$('secOff').style.display='none'; }
  function toggleOff(){ const e=$('secOff'); e.style.display=(e.style.display==='none'||!e.style.display)?'block':'none'; $('secChange').style.display='none'; }
  async function doChangePass(){
    const users=loadUsers(); const me=currentUser||{user:'admin'};
    const meRec=users.find(x=>x.user===me.user)||users[0];
    if(!meRec || !(await checkPass($('curPass').value, meRec.hash))){ toast('Current password is wrong'); return; }
    const a=$('chgNew').value, b=$('chgNew2').value;
    if(a.length<4){ toast('New password too short'); return; }
    if(a!==b){ toast('New passwords do not match'); return; }
    meRec.hash=await makeHash(a); saveUsers(users);
    if(meRec.role==='admin'){ const c=lockCfg()||{}; c.hash=meRec.hash; saveLockCfg(c); }
    logAudit('Password Changed', meRec.user); $('curPass').value='';$('chgNew').value='';$('chgNew2').value=''; toggleChange(); toast('Password changed');
  }
  async function doDisable(){
    const users=loadUsers(); const admin=users.find(x=>x.role==='admin')||users[0];
    if(!admin || !(await checkPass($('offPass').value, admin.hash))){ toast('Password is wrong'); return; }
    logAudit('App Lock Disabled',''); localStorage.removeItem(LOCK_STORE); localStorage.removeItem(USERS_STORE); currentUser=null; $('offPass').value=''; renderSecPanel(); applyRole(); toast('App lock turned off');
  }
  async function addUser(){
    if(!currentUser || currentUser.role!=='admin'){ toast('Only an admin can add users'); return; }
    const user=($('nuUser').value||'').trim(); const name=($('nuName').value||'').trim()||user; const pass=$('nuPass').value; const role=$('nuRole').value;
    if(!user){ toast('Enter a username'); return; }
    if(pass.length<4){ toast('Password must be at least 4 characters'); return; }
    const users=loadUsers();
    if(users.some(x=>x.user.toLowerCase()===user.toLowerCase())){ toast('That username already exists'); return; }
    users.push({user, name, role, hash:await makeHash(pass)});
    saveUsers(users); logAudit('User Added', user+' ('+role+')'); $('nuUser').value='';$('nuName').value='';$('nuPass').value=''; renderSecPanel(); toast('Team member added');
  }
  function removeUser(uname){
    if(!currentUser || currentUser.role!=='admin') return;
    let users=loadUsers();
    const target=users.find(x=>x.user===uname);
    if(target && target.role==='admin' && users.filter(x=>x.role==='admin').length<=1){ toast('Cannot remove the only admin'); return; }
    if(currentUser && uname===currentUser.user){ toast('You cannot remove your own account while signed in'); return; }
    users=users.filter(x=>x.user!==uname); saveUsers(users); logAudit('User Removed', uname); renderSecPanel(); toast('Team member removed');
  }
  window.editUserPass=function(user){
    if(!currentUser || currentUser.role!=='admin'){ toast('Only an Administrator can do this'); return; }
    const row=document.getElementById('urow_'+user); if(!row) return;
    row.innerHTML='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%;">'
      +'<span style="font-size:12.5px;color:var(--muted);">New password for <b>@'+esc(user)+'</b></span>'
      +'<input id="setPassInput" type="password" placeholder="New password" style="flex:1;min-width:150px;border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:13px;background:var(--field);color:var(--text);font-family:inherit;">'
      +'<button class="btn btn-sm btn-primary" onclick="saveUserPass(\''+esc(user)+'\')">Save</button>'
      +'<button class="btn btn-sm btn-ghost" onclick="renderSecPanel()">Cancel</button></div>';
    const inp=document.getElementById('setPassInput');
    if(inp){ inp.focus(); inp.onkeydown=function(e){ if(e.key==='Enter') saveUserPass(user); if(e.key==='Escape') renderSecPanel(); }; }
  };
  window.saveUserPass=async function(user){
    const inp=document.getElementById('setPassInput'); if(!inp) return;
    const pw=inp.value||'';
    if(pw.length<4){ toast('\u26a0 Password must be at least 4 characters'); inp.focus(); return; }
    const users=loadUsers(); const u=users.find(x=>x.user===user); if(!u) return;
    u.hash=await makeHash(pw); saveUsers(users);
    try{ logAudit('Password Set For User', '@'+user); }catch(e){}
    renderSecPanel();
    toast('\u2713 New password set for @'+user+' \u2014 tell them to sign in with it.', 6000);
  };
  window.editUserName=function(user){
    const users=loadUsers(); const u=users.find(x=>x.user===user); if(!u) return;
    const row=document.getElementById('urow_'+user); if(!row) return;
    row.innerHTML='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%;">'
      +'<input id="renameInput" value="'+esc(u.name||u.user)+'" placeholder="Display name" style="flex:1;min-width:150px;border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:13px;background:var(--field);color:var(--text);font-family:inherit;">'
      +'<button class="btn btn-sm btn-primary" onclick="saveUserName(\''+esc(user)+'\')">Save</button>'
      +'<button class="btn btn-sm btn-ghost" onclick="renderSecPanel()">Cancel</button></div>';
    const inp=document.getElementById('renameInput');
    if(inp){ inp.focus(); inp.select(); inp.onkeydown=function(e){ if(e.key==='Enter') saveUserName(user); if(e.key==='Escape') renderSecPanel(); }; }
  };
  window.saveUserName=function(user){
    const inp=document.getElementById('renameInput'); if(!inp) return;
    const nm=(inp.value||'').trim();
    if(!nm){ toast('\u26a0 Please enter a name'); inp.focus(); return; }
    if(nm.length>40){ toast('\u26a0 That name is too long'); return; }
    const users=loadUsers(); const u=users.find(x=>x.user===user); if(!u) return;
    const oldName=u.name||u.user;
    u.name=nm; saveUsers(users);
    if(currentUser && currentUser.user===user) currentUser.name=nm;
    try{ logAudit('User Renamed', oldName+' \u2192 '+nm); }catch(e){}
    renderSecPanel(); updateProfileUI();
    toast('Name updated');
  };
  function renderSecPanel(){
    const on=isLocked();
    try{ renderRecoveryStatus(); }catch(e){}
    if($('secDisabled')) $('secDisabled').style.display=on?'none':'block';
    if($('secEnabled')) $('secEnabled').style.display=on?'block':'none';
    if($('secChange')) $('secChange').style.display='none';
    if($('secOff')) $('secOff').style.display='none';
    const top=$('lockTopBtn'); if(top) top.style.display=on?'inline-flex':'none';
    const ul=$('userList');
    if(ul){ const users=loadUsers();
      const canEdit=(u)=> !currentUser || currentUser.role==='admin' || currentUser.user===u.user;
      ul.innerHTML = users.map(u=>{
        const isMe=(currentUser&&currentUser.user===u.user);
        const roleTxt=u.role==='admin'?'Admin':(u.role==='manager'?'Manager':'Staff');
        return `<div class="user-item" id="urow_${esc(u.user)}">
          <div><b>${esc(u.name||u.user)}</b> <span class="muted">@${esc(u.user)} - ${roleTxt}</span>${isMe?' <span class="pp ok">signed in</span>':''}</div>
          <div style="display:flex;gap:10px;align-items:center;">
            ${canEdit(u)?`<button class="lnk" onclick="editUserName('${esc(u.user)}')">rename</button>`:''}
            ${(currentUser&&currentUser.role==='admin'&&!isMe)?`<button class="lnk" onclick="editUserPass('${esc(u.user)}')">set password</button>`:''}
            ${isMe?'':`<button class="lnk del" onclick="removeUser('${esc(u.user)}')">remove</button>`}
          </div></div>`;
      }).join('') || '<div class="pay-empty">No team members yet.</div>';
    }
    if(on && window.electronAPI && window.electronAPI.canTouchID){
      window.electronAPI.canTouchID().then(ok=>{ const r=$('touchRow'); if(r&&ok){ r.style.display='block'; const c=lockCfg(); if($('secTouch')) $('secTouch').checked=!!(c&&c.touch); } });
    }
    applyRole();
  }
  function roleLabel(r){ return r==='admin'?'Administrator':(r==='manager'?'Manager':(r==='staff'?'Staff':'User')); }
  function initialsOf(s){ s=(s||'').trim(); if(!s) return 'SE'; var p=s.split(/\s+/); var a=(p[0]||'').charAt(0); var b=(p.length>1?p[p.length-1].charAt(0):(p[0]||'').charAt(1)); return ((a+b).toUpperCase())||'SE'; }
  function updateProfileUI(){
    /* Top-right shows WHO is signed in (the firm name is already in the sidebar and on every document). */
    var nm, rl;
    if(currentUser){
      nm=currentUser.name || currentUser.user || 'User';
      rl=roleLabel(currentUser.role);
    } else if(!isLocked()){
      nm='Owner';                 /* no app lock set up yet — full access */
      rl='Administrator';
    } else {
      nm='\u2014'; rl='Not signed in';
    }
    var n=document.getElementById('pfName'); if(n) n.textContent=nm;
    var r=document.getElementById('pfRole'); if(r) r.textContent=rl;
    var a=document.getElementById('pfAva');
    if(a) a.textContent = currentUser ? initialsOf(nm) : '\u2014';
  }
  function applyRole(){
    updateProfileUI();
    // Tag the <body> with the current role so CSS can hide actions this person
    // isn't allowed to do (new/edit/delete/restructure buttons). See 02-components.css.
    try{ document.body.setAttribute('data-role', currentUser ? (currentUser.role||'staff') : 'admin'); }catch(_){}
    const isAdmin = currentUser ? currentUser.role==='admin' : true;
    const ua=$('usersAdmin'); if(ua) ua.style.display=isAdmin?'block':'none';
    const dz=$('dangerPanel'); if(dz) dz.style.display=isAdmin?'block':'none';
    const bnav=document.querySelector('#nav a[data-sec="backup"]'); if(bnav) bnav.style.display=isAdmin?'':'none'; var _rb=document.getElementById('recycleBtn'); if(_rb) _rb.style.display=isAdmin?'':'none';
    if(!isAdmin){ const cur=document.querySelector('.section.active'); if(cur&&cur.id==='sec-backup'){ go('dash'); } }
  }
  function toggleTouch(){ const c=lockCfg(); if(!c) return; c.touch=$('secTouch').checked; saveLockCfg(c); toast(c.touch?'Touch ID enabled':'Touch ID disabled'); }
  function maybeTouch(){
    const c=lockCfg(); const btn=$('touchBtn'); const ph=$('bioPlaceholder');
    if(btn && c && c.touch && window.electronAPI && window.electronAPI.canTouchID){
      window.electronAPI.canTouchID().then(ok=>{ if(ok){ btn.style.display='flex'; if(ph)ph.style.display='none'; touchUnlock(); } else { btn.style.display='none'; if(ph)ph.style.display='flex'; } });
    } else { if(btn) btn.style.display='none'; if(ph) ph.style.display='flex'; }
  }
  function togglePw(){ const i=$('lockPass'); const t=$('pwToggle'); if(!i) return; if(i.type==='password'){ i.type='text'; if(t)t.textContent='Hide'; } else { i.type='password'; if(t)t.textContent='Show'; } }
  function showForgot(){
    const el=$('authInfo'); if(!el) return;
    const users=(function(){ try{ return ensureMigrated()||[]; }catch(e){ return []; } })();
    const typed=(($('lockUser')&&$('lockUser').value)||'').trim().toLowerCase();
    const who=users.find(u=>u.user.toLowerCase()===typed) || (users.length===1?users[0]:null);

    /* Staff and managers cannot recover on their own — they must ask the Administrator. */
    if(who && who.role!=='admin'){
      el.innerHTML='<b>Ask your Administrator</b>'
        +'<p style="margin:6px 0 0;font-size:12.5px;line-height:1.55;color:var(--muted);">For security, only the Administrator can reset a password. Please ask them to set a new one for you in <b>Administration \u2192 App Lock &amp; Security</b>.</p>'
        +'<p style="margin:8px 0 0;font-size:11.5px;color:var(--muted);">If <b>you</b> are the Administrator, type your own username above and click \u201cForgot password?\u201d again.</p>';
      el.style.display='block'; return;
    }

    let rec=null; try{ rec=JSON.parse(localStorage.getItem('shivam_recovery_v1')||'null'); }catch(e){}
    let h='';
    if(rec&&rec.hash){
      const isPw = rec.kind==='password';
      h += '<b>'+(isPw?'Enter your recovery password':'Enter your recovery code')+'</b>'
        + '<p style="margin:6px 0 8px;font-size:12px;color:var(--muted);line-height:1.5;">This lets you set a new login password. <b>Nothing is deleted</b> \u2014 your records, staff accounts and settings are untouched.</p>'
        + '<div style="display:grid;gap:7px;">'
        + '<input id="recCode" type="'+(isPw?'password':'text')+'" placeholder="'+(isPw?'Recovery password':'Recovery code')+'" autocomplete="off" style="border:1px solid var(--line);border-radius:7px;padding:8px 10px;font-size:13px;background:var(--field);color:var(--text);font-family:inherit;'+(isPw?'':'letter-spacing:1px;')+'">'
        + '<input id="recPass1" type="password" placeholder="New login password" style="border:1px solid var(--line);border-radius:7px;padding:8px 10px;font-size:13px;background:var(--field);color:var(--text);font-family:inherit;">'
        + '<input id="recPass2" type="password" placeholder="Confirm new login password" style="border:1px solid var(--line);border-radius:7px;padding:8px 10px;font-size:13px;background:var(--field);color:var(--text);font-family:inherit;">'
        + '<button class="btn btn-primary" onclick="resetWithRecovery()">Get me back in</button></div>'
        + '<div style="height:1px;background:var(--line);margin:14px 0;"></div>'
        + '<span style="font-size:12px;color:var(--muted);">Lost that too? You can still reset the app lock below.</span>';
    } else {
      h += '<b>No recovery password is set on this computer.</b>'
        + '<p style="margin:6px 0 0;font-size:12px;color:var(--muted);line-height:1.5;">Once you are back in, set one in <b>Administration \u2192 App Lock &amp; Security</b> so this never traps you again.</p>';
    }
    h += '<div style="margin-top:10px;padding:11px 12px;border:1px solid var(--line);border-radius:9px;background:rgba(37,99,235,.05);">'
      + '<b>Reset the app lock</b>'
      + '<p style="margin:6px 0 0;font-size:12px;line-height:1.55;color:var(--muted);">Last resort. This clears the passwords so you can create a new Administrator account. '
      + '<b>Your loans, customers, payments and documents are NOT deleted.</b> Staff accounts will need to be added again.</p>'
      + '<div style="display:grid;gap:7px;margin-top:10px;">'
      + '<button class="btn btn-sm btn-ghost" onclick="forgotBackup()">\u2193 Save a backup file first</button>'
      + '<input id="resetConfirm" placeholder="Type RESET to confirm" autocomplete="off" style="border:1px solid var(--line);border-radius:7px;padding:8px 10px;font-size:13px;background:var(--field);color:var(--text);font-family:inherit;letter-spacing:1px;">'
      + '<button class="btn btn-danger" onclick="forgotReset()">Reset app lock</button>'
      + '</div></div>';
    el.innerHTML=h; el.style.display='block';
  }
  window.forgotBackup=function(){
    try{
      const blob=new Blob([makeBackupPayload()],{type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
      a.download='Shivam_Backup_'+todayISO()+'.json'; document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },2000);
      toast('Backup file saved \u2014 keep it somewhere safe');
    }catch(e){ toast('\u26a0 Could not save the backup file'); }
  };
  window.forgotReset=function(){
    const v=(($('resetConfirm')||{}).value||'').trim().toUpperCase();
    if(v!=='RESET'){ toast('Type RESET to confirm'); return; }
    try{ logAudit('App Lock Reset','Forgot password \u2014 lock removed, records kept'); }catch(_){}
    try{
      localStorage.removeItem(LOCK_STORE);
      localStorage.removeItem(USERS_STORE);
      localStorage.removeItem('shivam_recovery_v1');
      localStorage.removeItem('shivam_lockfails_v1');
    }catch(_){}
    currentUser=null;
    const el=$('authInfo'); if(el){ el.style.display='none'; el.innerHTML=''; }
    const le=$('lockErr'); if(le) le.textContent='';
    toast('App lock reset \u2014 create a new Administrator password. Your records are untouched.', 6000);
    setAuthMode('setup');
  };
  async function resetWithRecovery(){
    const el=$('lockErr');
    let rec=null; try{ rec=JSON.parse(localStorage.getItem('shivam_recovery_v1')||'null'); }catch(e){}
    if(!rec||!rec.hash){ if(el) el.textContent='No recovery password or code is set on this computer'; return; }
    const isPw = rec.kind==='password';
    const raw=($('recCode')?$('recCode').value:'');
    /* a random CODE is normalised; a chosen PASSWORD must be used exactly as typed */
    const secret = isPw ? raw : raw.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
    const p1=$('recPass1')?$('recPass1').value:'', p2=$('recPass2')?$('recPass2').value:'';
    if(!secret){ if(el) el.textContent='Enter your recovery '+(isPw?'password':'code'); return; }
    if(!p1||p1.length<4){ if(el) el.textContent='New password must be at least 4 characters'; return; }
    if(p1!==p2){ if(el) el.textContent='Passwords do not match'; return; }
    if(!(await checkPass('rec::'+secret, rec.hash))){
      if(el) el.textContent='That recovery '+(isPw?'password':'code')+' is not correct';
      return;
    }
    const users=ensureMigrated();
    const adm=users.find(u=>u.role==='admin');
    if(!adm){ if(el) el.textContent='No Administrator account found'; return; }
    adm.hash=await makeHash(p1); saveUsers(users);
    try{ const c=lockCfg()||{}; c.hash=adm.hash; saveLockCfg(c); }catch(e){}
    /* a one-time CODE is consumed; a recovery PASSWORD stays usable */
    if(!isPw){ try{ localStorage.removeItem('shivam_recovery_v1'); }catch(e){} }
    saveLockFails({});
    currentUser=adm; recordLogin(adm.user);
    try{ logAudit('Password Reset via Recovery', isPw?'recovery password':'recovery code'); }catch(e){}
    const info=$('authInfo'); if(info){ info.style.display='none'; info.innerHTML=''; }
    if(el) el.textContent='';
    hideLock(); applyRole(); renderSecPanel(); updateProfileUI();
    try{ renderSafetyNudge(); }catch(e){}
    toast('\u2713 Signed in. Your new password is set \u2014 nothing else was changed.', 6000);
  }
  window.saveRecoveryPassword=async function(){
    if(!currentUser || currentUser.role!=='admin'){ toast('Only an Administrator can set this'); return; }
    const a=($('recSet1')||{}).value||'', b=($('recSet2')||{}).value||'';
    if(a.length<6){ toast('\u26a0 Use at least 6 characters'); return; }
    if(a!==b){ toast('\u26a0 The two recovery passwords do not match'); return; }
    const users=loadUsers(); const me=users.find(u=>u.user===currentUser.user);
    if(me && await checkPass(a, me.hash)){ toast('\u26a0 Use something DIFFERENT from your login password'); return; }
    try{
      const h=await makeHash('rec::'+a);
      localStorage.setItem('shivam_recovery_v1', JSON.stringify({hash:h, at:Date.now(), kind:'password'}));
      $('recSet1').value=''; $('recSet2').value='';
      logAudit('Recovery Password Set','');
      renderRecoveryStatus();
      toast('\u2713 Recovery password saved. Write it down somewhere safe \u2014 it cannot be read back.', 6000);
    }catch(e){ toast('Could not save the recovery password'); }
  };
  function renderRecoveryStatus(){
    const el=$('recStatus'); if(!el) return;
    let rec=null; try{ rec=JSON.parse(localStorage.getItem('shivam_recovery_v1')||'null'); }catch(e){}
    if(rec && rec.hash){ el.textContent = rec.kind==='password' ? 'Recovery password set' : 'Recovery code set'; el.className='wa-stat on'; }
    else { el.textContent='Not set'; el.className='wa-stat off'; }
  }
  async function genRecoveryCode(){ if(!currentUser||currentUser.role!=='admin'){ toast('Only an admin can generate a recovery code'); return; } const pw=$('recPwConfirm')?$('recPwConfirm').value:''; if(!pw){ toast('Enter your admin password to confirm'); return; } const users=ensureMigrated(); const me=users.find(u=>u.user===currentUser.user)||users.find(u=>u.role==='admin'); if(!me || !(await checkPass(pw, me.hash))){ toast('Admin password is incorrect'); logAudit('Recovery code generation blocked','wrong password'); return; } if($('recPwConfirm')) $('recPwConfirm').value=''; const chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let code=''; const rnd=new Uint32Array(10); crypto.getRandomValues(rnd); for(let i=0;i<10;i++){ code+=chars[rnd[i]%chars.length]; } const h=await makeHash('rec::'+code); localStorage.setItem('shivam_recovery_v1', JSON.stringify({hash:h, at:Date.now()})); const el=$('recOut'); if(el){ el.innerHTML='Your recovery code (shown once \u2014 write it down and keep it safe):<div style="font-size:19px;font-weight:700;letter-spacing:3px;margin-top:6px;user-select:all;">'+code.slice(0,5)+'-'+code.slice(5)+'</div>'; el.style.display='block'; } logAudit('Recovery code generated',''); toast('Recovery code generated'); }
  function recordLogin(user){ try{ localStorage.setItem('shivam_lastlogin', JSON.stringify({user:user, at:Date.now()})); localStorage.removeItem('shivam_thislogin'); }catch(_){} }
  function renderAuthMeta(){ const el=$('lastLogin'); if(!el) return; try{ const r=JSON.parse(localStorage.getItem('shivam_lastlogin')||'null'); if(r&&r.at){ const d=new Date(r.at);
      let who=''; try{ const rec=(loadUsers()||[]).find(x=>x.user===r.user); who=rec?(rec.name||rec.user):(typeof r.user==='string'&&/[a-z]/i.test(r.user)?r.user:''); }catch(_){ who=''; }
      el.textContent='Last login: '+d.toLocaleDateString('en-GB')+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+(who?(' \u00b7 '+who):''); } else { el.textContent='First sign in on this device'; } }catch(_){ el.textContent=''; } }
  /* ONE theme for the whole product: the login follows the same setting as the
     app (html.dark / shivam_theme), so light/dark is never split between the two. */
  function applyAuthTheme(){ try{ const dark=document.documentElement.classList.contains('dark'); const ls=$('lockScreen'); if(ls) ls.classList.toggle('dark', dark); const ic=$('authThemeIc'); if(ic) ic.textContent=dark?'\u2600':'\u263e'; }catch(_){} }
  function toggleAuthTheme(){ try{ if(typeof toggleTheme==='function') toggleTheme(); }catch(_){} applyAuthTheme(); }
  async function touchUnlock(){
    if(!(window.electronAPI && window.electronAPI.touchID)) return;
    try{ const ok=await window.electronAPI.touchID(); if(ok){ const users=ensureMigrated(); currentUser=(users.find(x=>x.role==='admin')||users[0]||{user:'admin',name:'Administrator',role:'admin'});
      saveLockFails({}); recordLogin(currentUser.user); logAudit('Signed In','Touch ID');
      hideLock(); applyRole(); renderSecPanel(); renderSafetyNudge(); } }catch(e){}
  }
  function setAuthMode(m){
    authMode=m; const setup=(m==='setup');
    if($('authWelcome')) $('authWelcome').textContent=setup?'Set Up Your Account':'Welcome Back';
    if($('authSub')) $('authSub').textContent=setup?'Create an administrator password to secure the app':'Sign in to continue';
    if($('signinLabel')) $('signinLabel').textContent=setup?'Create Account & Sign In':'Sign In';
    const p2=$('lockPass2Field'); if(p2) p2.style.display=setup?'flex':'none';
    const row=$('authRow'); if(row) row.style.display=setup?'none':'flex';
    if($('lockPass')) $('lockPass').placeholder=setup?'Create a password (min 4 characters)':'Enter your password';
    if(setup){ if($('lockUser'))$('lockUser').value='admin'; if($('lockPass2'))$('lockPass2').value=''; if($('touchBtn'))$('touchBtn').style.display='none'; if($('bioPlaceholder'))$('bioPlaceholder').style.display='none'; }
  }
  function authSubmit(){ if(authMode==='setup') doSetup(); else tryUnlock(); }
  async function doSetup(){
    const uname=(($('lockUser')&&$('lockUser').value)||'').trim().toLowerCase()||'admin';
    const a=$('lockPass').value, b=$('lockPass2')?$('lockPass2').value:'';
    $('lockErr').textContent='';
    const fail=(msg)=>{ $('lockErr').textContent=msg; const c=$('authCard'); if(c){ c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); } };
    if(a.length<4){ fail('Password must be at least 4 characters'); return; }
    if(a!==b){ fail('Passwords do not match'); if($('lockPass2'))$('lockPass2').value=''; return; }
    const sb=$('signinBtn'); if(sb){ sb.classList.add('loading'); sb.disabled=true; }
    const h=await makeHash(a);
    saveUsers([{user:uname,name:'Administrator',role:'admin',hash:h}]);
    saveLockCfg({hash:h, touch:false});
    currentUser={user:uname,name:'Administrator',role:'admin'};
    recordLogin(currentUser.user);
    if(sb){ sb.classList.remove('loading'); sb.disabled=false; }
    logAudit('Account Created','Administrator \u2014 '+currentUser.user); logAudit('Signed In','');
    setAuthMode('login'); if($('lockPass'))$('lockPass').value=''; if($('lockPass2'))$('lockPass2').value='';
    hideLock(); applyRole(); renderSecPanel(); toast('Welcome! Your administrator account is ready.');
  }
  async function initSecureToken(){
    try{
      const api=window.electronAPI; if(!api || !api.waTokenSave) return;
      const c=loadWaCfg();
      let legacy=null;
      if(c.token) legacy=c.token;
      else if(c.tokenEnc && api.secureDecrypt){ try{ legacy=await api.secureDecrypt(c.tokenEnc); }catch(e){} }
      if(legacy){
        const r=await api.waTokenSave(legacy);
        if(r && r.ok){
          delete c.token; delete c.tokenEnc; c.tokenInKeychain=true; saveWaCfg(c);
          try{ logAudit('WhatsApp Token Secured','moved into the Mac keychain'); }catch(e){}
        }
      } else if(api.waTokenExists){
        try{ const e2=await api.waTokenExists(); if(e2 && e2.exists && !c.tokenInKeychain){ c.tokenInKeychain=true; saveWaCfg(c); } }catch(e){}
      }
      try{ delete window._waTok; }catch(e){}
    }catch(e){}
    return _initSecureTokenLegacy();
  }
  async function _initSecureTokenLegacy(){
    /* Superseded: the token now lives only in the Mac keychain, held by the main process.
       Nothing is decrypted into the renderer any more. */
    return;
  }
  function initLock(){ ensureMigrated(); renderSecPanel(); const users=loadUsers(); const mode=(users&&users.length)?'login':'setup'; showLock(); setAuthMode(mode); initSecureToken(); }

