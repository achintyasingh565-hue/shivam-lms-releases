/* ===========================================================================
 * src/app/27-cheque-notice.js
 *
 * CHEQUE PRESENTATION NOTICE — a WhatsApp message telling the customer that
 * their cheque (number, bank, amount) will be presented in the bank on a chosen
 * date, so they keep sufficient balance. Two ways in:
 *   1) the "cheque notice" link on any cheque entry in the Payments register
 *      (cheque no. / bank / amount pre-filled from that entry), and
 *   2) the "Cheque Notice" button on any loan row — no cheque payment needs to
 *      exist yet; the cheque no. / bank / amount are typed into the form.
 * All three fields are editable in the modal either way. Wording is the editable
 * chequepresent / chequepresent_hi template (English + Hindi).
 *
 * Public: window.chequeNotice(loanId, idx)   // idx optional
 * ======================================================================== */
(function () {
  function _phone(l) {
    var p = String((l && l.phone) || '').replace(/\D/g, '');
    if (p.length === 10) p = '91' + p; else if (p.length === 11 && p[0] === '0') p = '91' + p.slice(1);
    return p;
  }
  function _amtPlain(n) {
    if (n === '' || n == null) return '';
    if (typeof inrPlain === 'function') return inrPlain(n);
    return Number(n || 0).toLocaleString('en-IN');
  }
  function _tpl(lang) {
    try {
      if (typeof TPL !== 'undefined' && TPL) {
        return lang === 'hi' ? (TPL.chequepresent_hi || TPL.chequepresent) : TPL.chequepresent;
      }
    } catch (e) {}
    return 'Namaste {name}, your cheque no. {cheque} (drawn on {bank}) of Rs {amount} towards loan account {acno} will be presented in the bank on {date}. Kindly keep sufficient balance to avoid cheque return / bounce charges. - ' + ((typeof FIRM === 'function') ? FIRM().name : 'Shivam Enterprises');
  }
  function _fill(tpl, l, cheque, bank, amount, dateISO) {
    var d = (typeof fmtDate === 'function' && fmtDate(dateISO)) ? fmtDate(dateISO) : (dateISO || '');
    return String(tpl || '')
      .replace(/\{name\}/g, l.name || '')
      .replace(/\{cheque\}/g, cheque || '—')
      .replace(/\{bank\}/g, bank || 'your bank')
      .replace(/\{amount\}/g, _amtPlain(amount) || '—')
      .replace(/\{acno\}/g, l.acno || '')
      .replace(/\{date\}/g, d);
  }
  var _fld = 'border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px;font-size:13px;';

  window.chequeNotice = function (loanId, idx) {
    var l = loans.find(function (x) { return x.id === loanId; });
    if (!l) { toast('Loan not found'); return; }
    // Pre-fill from an existing cheque payment when opened from the register;
    // otherwise start blank so a notice can be sent before any payment is recorded.
    var p = (idx != null) ? ((l.payments || [])[idx] || null) : null;
    if (p && p.mode !== 'Cheque') p = null;
    window._cnCtx = { l: l };

    var ov = document.getElementById('cnOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'cnOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,12,26,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto;';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) window.closeChequeNotice(); });
    }
    var today = (typeof todayISO === 'function') ? todayISO() : new Date().toISOString().slice(0, 10);
    var defDate = (p && p.date && p.date > today) ? p.date : today;
    var chq = p ? (p.cheque || '') : '';
    var bank = p ? (p.bank || '') : '';
    var amt = p ? (p.amount != null ? p.amount : '') : (l.emi != null ? l.emi : '');

    ov.innerHTML =
      '<div style="background:#fff;max-width:560px;width:100%;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0b1f4b;color:#fff;">'
      + '<div style="font-weight:700;">Cheque Presentation Notice</div>'
      + '<button onclick="closeChequeNotice()" style="border:0;border-radius:8px;padding:6px 12px;background:#334155;color:#fff;font-weight:600;cursor:pointer;">Close</button>'
      + '</div>'
      + '<div style="padding:16px 18px;">'
      + '<div style="font-size:13px;color:#334155;background:#f2f5fa;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:12px;">'
      + '<b>' + esc(l.name || '') + '</b> &middot; A/c ' + esc(l.acno || '—') + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin-bottom:12px;">'
      + '<label style="font-size:12.5px;color:#334155;display:flex;flex-direction:column;gap:3px;">Cheque no.<input id="cnCheque" value="' + esc(chq) + '" oninput="cnPreview()" placeholder="e.g. 100231" style="' + _fld + '"></label>'
      + '<label style="font-size:12.5px;color:#334155;display:flex;flex-direction:column;gap:3px;">Bank (customer’s)<input id="cnBank" value="' + esc(bank) + '" oninput="cnPreview()" placeholder="e.g. HDFC Bank" style="' + _fld + '"></label>'
      + '<label style="font-size:12.5px;color:#334155;display:flex;flex-direction:column;gap:3px;">Amount (Rs)<input id="cnAmount" type="number" value="' + esc(amt) + '" oninput="cnPreview()" placeholder="e.g. 9250" style="' + _fld + '"></label>'
      + '<label style="font-size:12.5px;color:#334155;display:flex;flex-direction:column;gap:3px;">Presentation date<input type="date" id="cnDate" value="' + esc(defDate) + '" oninput="cnPreview()" style="' + _fld + '"></label>'
      + '<label style="font-size:12.5px;color:#334155;display:flex;flex-direction:column;gap:3px;">Language<select id="cnLang" onchange="cnPreview()" style="' + _fld + '"><option value="en">English</option><option value="hi">हिंदी</option></select></label>'
      + '</div>'
      + '<div style="font-size:12px;color:#64748b;margin-bottom:4px;">Message preview:</div>'
      + '<textarea id="cnPrev" readonly style="width:100%;min-height:130px;border:1px solid #cbd5e1;border-radius:8px;padding:10px;font-size:13px;line-height:1.5;color:#111;background:#fff;resize:vertical;"></textarea>'
      + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">'
      + '<button onclick="cnSend()" style="border:0;border-radius:8px;padding:9px 16px;background:#128C7E;color:#fff;font-weight:700;cursor:pointer;">Send on WhatsApp</button>'
      + '</div>'
      + (_phone(l) ? '' : '<div style="font-size:12px;color:#b45309;margin-top:8px;">No phone number on file for this borrower — open the loan to add one.</div>')
      + '</div></div>';
    ov.style.display = 'flex';
    window.cnPreview();
  };

  window.cnPreview = function () {
    var ctx = window._cnCtx; if (!ctx) return;
    var lang = (document.getElementById('cnLang') || {}).value || 'en';
    var date = (document.getElementById('cnDate') || {}).value || '';
    var chq = (document.getElementById('cnCheque') || {}).value || '';
    var bank = (document.getElementById('cnBank') || {}).value || '';
    var amt = (document.getElementById('cnAmount') || {}).value || '';
    var msg = _fill(_tpl(lang), ctx.l, chq, bank, amt, date);
    var pv = document.getElementById('cnPrev'); if (pv) pv.value = msg;
    return msg;
  };

  window.cnSend = function () {
    var ctx = window._cnCtx; if (!ctx) return;
    var ph = _phone(ctx.l);
    if (!ph) { toast('No phone number on file — open the loan to add one'); return; }
    var msg = window.cnPreview();
    var chq = (document.getElementById('cnCheque') || {}).value || '';
    window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(msg), '_blank');
    try { logAudit('Cheque Notice Sent', (ctx.l.name || '') + ' — chq ' + (chq || '') + ' (' + (ctx.l.acno || '') + ')'); } catch (e) {}
    try { toast('WhatsApp opened — review and send'); } catch (e) {}
    window.closeChequeNotice();
  };

  window.closeChequeNotice = function () { var ov = document.getElementById('cnOverlay'); if (ov) ov.style.display = 'none'; };
})();
