/* ===========================================================================
 * src/app/33-diagnostics.js
 *
 * Three things a reviewer (and a support call) will look for:
 *
 *  1) safe(fn, context)  — run something risky WITHOUT swallowing the failure.
 *     The app has many `try{...}catch(e){}` guards; they keep it fail-safe but
 *     make faults invisible. Use safe() in new code so a failure still reports
 *     to the existing error log instead of vanishing.
 *
 *  2) A Diagnostics panel in Administration that shows the rolling error log
 *     (it was being recorded but there was no way to read it), with one-click
 *     copy so it can be sent for support.
 *
 *  3) An accessibility pass: any control that has a `title` but no accessible
 *     name gets one, and the page landmarks are labelled. Doing it centrally
 *     fixes every icon-only button at once — current and future.
 * ======================================================================== */
(function () {
  /* ---------------- 1. safe() ---------------- */
  window.safe = function (fn, context) {
    try { return fn(); }
    catch (e) {
      try {
        if (typeof reportError === 'function') reportError(context || 'safe', (e && e.message) || String(e), e && e.stack);
        else if (typeof logAudit === 'function') logAudit('App Error', (context || '') + ': ' + ((e && e.message) || e));
      } catch (_) {}
      return undefined;
    }
  };

  /* ---------------- 2. Diagnostics panel ---------------- */
  function _log() {
    try { return (typeof window.errorLog === 'function') ? (window.errorLog() || []) : []; }
    catch (e) { return []; }
  }
  function renderDiagnostics() {
    var host = document.getElementById('sec-backup'); if (!host) return;
    var el = document.getElementById('diagPanel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'diagPanel'; el.className = 'panel';
      host.appendChild(el);
    }
    var rows = _log().slice().reverse();
    var body;
    if (!rows.length) {
      body = '<div class="empty"><b>No errors recorded</b>Nothing has gone wrong in this installation.</div>';
    } else {
      body = '<div class="reg-wrap" style="max-height:320px;overflow:auto;"><table class="data reg-table"><thead><tr>'
        + '<th>When</th><th>Where</th><th>Problem</th></tr></thead><tbody>'
        + rows.map(function (r) {
            var d = new Date(r.at || Date.now());
            var when = d.toLocaleDateString('en-IN') + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            var E = (typeof esc === 'function') ? esc : function (s) { return String(s == null ? '' : s); };
            return '<tr><td style="white-space:nowrap;">' + E(when) + '</td><td>' + E(r.where || '—')
                 + '</td><td>' + E(r.msg || '') + '</td></tr>';
          }).join('')
        + '</tbody></table></div>';
    }
    el.innerHTML = '<div class="panel-head"><div class="t"><h3>Diagnostics</h3>'
      + '<p>Faults recorded by the app (last 50). Useful when reporting a problem — nothing here is sent anywhere.</p></div>'
      + '<div class="actions">'
      + '<button class="btn btn-sm btn-ghost" onclick="diagCopy()">Copy for support</button>'
      + '<button class="btn btn-sm btn-ghost" onclick="diagClear()">Clear</button>'
      + '</div></div>' + body;
  }
  window.renderDiagnostics = renderDiagnostics;
  window.diagCopy = function () {
    var txt;
    try {
      var app = 'v__APP_VERSION__';        // build.js substitutes the real package.json version
      txt = 'Shivam LMS diagnostics ' + app + '\n' + navigator.userAgent + '\n\n'
          + _log().map(function (r) {
              return new Date(r.at).toISOString() + ' [' + (r.where || '') + '] ' + (r.msg || '') + (r.stack ? ('\n' + r.stack) : '');
            }).join('\n\n');
    } catch (e) { txt = ''; }
    try {
      navigator.clipboard.writeText(txt);
      if (typeof toast === 'function') toast('Diagnostics copied — paste them into your support message.');
    } catch (e) {
      if (typeof toast === 'function') toast('Could not copy automatically — open the Audit Log instead.');
    }
  };
  window.diagClear = function () {
    if (!confirm('Clear the recorded fault log?')) return;
    try { localStorage.removeItem('shivam_errlog_v1'); } catch (e) {}
    try { window._errSeen = {}; window._errCount = 0; } catch (e) {}
    renderDiagnostics();
    if (typeof toast === 'function') toast('Fault log cleared');
  };

  /* ---------------- 3. Accessibility pass ---------------- */
  function a11yPass(root) {
    var scope = root || document;
    try {
      // Give every control that only shows an icon a real accessible name.
      var els = scope.querySelectorAll('button[title],a[title],input[title],select[title]');
      Array.prototype.forEach.call(els, function (el) {
        if (el.getAttribute('aria-label')) return;
        var t = el.getAttribute('title');
        if (!t) return;
        var text = (el.textContent || '').trim();
        if (text.length >= 2) return;            // already has a visible label
        el.setAttribute('aria-label', t);
      });
      // Checkbox / radio inputs that rely on a neighbouring label only
      var boxes = scope.querySelectorAll('input[type=checkbox]:not([aria-label]):not([id])');
      Array.prototype.forEach.call(boxes, function (b) {
        var lab = b.closest('label');
        if (lab) { var s = (lab.textContent || '').trim().slice(0, 80); if (s) b.setAttribute('aria-label', s); }
      });
    } catch (e) {}
  }
  function landmarks() {
    try {
      var sb = document.querySelector('.sidebar');
      if (sb && !sb.getAttribute('role')) { sb.setAttribute('role', 'navigation'); sb.setAttribute('aria-label', 'Main sections'); }
      var tb = document.querySelector('.topbar');
      if (tb && !tb.getAttribute('role')) { tb.setAttribute('role', 'banner'); }
      var mn = document.querySelector('.main') || document.querySelector('#content') || document.querySelector('main');
      if (mn && !mn.getAttribute('role')) { mn.setAttribute('role', 'main'); }
      var gs = document.getElementById('globalSearch');
      if (gs && !gs.getAttribute('aria-label')) gs.setAttribute('aria-label', 'Search borrowers by name, account number or phone');
      // sheets should announce themselves as dialogs
      ['payRegOverlay', 'chgRegOverlay', 'bulkOverlay'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el.getAttribute('role')) { el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); }
      });
    } catch (e) {}
  }

  /* run once, then keep up with re-rendered screens (debounced, cheap) */
  var _t = null;
  function schedule() { if (_t) return; _t = setTimeout(function () { _t = null; a11yPass(); }, 250); }
  function boot() {
    landmarks(); a11yPass(); renderDiagnostics();
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; } }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(function () { landmarks(); renderDiagnostics(); }, 800);
})();
