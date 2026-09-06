/* ===========================================================================
 * src/app/27-cheque-notice.js
 *
 * CHEQUE PRESENTATION NOTICE — a WhatsApp message telling the customer that
 * their cheque (number, bank, amount) will be presented in the bank on a chosen
 * date, so they keep sufficient balance. Opened from the "cheque notice" link on
 * any cheque entry in the Payments register. Wording is the editable
 * chequepresent / chequepresent_hi template (English + Hindi).
 *
 * Public: window.chequeNotice(loanId, idx)
 * ======================================================================== */
(function () {
  function _phone(l) {
    var p = String((l && l.phone) || '').replace(/\D/g, '');
    if (p.length === 10) p = '91' + p; else if (p.length === 11 && p[0] === '0') p = '91' + p.slice(1);
    return p;
  }
  function _amtPlain(n) {
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
  function _fill(tpl, l, p, dateISO) {
    var d = (typeof fmtDate === 'function' && fmtDate(dateISO)) ? fmtDate(dateISO) : (dateISO || '');
    return String(tpl || '')
      .replace(/\{name\}/g, l.name || '')
      .replace(/\{cheque\}/g, p.cheque || '—')
      .replace(/\{bank\}/g, p.bank || 'your bank')
      .replace(/\{amount\}/g, _amtPlain(p.amount))
      .replace(/\{acno\}/g, l.acno || '')
      .replace(/\{date\}/g, d);
  }

  window.chequeNotice = function (loanId, idx) {
    var l = loans.find(function (x) { return x.id === loanId; });
    if (!l) { toast('Loan not found'); return; }
    var p = (l.payments || [])[idx];
    if (!p) { toast('Cheque entry not found'); return; }
    if (p.mode !== 'Cheque') { toast('This entry is not a cheque'); return; }
    window._cnCtx = { l: l, p: p };

    var ov = document.getElementById('cnOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'cnOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,12,26,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto;';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) window.closeChequeNotice(); });
    }
    var today = (typeof todayISO === 'function') ? todayISO() : new Date().toISOString().slice(0, 10);
    var defDate = p.date && p.date > today ? p.date : today;
    ov.innerHTML =
      '<div style="background:#fff;max-width:560px;width:100%;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0b1f4b;color:#fff;">'
      + '<div style="font-weight:700;">Cheque Presentation Notice</div>'
      + '<button onclick="closeChequeNotice()" style="border:0;border-radius:8px;padding:6px 12px;background:#334155;color:#fff;font-weight:600;cursor:pointer;">Close</button>'
      + '</div>'
      + '<div style="padding:16px 18px;">'
      + '<div style="font-size:13px;color:#334155;background:#f2f5fa;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:12px;">'
      + '<b>' + esc(l.name || '') + '</b> &middot; A/c ' + esc(l.acno || '') + '<br>'
      + 'Cheque no. <b>' + esc(p.cheque || '—') + '</b>' + (p.bank ? (' &middot; ' + esc(p.bank)) : '') + ' &middot; Rs ' + esc(_amtPlain(p.amount))
      + '</div>'
      + '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px;">'
      + '<label style="font-size:13px;color:#334155;">Presentation date <input type="date" id="cnDate" value="' + esc(defDate) + '" oninput="cnPreview()" style="border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:13px;"></label>'
      + '<label style="font-size:13px;color:#334155;">Language <select id="cnLang" onchange="cnPreview()" style="border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:13px;"><option value="en">English</option><option value="hi">हिंदी</option></select></label>'
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
    var msg = _fill(_tpl(lang), ctx.l, ctx.p, date);
    var pv = document.getElementById('cnPrev'); if (pv) pv.value = msg;
    return msg;
  };

  window.cnSend = function () {
    var ctx = window._cnCtx; if (!ctx) return;
    var ph = _phone(ctx.l);
    if (!ph) { toast('No phone number on file — open the loan to add one'); return; }
    var msg = window.cnPreview();
    window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(msg), '_blank');
    try { logAudit('Cheque Notice Sent', (ctx.l.name || '') + ' — chq ' + (ctx.p.cheque || '') + ' (' + (ctx.l.acno || '') + ')'); } catch (e) {}
    try { toast('WhatsApp opened — review and send'); } catch (e) {}
    window.closeChequeNotice();
  };

  window.closeChequeNotice = function () { var ov = document.getElementById('cnOverlay'); if (ov) ov.style.display = 'none'; };
})();
