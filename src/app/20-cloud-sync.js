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
  /* `pending` maps loanId -> { base, data } for edits made offline that have not
     reached the server yet. Without it this function replaced the local loan with
     the remote one unconditionally, so an edit made offline on device A was wiped
     the moment device B's version arrived -- the outbox then re-sent B's own row
     back, and A's work was gone with no warning.

     When the server row changed, by another device, AFTER the baseline the pending
     edit was made against, that is a genuine conflict: keep the local (pending)
     version, leave the edit queued, and report the conflict for resolution.
     Neither side is discarded. */
  function cloudMergeCompute(localLoans, remoteRows, decryptFn, pending, deviceId) {
    var byId = {};
    var out = (localLoans || []).slice();
    out.forEach(function (l, i) { if (l && l.id != null) byId[l.id] = i; });
    var recycleAdd = [], recycleRemove = [], maxTs = '', conflicts = [];
    pending = pending || {};
    (remoteRows || []).forEach(function (row) {
      if (!row || row.id == null) return;
      if (row.updated_at && row.updated_at > maxTs) maxTs = row.updated_at;
      var pend = pending[row.id];
      var mine = pend && deviceId && row.updated_by === deviceId;
      var clash = pend && !mine &&
                  row.updated_at && (!pend.base || row.updated_at > pend.base);
      if (row.deleted) {
        if (clash) {                       // they deleted it, we edited it offline
          conflicts.push({ id: row.id, kind: 'deleted-remotely',
                           at: row.updated_at, by: row.updated_by, local: pend.data });
          recycleRemove.push(row.id);
          return;                          // keep our copy; do not bin it silently
        }
        if (byId[row.id] != null) { out[byId[row.id]] = null; delete byId[row.id]; }
        recycleAdd.push(row);
      } else {
        var obj;
        try { obj = decryptFn ? decryptFn(row.data) : row.data; } catch (e) { obj = row.data; }
        if (obj && obj.id == null) obj.id = row.id;
        if (clash) {
          conflicts.push({ id: row.id, kind: 'both-edited',
                           at: row.updated_at, by: row.updated_by,
                           local: pend.data, remote: obj });
          recycleRemove.push(row.id);
          return;                          // our pending edit stays in `out`
        }
        if (byId[row.id] != null) out[byId[row.id]] = obj;
        else { out.push(obj); byId[row.id] = out.length - 1; }
        recycleRemove.push(row.id);
      }
    });
    return { loans: out.filter(Boolean), recycleAdd: recycleAdd, recycleRemove: recycleRemove,
             maxTs: maxTs, conflicts: conflicts };
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
      if (cryptoKey) {
        for (var f = 0; f < ENC_FIELDS.length; f++) if (o[ENC_FIELDS[f]]) o[ENC_FIELDS[f]] = await encField(o[ENC_FIELDS[f]]);
        // the unlimited-ID list carries the same sensitive numbers — encrypt each one too
        if (Array.isArray(o.ids)) for (var g = 0; g < o.ids.length; g++) if (o.ids[g] && o.ids[g].n) o.ids[g].n = await encField(o.ids[g].n);
      }
      return o;
    }
    // synchronous-looking decrypt used by the pure merge (already-decrypted upstream)
    function decryptLoanSync(data) { return data; }
    async function decryptLoanFields(o) {
      if (cryptoKey && o) {
        for (var f = 0; f < ENC_FIELDS.length; f++) if (o[ENC_FIELDS[f]]) o[ENC_FIELDS[f]] = await decField(o[ENC_FIELDS[f]]);
        if (Array.isArray(o.ids)) for (var g = 0; g < o.ids.length; g++) if (o.ids[g] && o.ids[g].n) o.ids[g].n = await decField(o.ids[g].n);
      }
      return o;
    }

    // ---- local cache write that does NOT trigger an upload (avoids echo loops)
    function localCacheSave(list) { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (_) {} }
    function rerenderAll() {
      try { recomputeAll(); } catch (_) {}
      try { if (typeof renderLoans === 'function') renderLoans(); } catch (_) {}
      try { if (typeof renderDash === 'function') renderDash(); } catch (_) {}
      try { if (typeof renderBackupStatus === 'function') renderBackupStatus(); } catch (_) {}
      // Also refresh whatever screen the user is currently looking at (Reports,
      // Reminders, Payments, Notices…) so a change synced from the other device
      // shows immediately, without needing to reopen the app.
      try { if (typeof window.refreshActiveView === 'function') window.refreshActiveView(); } catch (_) {}
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
      /* Drop the cached hash for anything the server says is deleted. Without
         this, restoring the identical loan from the Recycle Bin produced the
         same JSON as before the delete, so pushChanged skipped it as a no-op:
         the record came back locally while the cloud kept the tombstone, and
         the next initial sync removed it again. */
      (rows || []).forEach(function (r) { if (r && r.deleted && r.id != null) delete lastHash[r.id]; });
      var res = cloudMergeCompute(loans, rows, decryptLoanSync, pendingEditMap(), deviceId);
      loans = res.loans;
      if (res.conflicts && res.conflicts.length) conflictsRecord(res.conflicts);
      res.recycleAdd.forEach(addToRecycle);
      res.recycleRemove.forEach(removeFromRecycle);
      if (res.maxTs && res.maxTs > since) { since = res.maxTs; localStorage.setItem('shivam_cloud_since', since); }
      localCacheSave(loans);
      rerenderAll();
    }

    // ---- push local changes up
    async function pushChanged(list) {
      if (!session) return;
      var rows = [], l, s, hashOf = {};
      for (var i = 0; i < (list || []).length; i++) {
        l = list[i]; if (!l || l.id == null) continue;
        s = JSON.stringify(l);
  if (lastHash[l.id] === s) continue;      // unchanged since last upload
        rows.push({ id: l.id, data: await encryptLoan(l), deleted: false, updated_by: deviceId });
  
        /* Record WHICH version this row carries, in a SIDE MAP. public.loans has
           only (id, data, deleted, updated_at, updated_by): putting _hash on the
           row object serialised it into the POST body and PostgREST rejected the
           upsert as an unknown column — no loan edit could sync at all.
           The map exists because lastHash must not be committed before the await:
           a second save can start another push, and if v2 lands first and v1 last,
           both successes would clear the queue while lastHash claimed v2 was up. */
        hashOf[l.id] = s;      // side map — NEVER a column on the row
      }
      if (!rows.length) return;
      /* Before overwriting a row, check the server copy against the baseline we
         last incorporated. Two devices editing the same loan while both online
         could each upsert successfully, the later write replacing the earlier
         one wholesale, and neither device ever saw a conflict.
         NOTE: this is a read-then-write, so a genuine simultaneous write can
         still slip through. Closing that completely needs a server-side
         precondition (an updated_at check inside the UPDATE, via an RPC), which
         is a Supabase schema change and is deliberately not done from here. */
      try {
        var _keep = [];
        for (var ci = 0; ci < rows.length; ci++) {
          var _rid = rows[ci].id;
          var _cur = null, _readOK = false;
          try {
            var _cr = await api('/loans?id=eq.' + encodeURIComponent(_rid) + '&select=id,updated_at,updated_by,deleted');
            if (_cr && _cr.ok) { var _cj = await _cr.json(); _cur = (_cj && _cj[0]) || null; _readOK = true; }
          } catch (_) { _readOK = false; }
          /* A failed read is NOT "there is no server row". Treating it that way
             let the write proceed and overwrite a row that had changed — the
             precheck failed open, which is worse than not having one. Hold the
             edit and retry later instead. */
          if (!_readOK) {
            delete lastHash[_rid];
            pendingEditAdd(_rid);
            setStatus('offline');
            continue;
          }
          var _d = cloudConflictDecision(_cur, serverVer[_rid] || '', deviceId);
          if (_d.ok) { _keep.push(rows[ci]); }
          else {
            delete lastHash[_rid];
            pendingEditAdd(_rid);
            conflictsRecord([{ id: _rid, kind: 'both-edited', at: _d.at, by: _d.by,
                               local: (loans || []).find(function (x) { return x && x.id === _rid; }) || null,
                               remote: null }]);
          }
        }
        rows = _keep;
        if (!rows.length) { setStatus('conflict'); return; }
      } catch (_) {}
      /* Everything above this point has awaited the network. The loan may have
         been DELETED locally in the meantime — cloudDelete pushes a tombstone,
         and this upsert, landing after it with deleted:false, brought the
         record back from the dead on every device. A loan that is no longer in
         the book is no longer ours to write. */
      rows = rows.filter(function (x) {
        var live = (loans || []).some(function (y) { return y && y.id === x.id; });
        if (!live) { delete lastHash[x.id]; delete hashOf[x.id]; pendingEditRemove(x.id); }
        return live;
      });
      if (!rows.length) return;
      var _ids = rows.map(function (x) { return x.id; });
      try {
        var r = await api('/loans', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
        if (!r.ok) { rows.forEach(function (x) { delete lastHash[x.id]; }); _ids.forEach(pendingEditAdd); setStatus('sync error'); }
        else {
          /* Commit per row, and only for the version that just succeeded. A
             later save that produced a newer version must stay queued rather
             than being cleared by an older request finishing after it. */
          rows.forEach(function (x) {
            var cur = null;
            try { var lx = (loans || []).find(function (y) { return y && y.id === x.id; }); cur = lx ? JSON.stringify(lx) : null; } catch (_) {}
            if (cur === null) { delete lastHash[x.id]; pendingEditRemove(x.id); return; }   // deleted locally while in flight
            if (hashOf[x.id] !== cur) { lastHash[x.id] = null; return; }                    // superseded — keep it queued
            lastHash[x.id] = hashOf[x.id];
            pendingEditRemove(x.id);
          });
          setStatus('synced');
        }
      } catch (e) { rows.forEach(function (x) { delete lastHash[x.id]; }); _ids.forEach(pendingEditAdd); setStatus('offline'); }
    }
    /* Returns true only when the tombstone actually reached the server. It used
       to return undefined whatever happened, so the snapshot restore counted a
       failed tombstone as done and told the owner every device had been
       replaced while the other device still held the loan. */
    async function pushDelete(id, obj) {
      if (!session || id == null) return false;
      try {
        var r = await api('/loans', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: id, data: await encryptLoan(obj || { id: id }), deleted: true, updated_by: deviceId }]) });
        if (r && r.ok === false) { pendingDelAdd(id, obj); return false; }
        pendingDelRemove(id); delete lastHash[id]; delete serverVer[id];
        return true;
      } catch (_) { pendingDelAdd(id, obj); return false; }
    }
    // ---- offline-safe outbox --------------------------------------------------
    // Deletes and edits that fail to reach Supabase (offline / server error) are
    // remembered and re-sent on the next successful poll and at initial sync, so a
    // change made while offline can never be silently lost or resurrected.
    var PENDING_DEL_STORE = 'shivam_cloud_pending_del_v1';
    var PENDING_EDIT_STORE = 'shivam_cloud_pending_edit_v1';
    function _pendLoad(k) { try { var a = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function _pendSave(k, a) { try { localStorage.setItem(k, JSON.stringify(a)); } catch (e) {} }
    function pendingDelLoad() { return _pendLoad(PENDING_DEL_STORE); }
    /* Entries are {id, data}: the whole deleted loan, not just its id. A retry
       used to upsert {id:id} as the tombstone's payload, which REPLACED the
       cloud row's data — the other device's Recycle Bin then held a record with
       no borrower, no account number and no payment history, so there was
       nothing to restore. Legacy bare-id entries still load. */
    function pendingDelAdd(id, obj) {
      if (id == null) return;
      var a = pendingDelLoad();
      var at = -1;
      a.forEach(function (e, i) { if ((e && typeof e === 'object' ? e.id : e) === id) at = i; });
      var entry = { id: id, data: (obj && typeof obj === 'object') ? obj : null };
      if (at >= 0) { if (!a[at] || typeof a[at] !== 'object' || !a[at].data) a[at] = entry; }
      else a.push(entry);
      _pendSave(PENDING_DEL_STORE, a);
    }
    function pendingDelRemove(id) {
      var a = pendingDelLoad();
      var b = a.filter(function (e) { return (e && typeof e === 'object' ? e.id : e) !== id; });
      if (b.length !== a.length) _pendSave(PENDING_DEL_STORE, b);
    }
    /* Entries are {id, base, data}: the loan as WE have it, plus the server
       timestamp we last incorporated for it. Older installs stored bare ids —
       those still load, they simply have no baseline, which makes any remote
       change look like a conflict (safe: nothing is discarded).
       The snapshot is what lets a retry re-send OUR edit rather than whatever
       happens to be in `loans` by the time the retry runs. */
    function pendingEditRaw() { return _pendLoad(PENDING_EDIT_STORE); }
    function pendingEditLoad() { return pendingEditRaw().map(function (e) { return (e && typeof e === 'object') ? e.id : e; }); }
    function pendingEditMap() {
      var m = {};
      pendingEditRaw().forEach(function (e) {
        if (e && typeof e === 'object' && e.id != null) m[e.id] = { base: e.base || '', data: e.data || null };
        else if (e != null) m[e] = { base: '', data: null };     // legacy bare id
      });
      return m;
    }
    function pendingEditAdd(id) {
      if (id == null) return;
      var a = pendingEditRaw();
      var loan = (typeof loans !== 'undefined' && Array.isArray(loans))
        ? loans.find(function (x) { return x && x.id === id; }) : null;
      var entry = { id: id, base: serverVer[id] || '', data: loan ? JSON.parse(JSON.stringify(loan)) : null };
      var at = -1;
      a.forEach(function (e, i) { if ((e && typeof e === 'object' ? e.id : e) === id) at = i; });
      if (at >= 0) a[at] = entry; else a.push(entry);
      _pendSave(PENDING_EDIT_STORE, a);
    }
    function pendingEditRemove(id) {
      var a = pendingEditRaw();
      var b = a.filter(function (e) { return (e && typeof e === 'object' ? e.id : e) !== id; });
      if (b.length !== a.length) _pendSave(PENDING_EDIT_STORE, b);
    }
    /* Conflicts are kept, not resolved automatically — picking a winner is
       exactly the silent data loss this fix exists to stop. Both versions are
       stored so the owner can choose; the local copy stays live meanwhile. */
    var CONFLICT_STORE = 'shivam_cloud_conflicts_v1';
    function conflictsLoad() { return _pendLoad(CONFLICT_STORE); }
    function conflictsRecord(list) {
      var a = conflictsLoad();
      (list || []).forEach(function (c) {
        if (!c || c.id == null) return;
        var at = -1;
        a.forEach(function (x, i) { if (x && x.id === c.id) at = i; });
        var entry = { id: c.id, kind: c.kind, at: c.at, by: c.by,
                      local: c.local, remote: c.remote, seen: Date.now() };
        if (at >= 0) a[at] = entry; else a.push(entry);
      });
      _pendSave(CONFLICT_STORE, a);
      try { setStatus('conflict'); } catch (_) {}
      try {
        if (typeof toast === 'function') {
          toast('\u26a0 ' + a.length + ' record(s) were edited on another device too \u2014 your copy is kept; review in Administration');
        }
      } catch (_) {}
      try { if (typeof logAudit === 'function') logAudit('Sync Conflict', (list || []).map(function (c) { return c.id; }).join(', ')); } catch (_) {}
    }
    /* Resolution is explicit: 'mine' re-queues our version, 'theirs' takes the
       server copy. Either way the conflict is cleared only once a side is chosen. */
    /* Taking "theirs" must use the CURRENT server row, not the copy cached when
       the conflict was noticed — that copy can itself be stale by now, and
       writing it back would overwrite a newer version. And a remote DELETION
       has no `remote` object: the old code fell through to the else branch and
       re-queued our loan, resurrecting a record the other device deleted. */
    async function conflictResolve(id, side) {
      var a = conflictsLoad();
      var c = a.find(function (x) { return x && x.id === id; });
      if (!c) return false;
      var seenAt = c.seen;
      var clear = function () {
        /* Another conflict for the same loan can be recorded while we await the
           server. Clearing by id alone would silently discard that newer one. */
        _pendSave(CONFLICT_STORE, conflictsLoad().filter(function (x) {
          return !(x && x.id === id && x.seen === seenAt);
        }));
        try { if (typeof rerenderAll === 'function') rerenderAll(); } catch (_) {}
      };

      if (side === 'theirs') {
        var row = null, readOK = false;
        try {
          var r = await api('/loans?id=eq.' + encodeURIComponent(id) + '&select=*');
          if (r && r.ok) { var j = await r.json(); row = (j && j[0]) || null; readOK = true; }
        } catch (_) { readOK = false; }
        /* A non-OK response used to fall through to the cached copy, which is
           exactly the stale data this re-read exists to avoid. Abort instead. */
        if (!readOK) { toast('Cannot reach the cloud — try resolving again when online'); return false; }
        /* Decide from the row we just fetched, not from c.kind. A conflict
           recorded as "deleted remotely" could since have been re-created; the
           old code still deleted the local copy. */
        if (row && row.data) { try { row.data = await decryptLoanFields(row.data); } catch (_) {} }

        var i = (loans || []).findIndex(function (x) { return x && x.id === id; });
        if (row ? !!row.deleted : (c.kind === 'deleted-remotely')) {
          if (i >= 0) { var gone = loans[i]; loans.splice(i, 1); try { addToRecycle({ id: id, data: gone }); } catch (_) {} }
          pendingEditRemove(id);
          delete serverVer[id]; delete lastHash[id];
        } else {
          var obj = row ? row.data : c.remote;     // already decrypted above
          if (!obj) { toast('No cloud copy found for this record'); return false; }
          if (obj.id == null) obj.id = id;
          if (i >= 0) loans[i] = obj; else loans.push(obj);
          pendingEditRemove(id);
          /* Accepting the server's copy makes it our new baseline. Without
             this, serverVer still held the version from BEFORE the conflict, so
             the very next push compared against a stale baseline and recorded
             the identical conflict again — the owner could resolve it as often
             as he liked and it kept coming back. lastHash likewise, so the
             accepted copy is not immediately re-uploaded as if we had edited it. */
          if (row && row.updated_at) serverVer[id] = row.updated_at;
          try { lastHash[id] = JSON.stringify(obj); } catch (_) { delete lastHash[id]; }
        }
        try { if (typeof save === 'function') save(); } catch (_) {}
      } else {
        pendingEditAdd(id);                     // re-queue our copy for upload
        try { await flushPendingEdits(); } catch (_) {}
      }
      clear();
      return true;
    }
    function conflictDrop(id) {
      try { _pendSave(CONFLICT_STORE, conflictsLoad().filter(function (x) { return !(x && x.id === id); })); } catch (_) {}
    }
    window.cloudConflicts = conflictsLoad;
    window.cloudResolveConflict = conflictResolve;

    async function flushPendingDeletes() {
      if (!session) return;
      var a = pendingDelLoad(); if (!a.length) return;
      for (var i = 0; i < a.length; i++) {
        var e = a[i];
        var id = (e && typeof e === 'object') ? e.id : e;
        /* retry with the snapshot we kept; fall back to the live/bin copy,
           and only as a last resort to an id-only tombstone */
        var data = (e && typeof e === 'object' && e.data) ? e.data : null;
        if (!data) { try { data = (loans || []).find(function (x) { return x && x.id === id; }) || null; } catch (_) {} }
        try { await pushDelete(id, data || { id: id }); } catch (_) {}
      }
    }
    async function flushPendingEdits() {
      if (!session) return;
      var pend = pendingEditMap();
      /* A conflicted loan must NOT be re-sent. poll() records the conflict and
         then called this, so the same poll pushed our side over the server copy
         — resolving the clash in our favour without asking. Hold those back
         until the owner chooses. */
      var _held = {};
      try { conflictsLoad().forEach(function (c) { if (c && c.id != null) _held[c.id] = true; }); } catch (_) {}
      var ids = Object.keys(pend).filter(function (id) { return !_held[id]; });
      if (!ids.length) return;
      var list = [];
      ids.forEach(function (id) {
        var l = (loans || []).find(function (x) { return x && x.id === id; });
        // Prefer the snapshot captured when the edit was queued. `loans` may since
        // have been replaced by a remote version, and re-sending that would push
        // the other device's copy back up as if it were ours.
        if (pend[id] && pend[id].data) list.push(pend[id].data);
        else if (l) list.push(l);
        else pendingEditRemove(id);   // record was deleted -> delete outbox owns it
      });
      if (!list.length) return;
      list.forEach(function (l) { delete lastHash[l.id]; }); // force re-send of current value
      await pushChanged(list);
    }
    window.cloudPendingDeletes = function () { return pendingDelLoad(); };
    window.cloudPendingEdits = function () { return pendingEditLoad(); };
    // Diagnostic/test surface for the outbox queue mechanics (no network involved).
    window.__cloudOutbox = { delAdd: pendingDelAdd, delRemove: pendingDelRemove, delLoad: pendingDelLoad, editAdd: pendingEditAdd, editRemove: pendingEditRemove, editLoad: pendingEditLoad };

    // ---- pull loop
    async function poll() {
      if (!session) return;
      try {
        await flushPendingDeletes();                 // retry offline deletes first (idempotent)
        var q = '/loans?select=*&updated_by=neq.' + encodeURIComponent(deviceId) + '&order=updated_at.asc';
        if (since) q += '&updated_at=gt.' + encodeURIComponent(since);
        var r = await api(q, { method: 'GET' });
        if (r.ok) { var rows = await r.json(); if (rows && rows.length) await applyRemote(rows); setStatus('synced'); }
        await flushPendingEdits();                    // then re-upload any edits that failed earlier
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
      try { await flushPendingDeletes(); } catch (_) {}
      try { await flushPendingEdits(); } catch (_) {}
      // seed hashes so we don't immediately re-upload everything — but NOT for edits
      // still waiting to upload; those must stay "dirty" so the outbox retries them.
      var _pend = pendingEditLoad();
      (loans || []).forEach(function (l) { if (l && l.id != null && lastHash[l.id] == null && _pend.indexOf(l.id) < 0) lastHash[l.id] = JSON.stringify(l); });
      setStatus('synced');
      // Central user list: adopt it if the cloud has one; otherwise, if this is an
      // admin's device, seed the cloud from here so new devices can adopt roles
      // (stops a fresh install from defaulting to admin when a roster exists).
      try {
        if (typeof cloudGetSetting === 'function') {
          var _rr = await cloudGetSetting('users');
          var _cloudUsers = (_rr && _rr.data && Array.isArray(_rr.data.users)) ? _rr.data.users : null;
          if (_cloudUsers && _cloudUsers.length) { if (typeof applyUserRoster === 'function') applyUserRoster(_cloudUsers); }
          else if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin' && typeof autoPublishRoster === 'function') { await autoPublishRoster(); }
        } else if (typeof pullUserRoster === 'function') { await pullUserRoster(); }
      } catch (_) {}
      // adopt the shared WhatsApp connection so every device can send via the API
      try { if (typeof pullWaConnection === 'function') await pullWaConnection(); } catch (_) {}
      // adopt the shared firm details (letterhead, address, phones) if the other
      // device has a newer copy — otherwise a second device prints the defaults
      try { if (typeof pullFirmDetails === 'function') await pullFirmDetails(); } catch (_) {}
      // merge expenses recorded on either device
      try { if (typeof pullExpenses === 'function') await pullExpenses(); } catch (_) {}
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
        /* The snapshot used to be the loan book alone, so a full restore brought
           back the loans but not the expense register or the firm letterhead —
           both of which are now shared cloud data. Store them alongside.
           Shape: legacy snapshots are a bare ARRAY of loans; new ones are an
           OBJECT. The restore below accepts either, so the 56 existing backups
           keep working exactly as they do today. */
        var _payload = { v: 2, loans: loans };
        try { if (typeof loadExpenses === 'function') _payload.expenses = loadExpenses() || []; } catch (_) {}
        try { var _f = localStorage.getItem('shivam_firm_v1'); if (_f) _payload.firm = JSON.parse(_f); } catch (_) {}
        await api('/snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify([{ day: today, data: _payload, taken_by: deviceId }]) });
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
        /* Legacy snapshots are a bare array of loans; v2 snapshots are an object
           that also carries the expense register and the firm details. */
        var _d = rows[0].data;
        if (Array.isArray(_d)) { loans = _d; }
        else if (_d && typeof _d === 'object') {
          loans = Array.isArray(_d.loans) ? _d.loans : [];
          if (Array.isArray(_d.expenses) && typeof saveExpenses === 'function') { try { saveExpenses(_d.expenses); } catch (_) {} }
          if (_d.firm && typeof _d.firm === 'object') { try { localStorage.setItem('shivam_firm_v1', JSON.stringify(_d.firm)); } catch (_) {} }
        } else { loans = []; }
        try { recomputeAll(); } catch (_) {}
        /* The confirmation says this replaces the book on ALL devices, but the
           restore only wrote the snapshot's own rows. A loan created AFTER the
           backup was never tombstoned, so it stayed live in the cloud and on
           the other device — the restore silently kept a record the owner had
           just been told would be replaced. Tombstone anything the cloud holds
           that the snapshot does not. */
        var _reconciled = true;
        /* The outbox can still hold edits for loans the snapshot does not
           contain. Flushing them later re-created records the restore had just
           removed, and re-queued edits for loans whose contents the restore
           replaced. Rebuild both queues around the restored book. */
        try {
          var _live = {};
          (loans || []).forEach(function (l) { if (l && l.id != null) _live[l.id] = true; });
          pendingEditLoad().forEach(function (e) {
            var eid = (e && typeof e === 'object') ? e.id : e;
            if (eid != null && !_live[eid]) pendingEditRemove(eid);
          });
          Object.keys(lastHash).forEach(function (k) { if (!_live[k]) delete lastHash[k]; });
          Object.keys(serverVer).forEach(function (k) { if (!_live[k]) delete serverVer[k]; });
        } catch (_) {}
        try {
          var _keepIds = {};
          (loans || []).forEach(function (l) { if (l && l.id != null) _keepIds[l.id] = true; });
          var _cr = await api('/loans?select=id,data,deleted');
          /* A thrown request reached the catch, but an HTTP error did not: the
             tombstone loop was skipped and the restore still announced success,
             leaving post-snapshot loans alive on the other device. */
          if (!_cr || !_cr.ok) throw new Error('cloud list failed');
          {
            var _cloud = await _cr.json();
            for (var _i = 0; _i < (_cloud || []).length; _i++) {
              var _row = _cloud[_i];
              if (!_row || _row.id == null || _row.deleted) continue;
              if (_keepIds[_row.id]) continue;
              var _okDel = await pushDelete(_row.id, _row.data || { id: _row.id });   // keeps the record in the bin
              if (!_okDel) _reconciled = false;   // a tombstone that did not land is not a finished restore
            }
          }
        } catch (_) { _reconciled = false; }
        save(); // pushes the restored book up -> other device receives it
        rerenderAll();
        try { logAudit('Cloud Backup Restored', rows[0].day + (_reconciled ? '' : ' (cloud not reconciled)')); } catch (_) {}
        /* Do not claim a finished restore when the cloud half did not happen —
           the confirmation promised every device would be replaced. */
        toast(_reconciled
          ? ('Restored the book from ' + rows[0].day)
          : ('\u26a0 Restored on THIS device only from ' + rows[0].day + ' \u2014 the cloud could not be reached, so other devices still hold loans added after that backup. Open Backup and restore again when online.'));
      } catch (e) { toast('Restore failed'); }
    };

    // ---- public hooks used by save() and delLoan() (see 01-core-store / 07-loans-crud)
    window.cloudPush = function (list) {
      if (window._cloudApplying) return;             // don't re-push what we just pulled
      /* Record each changed loan AND the baseline it was edited from, right now.
         pendingEditAdd used to run only when the POST failed — by which time a
         poll could already have replaced `loans` with another device's version
         and moved serverVer on, so the outbox captured THEIR row as "our edit"
         and the stale baseline hid the conflict. Capturing here closes that
         window; a successful push removes the entry again. */
      try {
        (list || loans || []).forEach(function (l) {
          if (!l || l.id == null) return;
          if (lastHash[l.id] === JSON.stringify(l)) return;   // unchanged
          pendingEditAdd(l.id);
        });
      } catch (_) {}
      pushQueue = true;
      if (pushTimer) return;
      pushTimer = setTimeout(function () { pushTimer = null; if (pushQueue) { pushQueue = false; pushChanged(list || loans); } }, 600);
    };
    window.cloudDelete = function (id, obj) {
      /* Drop any queued edit for this loan first. flushPendingEdits prefers the
         saved snapshot even when the loan has gone from `loans`, so it could
         upload that snapshot AFTER the tombstone — and because the tombstone
         came from this same device the precheck accepted it, bringing the
         deleted loan back. */
      try { pendingEditRemove(id); } catch (_) {}
      try { conflictDrop(id); } catch (_) {}
      pushDelete(id, obj);
    };
    /* The mirror case: restoring from the Recycle Bin must cancel a queued
       delete, or the next flush tombstones the record we just brought back. */
    window.cloudUndelete = function (id) {
      try { pendingDelRemove(id); } catch (_) {}
      try { delete lastHash[id]; } catch (_) {}   // force the restore to upload
    };
    window.cloudSignOut = function () { clearSession(); if (pollTimer) clearInterval(pollTimer); setStatus('signed out'); showSignIn(); };
    window.cloudPullNow = function () { try { poll(); } catch (e) {} };
    // ---- generic shared settings (app_settings table) — used by the user-list sync
    window.cloudGetSetting = async function (key) {
      if (!session) return null;
      try { var r = await api('/app_settings?select=data,updated_at,updated_by&key=eq.' + encodeURIComponent(key) + '&limit=1', { method: 'GET' });
        if (!r.ok) return null; var rows = await r.json(); return (rows && rows[0]) ? rows[0] : null; } catch (e) { return null; }
    };
    // Used by the lock screen on a device with NO local users: if this device
    // already has a saved cloud session, load it and return the shared roster so
    // the app can offer "Sign in" (adopt existing accounts) instead of "Set up"
    // (which would wrongly create a new admin). Returns null if there's no saved
    // session or no roster — in which case the normal setup flow proceeds.
    window.cloudPeekRoster = async function () {
      try {
        if (!session) {
          session = await loadSession();
          if (session && session.refresh_token) { try { await saveSession(await authRefresh()); } catch (e) { clearSession(); } }
        }
        if (!session || !session.access_token) return null;
        var row = await window.cloudGetSetting('users');
        return (row && row.data && Array.isArray(row.data.users) && row.data.users.length) ? row.data.users : null;
      } catch (e) { return null; }
    };
    window.cloudSetSetting = async function (key, data) {
      if (!session) return { ok: false, error: 'not signed in' };
      try { var r = await api('/app_settings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: key, data: data, updated_by: deviceId, updated_at: new Date().toISOString() }]) });
        return { ok: !!(r && r.ok), status: r && r.status }; } catch (e) { return { ok: false, error: String(e) }; }
    };

    /* Loans the OTHER device deleted. The Recycle Bin was local-only, so a
       loan deleted on one machine could not be restored from the other — its
       bin was empty. The cloud already holds the full record with deleted=true
       (pushDelete soft-deletes, it does not remove the row), so the bin can
       simply read it. Nothing about delete or restore changes: restoring calls
       the normal save(), and pushUpsert already writes deleted=false. */
    window.cloudDeletedLoans = async function () {
      if (!session) return [];
      try {
        var r = await api('/loans?select=id,data,updated_at,updated_by&deleted=is.true&order=updated_at.desc&limit=200', { method: 'GET' });
        if (!r || !r.ok) return [];
        var rows = await r.json();
        if (!Array.isArray(rows)) return [];
        return rows.map(function (row) {
          var l = (row && row.data && typeof row.data === 'object') ? row.data : null;
          if (!l || !row.id) return null;
          var o = JSON.parse(JSON.stringify(l));
          o.id = row.id;
          o.deletedAt = Date.parse(row.updated_at || '') || Date.now();
          o.deletedBy = row.updated_by || '';
          o._fromCloud = true;
          return o;
        }).filter(Boolean);
      } catch (e) { return []; }
    };

    /* ---- Expenses -----------------------------------------------------
       One row per expense, like loans, so entries made on both devices merge
       instead of one overwriting the other. Removals are soft (deleted=true)
       so a delete on one device reaches the other rather than the entry
       reappearing at the next sync. All three are no-ops when signed out. */
    window.cloudPutExpense = async function (exp) {
      if (!session || !exp || !exp.id) return { ok: false };
      try {
        var r = await api('/expenses', { method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ id: String(exp.id), data: exp, deleted: false, updated_by: deviceId, updated_at: new Date().toISOString() }]) });
        return { ok: !!(r && r.ok) };
      } catch (e) { return { ok: false }; }
    };
    window.cloudDeleteExpense = async function (id) {
      if (!session || !id) return { ok: false };
      try {
        var r = await api('/expenses', { method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ id: String(id), data: { id: String(id) }, deleted: true, updated_by: deviceId, updated_at: new Date().toISOString() }]) });
        return { ok: !!(r && r.ok) };
      } catch (e) { return { ok: false }; }
    };
    window.pullExpenses = async function () {
      if (!session) return false;
      try {
        var r = await api('/expenses?select=id,data,deleted&order=updated_at.asc', { method: 'GET' });
        if (!r || !r.ok) return false;
        var rows = await r.json();
        if (!Array.isArray(rows)) return false;
        var local = (typeof loadExpenses === 'function') ? (loadExpenses() || []) : [];
        var byId = {}, changed = false;
        local.forEach(function (x) { if (x && x.id) byId[x.id] = x; });
        var cloudIds = {};
        rows.forEach(function (row) {
          if (!row || !row.id) return;
          cloudIds[row.id] = true;
          if (row.deleted) { if (byId[row.id]) { delete byId[row.id]; changed = true; } return; }
          if (!row.data || typeof row.data !== 'object') return;
          if (!byId[row.id] || JSON.stringify(byId[row.id]) !== JSON.stringify(row.data)) { byId[row.id] = row.data; changed = true; }
        });
        if (changed && typeof saveExpenses === 'function') {
          saveExpenses(Object.keys(byId).map(function (k) { return byId[k]; })
            .sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); }));
          try { if (typeof repPnlFill === 'function') repPnlFill(); } catch (e) {}
        }
        /* Seed: expenses recorded before this feature existed are local-only.
           Push any the cloud has never seen, so the second device gets the
           back history too. Entries the cloud holds as deleted are skipped by
           the cloudIds check, so a removal is never undone. */
        for (var i = 0; i < local.length; i++) {
          if (local[i] && local[i].id && !cloudIds[local[i].id]) { try { await window.cloudPutExpense(local[i]); } catch (e) {} }
        }
        return true;
      } catch (e) { return false; }
    };

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
          if (idEncOn()) await ensureCryptoKey();
          await initialSync();
        } catch (e) { btn.disabled = false; btn.textContent = 'Sign in'; document.getElementById('cloudSignInErr').textContent = String(e.message || e); }
      };
      document.getElementById('cloudSignInBtn').onclick = go;
      document.getElementById('cloudPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      document.getElementById('cloudSkip').onclick = function () { wrap.remove(); setStatus('offline (local only)'); };
    }

    // Runtime switch for Aadhaar/PAN field encryption: the shipped config default
    // OR a per-device flag set from Administration → Data protection.
    function idEncOn(){ try{ return !!C.encryptIds || localStorage.getItem('shivam_idenc_on')==='1'; }catch(e){ return !!C.encryptIds; } }
    // Guided enable (called from the Admin panel): store the shared passphrase in
    // the OS keychain, flip the flag, derive the key now, and re-push so existing
    // ID fields get encrypted in the cloud on their next sync. Leaves ensureCryptoKey
    // and deriveKey untouched — reuses the same 'shivam_idkey' the app already uses.
    window.enableIdEncryption = async function(passphrase){
      try{
        if(!passphrase || !String(passphrase).trim()) return {ok:false, error:'Enter a passphrase.'};
        if(!(window.electronAPI && window.electronAPI.secureEncrypt)) return {ok:false, error:'Secure keychain is not available on this device.'};
        var enc = await window.electronAPI.secureEncrypt(String(passphrase));
        if(!enc) return {ok:false, error:'Could not store the passphrase securely.'};
        localStorage.setItem('shivam_idkey', enc);
        localStorage.setItem('shivam_idenc_on','1');
        cryptoKey = await deriveKey(String(passphrase));
        try{ logAudit('ID Encryption Enabled','Aadhaar/PAN field encryption turned on'); }catch(_){}
        try{ (loans||[]).forEach(function(l){ if(l&&l.id!=null) delete lastHash[l.id]; }); if(session) await pushChanged(loans); }catch(_){}
        return {ok:true};
      }catch(e){ return {ok:false, error:String(e&&e.message||e)}; }
    };
    window.disableIdEncryption = function(){ try{ localStorage.setItem('shivam_idenc_on','0'); cryptoKey=null; logAudit('ID Encryption Disabled','turned off on this device'); }catch(e){} return {ok:true}; };
    window.idEncryptionStatus = function(){ try{ return { on: idEncOn(), keyed: !!cryptoKey, forcedByConfig: !!C.encryptIds }; }catch(e){ return {on:false, keyed:false, forcedByConfig:false}; } };
    // Recovery: decrypt every 'enc1:' ID field back to plain text, turn encryption
    // OFF, and re-push plaintext so the other device shows readable numbers again.
    // Run on the device that has the passphrase (in its keychain).
    window.restoreReadableIds = async function(passphrase){
      try{
        if(passphrase && String(passphrase).trim()){ try{ cryptoKey = await deriveKey(String(passphrase).trim()); }catch(_){ } }
        if(!cryptoKey){ try{ await ensureCryptoKey(); }catch(_){ } }
        if(!cryptoKey) return {ok:false, error:'Enter the data-protection passphrase in the box above first, then try again.'};
        var FIELDS=['idproof','coid']; var total=0, done=0, failed=0;
        for(var i=0;i<(loans||[]).length;i++){ var l=loans[i]; if(!l) continue;
          for(var f=0;f<FIELDS.length;f++){ var v=l[FIELDS[f]];
            if(typeof v==='string' && v.indexOf('enc1:')===0){ total++; var pt=await decField(v);
              if(typeof pt==='string' && pt.indexOf('enc1:')!==0){ l[FIELDS[f]]=pt; done++; } else { failed++; } } }
          if(Array.isArray(l.ids)) for(var g=0;g<l.ids.length;g++){ var iv=l.ids[g]&&l.ids[g].n;
            if(typeof iv==='string' && iv.indexOf('enc1:')===0){ total++; var pt2=await decField(iv);
              if(typeof pt2==='string' && pt2.indexOf('enc1:')!==0){ l.ids[g].n=pt2; done++; } else { failed++; } } } }
        localStorage.setItem('shivam_idenc_on','0'); cryptoKey=null;   // stop encrypting future saves
        try{ if(typeof save==='function') save(); }catch(_){}
        try{ (loans||[]).forEach(function(l){ if(l&&l.id!=null) delete lastHash[l.id]; }); if(session) await pushChanged(loans); }catch(_){}
        try{ if(typeof rerenderAll==='function') rerenderAll(); }catch(_){}
        try{ logAudit('ID Encryption Turned Off','restored '+done+' readable ID(s)'+(failed?(', '+failed+' could not be decrypted'):'')); }catch(_){}
        return {ok:true, total:total, done:done, failed:failed};
      }catch(e){ return {ok:false, error:String(e&&e.message||e)}; }
    };
    // Test/diagnostic hook (no secrets exposed — derives a key from a supplied passphrase, same as the real flow).
    window.__idcrypto = { setKey: async function(p){ cryptoKey = await deriveKey(String(p)); return true; }, enc: function(v){ return encField(v); }, dec: function(v){ return decField(v); }, hasKey: function(){ return !!cryptoKey; } };
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
          if (idEncOn()) await ensureCryptoKey();
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
