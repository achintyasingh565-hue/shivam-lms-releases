/* ===========================================================================
 * src/app/24-firm-details.js
 *
 * FIRM DETAILS EDITOR — lets the owner edit the letterhead used on every
 * document (reports, notices, certificates, receipts, schedules), backed by
 * localStorage key 'shivam_firm_v1' and read everywhere via FIRM().
 *
 * Renders into the "Firm Details" tab of the (tabbed) Administration screen —
 * it looks for #firmMount; if that isn't present it falls back to inserting
 * itself into #sec-backup so it always appears.
 * ======================================================================== */

function firmPanelHTML() {
  const f = (typeof FIRM === 'function') ? FIRM() : {};
  const val = (v) => esc(v == null ? '' : String(v));
  return ''
    + '<div class="panel" id="firmPanel">'
    + '  <h3>Firm Details <span id="firmSaved" class="wa-stat off" style="margin-left:6px;">Using defaults</span></h3>'
    + '  <p class="ph-sub">Your name, address, phone numbers, GSTIN and Udyam number as they should appear on <b>every</b> document — '
    + '     notices, certificates, receipts, schedules and all reports. Change it here once and every document updates.</p>'
    + '  <div class="form-grid" style="grid-template-columns:1fr 1fr; max-width:760px;">'
    + '    <div class="fg" style="grid-column:1/-1;"><label>Firm name (as printed)</label>'
    + '      <input id="firm_name" value="' + val(f.name) + '"></div>'
    + '    <div class="fg" style="grid-column:1/-1;"><label>Office address</label>'
    + '      <input id="firm_address" value="' + val(f.address) + '"></div>'
    + '    <div class="fg"><label>Phone numbers</label>'
    + '      <input id="firm_phones" value="' + val(f.phones) + '"></div>'
    + '    <div class="fg"><label>GSTIN</label>'
    + '      <input id="firm_gstin" value="' + val(f.gstin) + '"></div>'
    + '    <div class="fg"><label>Udyam Registration No.</label>'
    + '      <input id="firm_udyam" value="' + val(f.udyam) + '"></div>'
    + '  </div>'
    + '  <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">'
    + '    <button class="btn btn-primary" onclick="saveFirmDetails()">Save firm details</button>'
    + '    <button class="btn btn-sm btn-ghost" onclick="resetFirmDetails()">Reset to original</button>'
    + '  </div>'
    + '  <div id="firmPreview" class="bk-card" style="margin-top:14px;"></div>'
    + '</div>';
}

function renderFirmPreview() {
  const el = $('firmPreview');
  if (!el) return;
  const f = FIRM();
  el.innerHTML = ''
    + '<div class="ph-sub" style="margin-bottom:8px;">This is how the top of every document will read:</div>'
    + '<div style="text-align:center; padding:14px 10px; background:#fff; border:1px solid var(--line); border-radius:8px; color:#141414;">'
    + '  <div style="font-size:20px; font-weight:700; letter-spacing:1px; color:#0b1f4b;">' + esc(f.name) + '</div>'
    + '  <div style="font-size:11px; color:#444; margin-top:4px;">' + esc(f.address) + ' &nbsp;|&nbsp; Mobile: ' + esc(f.phones) + '</div>'
    + '  <div style="font-size:11px; color:#444;">GSTIN: ' + esc(f.gstin) + ' &nbsp;|&nbsp; Udyam Reg. No.: ' + esc(f.udyam) + '</div>'
    + '  <div style="border-bottom:2px solid #c8a02a; margin-top:8px;"></div>'
    + '</div>';
}

function renderFirmStatus() {
  const b = $('firmSaved');
  if (!b) return;
  let custom = null;
  try { custom = JSON.parse(localStorage.getItem('shivam_firm_v1') || 'null'); } catch (e) {}
  if (custom && typeof custom === 'object') { b.textContent = 'Custom details saved'; b.className = 'wa-stat on'; }
  else { b.textContent = 'Using defaults'; b.className = 'wa-stat off'; }
}

window.saveFirmDetails = function () {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'admin') { toast('Only an Administrator can change firm details'); return; }
  const g = (id) => (($(id) && $(id).value) || '').trim();
  const next = { name: g('firm_name'), address: g('firm_address'), phones: g('firm_phones'), gstin: g('firm_gstin'), udyam: g('firm_udyam') };
  if (!next.name) { toast('⚠ The firm name cannot be empty'); $('firm_name').focus(); return; }
  if (!next.address) { toast('⚠ The office address cannot be empty'); $('firm_address').focus(); return; }
  if (next.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(next.gstin)) {
    if (!confirm('That GSTIN does not look like a standard 15-character GSTIN.\n\nSave it anyway?')) { $('firm_gstin').focus(); return; }
  }
  next.gstin = next.gstin.toUpperCase();
  next.udyam = next.udyam.toUpperCase();
  try { localStorage.setItem('shivam_firm_v1', JSON.stringify(next)); }
  catch (e) { toast('⚠ Could not save the firm details'); return; }
  try { logAudit('Firm Details Updated', next.name + ' — ' + next.address); } catch (e) {}
  try { if (typeof applyFirmToDocs === 'function') applyFirmToDocs(); } catch (e) {}
  try { if (typeof save === 'function') save(); } catch (e) {}
  renderFirmStatus();
  renderFirmPreview();
  toast('✓ Firm details saved — every document will now use them', 5000);
};

window.resetFirmDetails = function () {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'admin') { toast('Only an Administrator can change firm details'); return; }
  if (!confirm('Reset the firm details back to the original built-in values?')) return;
  try { localStorage.removeItem('shivam_firm_v1'); } catch (e) {}
  try { logAudit('Firm Details Reset', ''); } catch (e) {}
  try { if (typeof applyFirmToDocs === 'function') applyFirmToDocs(); } catch (e) {}
  renderFirmPanel();
  toast('Firm details reset to the original values');
};

/* (Re)draw the panel with the current values, into the Firm Details tab. */
function renderFirmPanel() {
  const host = $('firmPanel');
  if (host) { host.outerHTML = firmPanelHTML(); }
  else {
    const mount = $('firmMount');
    if (mount) { mount.innerHTML = firmPanelHTML(); }
    else {
      const sec = $('sec-backup'); if (!sec) return;
      const wrap = document.createElement('div'); wrap.innerHTML = firmPanelHTML();
      const panel = wrap.firstElementChild;
      if (panel) sec.insertBefore(panel, sec.firstChild);
    }
  }
  renderFirmStatus();
  renderFirmPreview();
}

(function initFirmDetails() {
  const boot = function () {
    try { renderFirmPanel(); } catch (e) {}
    try {
      const nav = document.getElementById('nav');
      if (nav) nav.addEventListener('click', function (e) {
        const a = e.target.closest && e.target.closest('a');
        if (a && a.dataset && a.dataset.sec === 'backup') setTimeout(renderFirmPanel, 0);
      });
    } catch (e) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
