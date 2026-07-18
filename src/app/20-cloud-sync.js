  /* ===================== Cloud sync (Supabase) =====================
     Two devices, one shared loan book. Design goals, in order:
       1. NEVER break the offline app. If cloud is disabled, unreachable, or the
          user isn't signed in, everything falls back to the existing local
          storage exactly as before.
       2. Each device holds a full local copy (works offline); changes are pushed
          up on save and pulled down by polling every few seconds.
       3. Deletions propagate via a soft-delete flag (matches the app's 30-day
          Recycle Bin) so a delete on one device removes it on the other.
       4. Optional: encrypt Aadhaar/PAN before upload (CLOUD.encryptIds).

     The database is locked by Row Level Security — nothing works until a staff
     member signs in with the logins you create in Supabase. */

  // ---- pure merge helper (unit-tested in tests/cloud-logic.js) --------------
  // Given the current local loans and a batch of remote rows, compute the new
  // local loans array plus which ids to drop into / lift out of the recycle bin.
  // No side effects, no globals — just data in, data out.
  function cloudMergeCompute(localLoans, remoteRows, decryptFn) {
    var byId = {};
    var out = (localLoans || []).slice();
    out.forEach(function (l, i) { if (l && l.id != null) byId[l.id] = i; });
    var recycleAdd = [], recycleRemove = [], maxTs = '';
    (remoteRows || []).forEach(function (row) {
      if (!row || row.id == null) return;
      if (row.updated_at && row.updated_at > maxTs) maxTs = row.updated_at;
      if (row.deleted) {
        if (byId[row.id] != null) { out[byId[row.id]] = null; delete byId[row.id]; }
        recycleAdd.push(row);
      } else {
        var obj;
        try { obj = decryptFn ? decryptFn(row.data) : row.data; } catch (e) { obj = row.data; }
        if (obj && obj.id == null) obj.id = row.id;
        if (byId[row.id] != null) out[byId[row.id]] = obj;
        else { out.push(obj); byId[row.id] = out.length - 1; }
        recycleRemove.push(row.id);
      }
    });
    return { loans: out.filter(Boolean), recycleAdd: recycleAdd, recycleRemove: recycleRemove, maxTs: maxTs };
  }
  window.cloudMergeCompute = cloudMergeCompute; // exported for tests

  // ---- pure conflict decision (unit-tested) --------------------------------
  // Given the server's current row for a loan, the baseline server-timestamp we
  // last incorporated, and our own device id, decide whether saving is safe.
  // Conflict = the server copy was changed by ANOTHER device after our baseline.
  function cloudConflictDecision(row, baselineTs, deviceId) {
    if (!row) return { ok: true };                                   // server has no copy
    if (row.updated_by === deviceId) return { ok: true };            // our own last write
    if (row.updated_at && (!baselineTs || row.updated_at > baselineTs)) {
      return { ok: false, by: row.updated_by, at: row.updated_at, deleted: !!row.deleted };
    }
    return { ok: true };                                             // server no newer than what we have
  }
  window.cloudConflictDecision = cloudConflictDecision; // exported for tests

  // Populate the "Cloud daily backup" card in Administration (safe no-op if cloud is off).
  window.renderCloudBackups = function () {
    var card = document.getElementById('cloudBackupCard'), sel = document.getElementById('cloudSnapSel');
    if (!card || !sel) return;
    if (typeof window.cloudListSnapshots !== 'function') { card.style.display = 'none'; return; }
    card.style.display = 'block';
    window.cloudListSnapshots(function (rows) {
      if (!rows || !rows.length) { sel.innerHTML = '<option value="">No cloud backups yet — one is saved each day</option>'; return; }
      sel.innerHTML = rows.map(function (r) { return '<option value="' + r.id + '">' + r.day + '</option>'; }).join('');
    });
  };
  window.restoreCloudBackup = function () {
    var sel = document.getElementById('cloudSnapSel');
    if (sel && sel.value && typeof window.cloudRestoreSnapshot === 'function') window.cloudRestoreSnapshot(sel.value);
    else if (typeof toast === 'function') toast('Choose a backup day first');
  };

  (function () {
    var C = window.CLOUD;
    if (!C || !C.enabled || !C.url || !C.key) return; // cloud off -> pure local app

    var REST = C.url.replace(/\/+$/, '') + '/rest/v1';
    var AUTH = C.url.replace(/\/+$/, '') + '/auth/v1';
    var deviceId = (function () {
      var k = 'shivam_device_id', v = localStorage.getItem(k);
      if (!v) { v = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, v); }
      return v;
    })();
    var session = null;         // { access_token, refresh_token, expires_at }
    var since = localStorage.getItem('shivam_cloud_since') || '';
    var lastHash = {};          // id -> JSON string last uploaded (skip no-op uploads)
    var serverVer = {};         // id -> server updated_at we last incorporated (for conflict detection)
    var cryptoKey = null;       // derived AES key when encryptIds is on
    var pollTimer = null, pushTimer = null, pushQueue = false;

    // read-only: how many local loans differ from what we last uploaded to the
    // cloud. Derived purely from the existing `loans` + `lastHash` — it observes
    // state, it does NOT change any sync behaviour.
    function pendingCount() {
      var n = 0;
      try { (loans || []).forEach(function (l) { if (l && l.id != null && lastHash[l.id] !== JSON.stringify(l)) n++; }); } catch (_) {}
      return n;
    }
    // Drives the top-bar pill: a friendly label + a colour "state".
    var _statusRaw = 'offline';
    function setStatus(s) {
      _statusRaw = s;
      try {
        var el = document.getElementById('cloudStatus'); if (!el) return;
        el.style.display = 'inline-flex';
        var state = 'offline', label = 'Offline';
        if (/synced/i.test(s)) { state = 'synced'; label = 'Synced'; }
        else if (/sync/i.test(s)) { state = 'syncing'; label = 'Syncing…'; }
        else if (/error/i.test(s)) { state = 'error'; label = 'Sync error'; }
        else if (/signed out/i.test(s)) { state = 'offline'; label = 'Sign in'; }
        else if (/local only/i.test(s)) { state = 'offline'; label = 'Local only'; }
        else { var _p = session ? pendingCount() : 0; label = _p > 0 ? ('Offline — ' + _p + ' pending') : 'Offline'; }
        el.setAttribute('data-state', state);
        var lab = el.querySelector('.cs-label'); if (lab) lab.textContent = label;
      } catch (_) {}
    }
    // read-only accessor so a test / the UI can read the true sync state + pending count
    window.cloudSyncInfo = function () { return { status: _statusRaw, pending: pendingCount(), signedIn: !!session }; };
    // Clicking the pill: signed in -> offer sign out; not signed in -> sign in.
    window.cloudStatusClick = function () {
      if (session) { if (confirm('Signed in to shared data as this device.\n\nSign out of the shared book on THIS computer? (Your local copy stays; other devices are unaffected.)')) window.cloudSignOut(); }
      else { showSignIn(); }
    };

    // ---- session persistence (encrypted at rest via OS keychain when available)
    async function saveSession(s) {
      session = s;
      try {
        var raw = JSON.stringify(s || null);
        if (window.electronAPI && window.electronAPI.secureEncrypt) {
          var enc = await window.electronAPI.secureEncrypt(raw);
          if (enc) { localStorage.setItem('shivam_cloud_sess', 'enc:' + enc); return; }
        }
        localStorage.setItem('shivam_cloud_sess', raw);
      } catch (_) {}
    }
    async function loadSession() {
      try {
        var v = localStorage.getItem('shivam_cloud_sess'); if (!v) return null;
        if (v.indexOf('enc:') === 0 && window.electronAPI && window.electronAPI.secureDecrypt) {
          var dec = await window.electronAPI.secureDecrypt(v.slice(4)); return dec ? JSON.parse(dec) : null;
        }
        return JSON.parse(v);
      } catch (_) { return null; }
    }
    function clearSession() { session = null; try { localStorage.removeItem('shivam_cloud_sess'); } catch (_) {} }

    // ---- low-level auth calls
    async function authPassword(email, password) {
      var r = await fetch(AUTH + '/token?grant_type=password', {
        method: 'POST', headers: { 'apikey': C.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error_description || j.msg || j.error || ('Sign-in failed (' + r.status + ')'));
      return normSession(j);
    }
    async function authRefresh() {
      if (!session || !session.refresh_token) throw new Error('no session');
      var r = await fetch(AUTH + '/token?grant_type=refresh_token', {
        method: 'POST', headers: { 'apikey': C.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error('refresh failed');
      return normSession(j);
    }
    function normSession(j) {
      return { access_token: j.access_token, refresh_token: j.refresh_token,
        expires_at: Date.now() + ((j.expires_in || 3600) * 1000) - 60000 };
    }

    // ---- authenticated REST call, auto-refreshes an expired token once
    async function api(path, opts, _retried) {
      opts = opts || {};
      if (session && session.expires_at && Date.now() > session.expires_at) {
        try { await saveSession(await authRefresh()); } catch (e) { clearSession(); throw new Error('session expired'); }
      }
      var headers = Object.assign({ 'apikey': C.key, 'Authorization': 'Bearer ' + (session && session.access_token) }, opts.headers || {});
      var r = await fetch(REST + path, Object.assign({}, opts, { headers: headers }));
      if (r.status === 401 && !_retried && session) {
        try { await saveSession(await authRefresh()); return api(path, opts, true); } catch (e) { clearSession(); throw e; }
      }
      return r;
    }

    // ---- optional field encryption (Aadhaar / PAN) ----------------------------
    var ENC_FIELDS = ['idproof', 'coid'];
    async function deriveKey(passphrase) {
      var enc = new TextEncoder();
      var base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('shivam-lms-idsalt-v1'), iterations: 150000, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    async function encField(txt) {
      if (!cryptoKey || txt == null || txt === '') return txt;
      var iv = crypto.getRandomValues(new Uint8Array(12));
      var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, cryptoKey, new TextEncoder().encode(String(txt)));
      var buf = new Uint8Array(iv.length + ct.byteLength); buf.set(iv, 0); buf.set(new Uint8Array(ct), iv.length);
      return 'enc1:' + btoa(String.fromCharCode.apply(null, buf));
    }
    async function decField(tok) {
      if (!cryptoKey || typeof tok !== 'string' || tok.indexOf('enc1:') !== 0) return tok;
      try {
        var raw = atob(tok.slice(5)); var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        var iv = bytes.slice(0, 12), ct = bytes.slice(12);
        var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, cryptoKey, ct);
        return new TextDecoder().decode(pt);
      } catch (e) { return tok; }
    }
    async function encryptLoan(obj) {
      var o = JSON.parse(JSON.stringify(obj || {}));
      if (cryptoKey) for (var f = 0; f < ENC_FIELDS.length; f++) if (o[ENC_FIELDS[f]]) o[ENC_FIELDS[f]] = await encField(o[ENC_FIELDS[f]]);
      return o;
    }
    // synchronous-looking decrypt used by the pure merge (already-decrypted upstream)
    function decryptLoanSync(data) { return data; }
    async function decryptLoanFields(o) {
      if (cryptoKey && o) for (var f = 0; f < ENC_FIELDS.length; f++) if (o[ENC_FIELDS[f]]) o[ENC_FIELDS[f]] = await decField(o[ENC_FIELDS[f]]);
      return o;
    }

    // ---- local cache write that does NOT trigger an upload (avoids echo loops)
    function localCacheSave(list) { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (_) {} }
    function rerenderAll() {
      try { recomputeAll(); } catch (_) {}
      try { if (typeof renderLoans === 'function') renderLoans(); } catch (_) {}
      try { if (typeof renderDash === 'function') renderDash(); } catch (_) {}
      try { if (typeof renderBackupStatus === 'function') renderBackupStatus(); } catch (_) {}
    }
    function addToRecycle(row) {
      try {
        if (typeof recycleLoad !== 'function') return;
        var bin = recycleLoad();
        if (!bin.some(function (x) { return x.id === row.id; })) {
          var obj = row.data || {}; obj = Object.assign({}, obj, { id: row.id, deletedAt: Date.parse(row.updated_at) || Date.now(), deletedBy: row.updated_by || 'cloud' });
          bin.unshift(obj); recycleSave(bin);
        }
      } catch (_) {}
    }
    function removeFromRecycle(id) {
      try { if (typeof recycleLoad !== 'function') return; var bin = recycleLoad(); var keep = bin.filter(function (x) { return x.id !== id; }); if (keep.length !== bin.length) recycleSave(keep); } catch (_) {}
    }

    async function applyRemote(rows) {
      // remember the server version of every row we see, for conflict detection
      (rows || []).forEach(function (r) { if (r && r.id != null && r.updated_at) serverVer[r.id] = r.updated_at; });
      // decrypt fields first (async), then run the pure merge
      for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].data && !rows[i].deleted) rows[i].data = await decryptLoanFields(rows[i].data);
      var res = cloudMergeCompute(loans, rows, decryptLoanSync);
      loans = res.loans;
      res.recycleAdd.forEach(addToRecycle);
      res.recycleRemove.forEach(removeFromRecycle);
      if (res.maxTs && res.maxTs > since) { since = res.maxTs; localStorage.setItem('shivam_cloud_since', since); }
      localCacheSave(loans);
      rerenderAll();
    }

    // ---- push local changes up
    async function pushChanged(list) {
      if (!session) return;
      var rows = [], l, s;
      for (var i = 0; i < (list || []).length; i++) {
        l = list[i]; if (!l || l.id == null) continue;
        s = JSON.stringify(l);
        if (lastHash[l.id] === s) continue;      // unchanged since last upload
        rows.push({ id: l.id, data: await encryptLoan(l), deleted: false, updated_by: deviceId });
        lastHash[l.id] = s;
      }
      if (!rows.length) return;
      try {
        var r = await api('/loans', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
        if (!r.ok) { rows.forEach(function (x) { delete lastHash[x.id]; }); setStatus('sync error'); }
        else setStatus('synced');
      } catch (e) { rows.forEach(function (x) { delete lastHash[x.id]; }); setStatus('offline'); }
    }
    async function pushDelete(id, obj) {
      if (!session || id == null) return;
      try { await api('/loans', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: id, data: await encryptLoan(obj || { id: id }), deleted: true, updated_by: deviceId }]) }); delete lastHash[id]; } catch (_) {}
    }

    // ---- pull loop
    async function poll() {
      if (!session) return;
      try {
        var q = '/loans?select=*&updated_by=neq.' + encodeURIComponent(deviceId) + '&order=updated_at.asc';
        if (since) q += '&updated_at=gt.' + encodeURIComponent(since);
        var r = await api(q, { method: 'GET' });
        if (r.ok) { var rows = await r.json(); if (rows && rows.length) await applyRemote(rows); setStatus('synced'); }
      } catch (e) { setStatus('offline'); }
    }

    // ---- first sync after login: two-way reconcile
    async function initialSync() {
      setStatus('syncing…');
      var r = await api('/loans?select=*&order=updated_at.asc', { method: 'GET' });
      if (!r.ok) { setStatus('offline'); return; }
      var rows = await r.json();
      var cloudIds = {}; rows.forEach(function (x) { cloudIds[x.id] = true; });
      await applyRemote(rows);
      // push any purely-local loans the cloud has never seen (first run / created offline)
      var localOnly = (loans || []).filter(function (l) { return l && l.id != null && !cloudIds[l.id]; });
      if (localOnly.length) await pushChanged(localOnly);
      // seed hashes so we don't immediately re-upload everything
      (loans || []).forEach(function (l) { if (l && l.id != null && lastHash[l.id] == null) lastHash[l.id] = JSON.stringify(l); });
      setStatus('synced');
      try { await maybeDailySnapshot(); } catch (_) {}   // central daily backup
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(poll, Math.max(3000, C.pollMs || 7000));
    }

    // ---- central daily backup (safety net for shared data) -------------------
    // Once a day, store the WHOLE loan book as a dated snapshot so a bad edit or
    // delete that syncs everywhere can be rolled back to an earlier day.
    async function maybeDailySnapshot() {
      if (!session) return;
      try {
        var today = todayISO();
        var chk = await api('/snapshots?select=day&day=eq.' + today + '&limit=1', { method: 'GET' });
        if (!chk.ok) return;
        var rows = await chk.json();
        if (rows && rows.length) return; // already have today's
        await api('/snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify([{ day: today, data: loans, taken_by: deviceId }]) });
        // trim to the most recent 60 days
        try {
          var keep = await api('/snapshots?select=id&order=day.desc&offset=60&limit=1', { method: 'GET' });
          if (keep.ok) { var k = await keep.json(); if (k && k[0]) await api('/snapshots?id=lt.' + k[0].id, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } }); }
        } catch (_) {}
      } catch (_) {}
    }
    // List recent daily backups: cb(array of {id, day, taken_at})
    window.cloudListSnapshots = function (cb) {
      if (!session) { cb && cb([]); return; }
      api('/snapshots?select=id,day,taken_at&order=day.desc&limit=60', { method: 'GET' })
        .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) { cb && cb(rows || []); })
        .catch(function () { cb && cb([]); });
    };
    // Restore the whole book from a chosen daily backup (syncs to the other device too).
    window.cloudRestoreSnapshot = async function (id) {
      if (!session) { toast('Not connected to the cloud'); return; }
      try {
        var r = await api('/snapshots?select=data,day&id=eq.' + encodeURIComponent(id) + '&limit=1', { method: 'GET' });
        var rows = await r.json();
        if (!rows || !rows.length) { toast('Backup not found'); return; }
        if (!confirm('Restore the ENTIRE loan book to the backup from ' + rows[0].day + '?\n\nThis replaces the current shared data on ALL devices. (A safety snapshot of the current data is kept.)')) return;
        try { snapBefore && snapBefore('Before cloud restore ' + rows[0].day); } catch (_) {}
        loans = rows[0].data || [];
        try { recomputeAll(); } catch (_) {}
        save(); // pushes the restored book up -> other device receives it
        rerenderAll();
        try { logAudit('Cloud Backup Restored', rows[0].day); } catch (_) {}
        toast('Restored the book from ' + rows[0].day);
      } catch (e) { toast('Restore failed'); }
    };

    // ---- public hooks used by save() and delLoan() (see 01-core-store / 07-loans-crud)
    window.cloudPush = function (list) {
      if (window._cloudApplying) return;             // don't re-push what we just pulled
      pushQueue = true;
      if (pushTimer) return;
      pushTimer = setTimeout(function () { pushTimer = null; if (pushQueue) { pushQueue = false; pushChanged(list || loans); } }, 600);
    };
    window.cloudDelete = function (id, obj) { pushDelete(id, obj); };
    window.cloudSignOut = function () { clearSession(); if (pollTimer) clearInterval(pollTimer); setStatus('signed out'); showSignIn(); };
    window.cloudPullNow = function () { try { poll(); } catch (e) {} };

    // ---- optimistic-concurrency guard: called before committing an edit to an
    // existing loan. Returns {ok:true} if it is safe to save, or {ok:false, by, at}
    // if the server copy was changed by ANOTHER device since we last saw it — so the
    // caller can warn before overwriting. Never blocks: offline / no session / any
    // error / a slow network (2.5s cap) all resolve to {ok:true}.
    window.cloudGuardSave = function (id) {
      if (!session || id == null) return Promise.resolve({ ok: true });
      var check = (async function () {
        try {
          var r = await api('/loans?select=updated_at,updated_by,deleted&id=eq.' + encodeURIComponent(id) + '&limit=1', { method: 'GET' });
          if (!r.ok) return { ok: true };
          var rows = await r.json();
          return cloudConflictDecision(rows && rows[0], serverVer[id] || '', deviceId);
        } catch (e) { return { ok: true }; }
      })();
      var timeout = new Promise(function (res) { setTimeout(function () { res({ ok: true, timedOut: true }); }, 2500); });
      return Promise.race([check, timeout]);
    };

    // ---- minimal sign-in card (only shown when cloud is on and no session) ----
    function showSignIn(errMsg) {
      if (document.getElementById('cloudSignIn')) { if (errMsg) document.getElementById('cloudSignInErr').textContent = errMsg; return; }
      var wrap = document.createElement('div');
      wrap.id = 'cloudSignIn';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(6,14,30,.72);backdrop-filter:blur(3px);';
      wrap.innerHTML =
        '<div style="width:340px;max-width:92vw;background:#101a2e;color:#eaf0fb;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:22px 20px;font-family:inherit;box-shadow:0 20px 60px rgba(0,0,0,.5);">' +
        '<div style="font-size:16px;font-weight:700;margin-bottom:2px;color:#f4f7ff;">Connect to shared data</div>' +
        '<div style="font-size:12px;color:#9fb0cc;margin-bottom:16px;">Sign in so this device shares the same loan book.</div>' +
        '<input id="cloudEmail" type="email" placeholder="Staff email" autocomplete="username" style="width:100%;box-sizing:border-box;margin-bottom:9px;padding:10px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#eaf0fb;font-size:14px;">' +
        '<input id="cloudPass" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;box-sizing:border-box;margin-bottom:6px;padding:10px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#eaf0fb;font-size:14px;">' +
        '<div id="cloudSignInErr" style="color:#ff9b9b;font-size:12px;min-height:16px;margin-bottom:8px;"></div>' +
        '<button id="cloudSignInBtn" style="width:100%;padding:11px;border:0;border-radius:9px;background:#4F46E5;color:#fff;font-weight:600;font-size:14px;cursor:pointer;">Sign in</button>' +
        '<div style="font-size:11px;color:#8a97b0;margin-top:12px;text-align:center;">Work offline instead? <a id="cloudSkip" style="color:#a5b4fc;cursor:pointer;">Skip for now</a></div>' +
        '</div>';
      document.body.appendChild(wrap);
      if (errMsg) document.getElementById('cloudSignInErr').textContent = errMsg;
      var go = async function () {
        var btn = document.getElementById('cloudSignInBtn'); var em = document.getElementById('cloudEmail').value.trim(); var pw = document.getElementById('cloudPass').value;
        if (!em || !pw) { document.getElementById('cloudSignInErr').textContent = 'Enter email and password.'; return; }
        btn.disabled = true; btn.textContent = 'Signing in…'; document.getElementById('cloudSignInErr').textContent = '';
        try {
          await saveSession(await authPassword(em, pw));
          wrap.remove();
          if (C.encryptIds) await ensureCryptoKey();
          await initialSync();
        } catch (e) { btn.disabled = false; btn.textContent = 'Sign in'; document.getElementById('cloudSignInErr').textContent = String(e.message || e); }
      };
      document.getElementById('cloudSignInBtn').onclick = go;
      document.getElementById('cloudPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      document.getElementById('cloudSkip').onclick = function () { wrap.remove(); setStatus('offline (local only)'); };
    }

    async function ensureCryptoKey() {
      // passphrase for the optional Aadhaar/PAN encryption; stored per-device via keychain
      try {
        var pass = null;
        if (window.electronAPI && window.electronAPI.secureDecrypt) {
          var v = localStorage.getItem('shivam_idkey'); if (v) pass = await window.electronAPI.secureDecrypt(v);
        }
        if (!pass) {
          pass = window.prompt('Set a data-protection passphrase for Aadhaar/PAN (must be the SAME on both devices):');
          if (!pass) return;
          if (window.electronAPI && window.electronAPI.secureEncrypt) { var enc = await window.electronAPI.secureEncrypt(pass); if (enc) localStorage.setItem('shivam_idkey', enc); }
        }
        cryptoKey = await deriveKey(pass);
      } catch (_) {}
    }

    // ---- boot: try silent login from a stored session, else show sign-in ------
    async function boot() {
      setStatus('syncing…');   // reveal the pill straight away
      try {
        session = await loadSession();
        if (session && session.refresh_token) {
          try { await saveSession(await authRefresh()); } catch (e) { clearSession(); }
        }
        if (session && session.access_token) {
          if (C.encryptIds) await ensureCryptoKey();
          await initialSync();
        } else {
          setStatus('signed out');   // pill shows "Sign in"
          showSignIn();
        }
      } catch (e) { setStatus('offline'); }
    }
    // start a little after the app has painted and the local data is loaded
    if (document.readyState === 'complete') setTimeout(boot, 800);
    else window.addEventListener('load', function () { setTimeout(boot, 800); });
  })();
