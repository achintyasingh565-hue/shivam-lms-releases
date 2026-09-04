/* ===========================================================================
 * src/app/25-welcome-letter.js
 *
 * COMBINED LOAN DOCUMENT — one document the owner generates when a loan is
 * issued and hands to the customer (print / Save-as-PDF / WhatsApp). It has:
 *   Page 1  — Welcome & sanction cover letter (key loan details + terms)
 *   Page 2+ — Loan Account Detail block + full Installment Schedule with the
 *             Opening Balance / Installment / Principal / Interest split.
 *
 * Also: window.offerPaymentReceiptWA(loan, payment) — offers to WhatsApp a
 * payment receipt (amount + remaining balance) after a payment is recorded.
 *
 * Public: window.openWelcomeLetter(loanId)
 * ======================================================================== */
(function () {
  function _r(n) { return (typeof inr === 'function') ? inr(n) : ('₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')); }
  function _d(iso) { return (typeof fmtDate === 'function' && fmtDate(iso)) ? fmtDate(iso) : (iso || '—'); }
  function _today() { return (typeof todayISO === 'function') ? todayISO() : new Date().toISOString().slice(0, 10); }
  function _longDate(iso) { try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) { return _d(iso); } }
  function _addM(iso, n) { try { return (typeof repAddMonths === 'function') ? repAddMonths(iso, n) : iso; } catch (e) { return iso; } }
  function _firm() { return (typeof FIRM === 'function') ? FIRM() : { name: 'Shivam Enterprises', phones: '', address: '' }; }
  function _firstDue(l) { return l.due || _addM(l.disb || l.due || _today(), 1); }
  function _net(l) { return Math.max(0, (Number(l.principal) || 0) - (Number(l.downpay) || 0) - (Number(l.deductions) || 0)); }

  /* ---- amortising installment schedule with principal/interest split (flat interest) ---- */
  function _schedule(l) {
    var N = Number(l.tenure) || 0, P = Number(l.principal) || 0, tint = Number(l.tint) || 0,
        tpay = Number(l.tpay) || 0, emiApp = Number(l.emi) || 0;
    if (l.interestOnly || N <= 0 || emiApp <= 0 || tpay <= 0) return null;
    if (N > 600) N = 600;
    var start = l.disb || l.due || _today();
    var intPM = Math.round(tint / N);
    var rows = [], bal = P;
    for (var i = 1; i <= N; i++) {
      var emi_i = (i < N) ? emiApp : (tpay - emiApp * (N - 1));
      var int_i = (i < N) ? intPM : (tint - intPM * (N - 1));
      if (int_i < 0) int_i = 0;
      var prin_i = emi_i - int_i;
      var opening = bal;
      bal = Math.max(0, bal - prin_i);
      rows.push({ i: i, due: _d(_addM(start, i)), opening: opening, emi: emi_i, prin: prin_i, int: int_i, close: bal });
    }
    var cleared = (l.payments || []).filter(function (p) { return p.status === 'Cleared'; }).reduce(function (a, p) { return a + (Number(p.amount) || 0); }, 0);
    var paid = emiApp > 0 ? Math.min(N, Math.floor(cleared / emiApp)) : 0;
    return { rows: rows, months: N, paidCount: paid, balanceInstl: Math.max(0, N - paid) };
  }

  function _addrBlock(l) {
    var lines = [esc(l.name || 'Customer')];
    if (l.relname) lines[0] += ' ' + esc(l.reltype || 's/o') + ' ' + esc(l.relname);
    if (l.addr) lines.push(esc(l.addr));
    if (l.phone) lines.push('Mobile: ' + esc(l.phone));
    return lines.join('<br>');
  }

  function _kv(k, v) {
    return '<tr><td style="padding:3px 0;width:44%;color:#0b1f4b;font-weight:600;vertical-align:top;">' + esc(k) +
           '</td><td style="padding:3px 0;">: ' + v + '</td></tr>';
  }

  function _letterhead(compact) {
    var f = _firm();
    return '<div style="text-align:center;font-size:' + (compact ? '20px' : '24px') + ';font-weight:bold;letter-spacing:1px;color:#0b1f4b;">' + esc(f.name) + '</div>' +
      '<div style="text-align:center;font-size:11px;color:#444;margin:4px 0 2px;">' + esc(firmAddrLine()) + '<br>' + esc(firmRegLine()) + '</div>' +
      '<div style="border-bottom:2px solid #c8a02a;margin:8px 0 14px;"></div>';
  }

  function _band(title) {
    return '<div style="background:#0b1f4b;color:#fff;font-weight:700;font-size:12.5px;padding:6px 10px;margin:16px 0 8px;border-radius:3px;letter-spacing:.3px;">' + esc(title) + '</div>';
  }

  /* ---------------- Page 1: welcome / sanction cover letter ---------------- */
  function _cover(l) {
    var f = _firm();
    var io = !!l.interestOnly;
    var kv = '';
    kv += _kv('Loan Account Number', '<b>' + esc(l.acno || '—') + '</b>');
    kv += _kv('Product Type', (l.secured ? 'Secured / Mortgaged' : 'Unsecured') + (io ? ' · Interest-only' : (l.type ? (' · ' + esc(l.type)) : '')));
    kv += _kv('Sanctioned / Loan Amount', _r(l.principal));
    if (_net(l) !== (Number(l.principal) || 0)) kv += _kv('Net Amount Disbursed', _r(_net(l)));
    kv += _kv('Rate of Interest', esc(Number(l.rate) || 0) + '% per month');
    if (io) {
      kv += _kv('Monthly Interest Payable', '<b>' + _r(l.emi) + '</b>');
      kv += _kv('Principal Repayment', 'Payable in full on demand');
    } else {
      kv += _kv('Tenure', esc(Number(l.tenure) || 0) + ' months');
      kv += _kv('Monthly EMI', '<b>' + _r(l.emi) + '</b>');
      if ((Number(l.tint) || 0) > 0) kv += _kv('Total Interest', _r(l.tint));
      kv += _kv('Total Amount Payable', '<b>' + _r(l.tpay) + '</b>');
    }
    kv += _kv('Foreclosure / Prepayment Charges', 'As per loan terms');
    kv += _kv('Disbursement Date', _d(l.disb));
    kv += _kv(io ? 'First Interest Due Date' : 'First EMI Due Date', _d(_firstDue(l)));

    var terms = [
      'This loan is governed by the terms and conditions accepted by you at the time of disbursement.',
      'Please ensure that any payment receipt issued to you carries the stamp or authorised signature of ' + esc(f.name) + '.',
      (io
        ? 'Please pay the monthly interest by its due date. The full principal is repayable on demand and remains outstanding until returned.'
        : 'Please pay each EMI on or before its due date as per the schedule attached. A late fee, as applicable, may be charged on delayed payments.'),
      'Kindly retain the receipt for every payment. A No Dues Certificate will be issued once the account is fully repaid.',
      'For any query regarding your account, please contact us at ' + esc(f.phones) + '.'
    ];

    return '' +
      _letterhead(false) +
      '<div style="text-align:center;font-size:16px;font-weight:700;text-decoration:underline;letter-spacing:.5px;color:#0b1f4b;margin:2px 0 14px;">Welcome Letter</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:12px;">' +
        '<div><b>To,</b><br>' + _addrBlock(l) + '</div>' +
        '<div style="text-align:right;"><b>Date:</b> ' + _longDate(_today()) + '</div></div>' +
      '<div style="text-align:center;font-size:12.5px;font-weight:600;color:#0b1f4b;margin:6px 0 12px;">Your ' + esc(f.name) + ' Loan Account: ' + esc(l.acno || '—') + '</div>' +
      '<div style="font-size:12.5px;line-height:1.7;margin:8px 0;">Dear ' + esc(l.name || 'Customer') + ',</div>' +
      '<div style="font-size:12.5px;line-height:1.7;margin:8px 0;">We warmly welcome you to <b>' + esc(f.name) + '</b> and thank you for giving us the opportunity to be a part of your journey. We are pleased to confirm that your loan has been sanctioned and disbursed. The important details of your loan are:</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin:8px 0 6px;">' + kv + '</table>' +
      '<div style="font-weight:700;color:#0b1f4b;margin:14px 0 4px;">Important Terms</div>' +
      '<ol style="margin:0;padding-left:20px;font-size:12.5px;line-height:1.7;">' + terms.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>' +
      '<div style="font-size:12.5px;line-height:1.7;margin:16px 0 6px;">We look forward to a long and pleasant association with you.</div>' +
      '<div style="margin-top:26px;font-size:12.5px;">Sincerely,<br><b>For ' + esc(f.name) + '</b><br><br><br>Authorised Signatory</div>';
  }

  /* ---------------- Page 2+: account detail + installment schedule ---------------- */
  function _schedulePage(l) {
    var f = _firm();
    var head =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:11px;color:#444;">' +
        '<div style="font-size:18px;font-weight:bold;color:#0b1f4b;">' + esc(f.name) + '</div>' +
        '<div style="text-align:right;">Issue Date: ' + _d(_today()) + '</div></div>' +
      '<div style="text-align:center;font-weight:700;color:#0b1f4b;margin:6px 0 10px;">' + (l.interestOnly ? 'Loan Statement for ' : 'Repayment Schedule for ') + esc(l.acno || '—') + '</div>' +
      '<div style="font-size:11.5px;color:#333;margin-bottom:4px;">' + _addrBlock(l) + '</div>';

    if (l.interestOnly) {
      var noteRows = _band('Loan Account Detail as on ' + _d(_today())) +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
        _kv('Loan Account #', esc(l.acno || '—')) +
        _kv('Product Description', 'Interest-only' + (l.secured ? ' · Secured' : ' · Unsecured')) +
        _kv('Rate of Interest', esc(Number(l.rate) || 0) + '% per month') +
        _kv('Loan / Principal Amount', _r(l.principal)) +
        _kv('Monthly Interest', _r(l.emi)) +
        _kv('Loan Status', esc(l.status || 'Active')) +
        _kv('Frequency', 'Monthly (interest)') +
        '</table>' +
        _band('Customer Information') +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
        _kv('Co-Applicant Name', esc(l.coname || 'NA')) +
        _kv('Guarantor Name', esc(l.gname || 'NA')) +
        '</table>' +
        '<div style="font-size:12px;line-height:1.7;margin-top:12px;">This is an interest-only facility. The customer pays <b>' + _r(l.emi) + '</b> as interest every month. The full principal of <b>' + _r(l.principal) + '</b> remains outstanding and is <b>repayable on demand</b>; there is no fixed installment schedule.</div>';
      return head + noteRows;
    }

    var s = _schedule(l);
    var detail = _band('Loan Account Detail as on ' + _d(_today())) +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
      _kv('Loan Account #', esc(l.acno || '—')) +
      _kv('Product Description', (l.secured ? 'SECURED' : 'UNSECURED') + (l.type ? (' · ' + esc(l.type)) : '')) +
      _kv('Current Rate of Interest', esc(Number(l.rate) || 0) + '% per month (flat)') +
      _kv('Sanctioned Amount', _r(l.principal)) +
      _kv('Disbursed Amount', _r(_net(l))) +
      _kv('Total Amount Payable', _r(l.tpay)) +
      _kv('Monthly EMI', _r(l.emi)) +
      _kv('Tenure / Total Instalments', (Number(l.tenure) || 0) + ' months / ' + (s ? s.months : (Number(l.tenure) || 0))) +
      _kv('Balance Instalments', s ? String(s.balanceInstl) : String(Number(l.tenure) || 0)) +
      _kv('Loan Status', esc(l.status || 'Active')) +
      _kv('Frequency', 'Monthly') +
      '</table>' +
      _band('Customer Information') +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
      _kv('Co-Applicant Name', esc(l.coname || 'NA')) +
      _kv('Guarantor Name', esc(l.gname || 'NA')) +
      '</table>';

    var table = '';
    if (s) {
      var th = 'style="border:1px solid #bbb;padding:5px 8px;background:#0b1f4b;color:#fff;text-align:right;"';
      var thL = 'style="border:1px solid #bbb;padding:5px 8px;background:#0b1f4b;color:#fff;text-align:left;"';
      var body = s.rows.map(function (x) {
        var td = 'style="border:1px solid #bbb;padding:4px 8px;text-align:right;"';
        var tdL = 'style="border:1px solid #bbb;padding:4px 8px;text-align:left;"';
        return '<tr><td ' + tdL + '>' + x.i + '</td><td ' + tdL + '>' + x.due + '</td>' +
          '<td ' + td + '>' + _r(x.opening) + '</td>' +
          '<td ' + td + '>' + _r(x.emi) + '</td>' +
          '<td ' + td + '>' + _r(x.prin) + '</td>' +
          '<td ' + td + '>' + _r(x.int) + '</td></tr>';
      }).join('');
      table = _band('Installment Schedule Detail') +
        '<table style="width:100%;border-collapse:collapse;font-size:11.5px;">' +
        '<thead><tr><th ' + thL + '>Instl. #</th><th ' + thL + '>Due Date</th><th ' + th + '>Opening Balance</th><th ' + th + '>Installment</th><th ' + th + '>Principal</th><th ' + th + '>Interest</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table>';
    }
    return head + detail + table;
  }

  function _content(l) {
    return '<div class="wl-cover">' + _cover(l) + '</div>' +
      '<div class="pgbreak" style="border-top:2px dashed #c8a02a;margin:26px 0;"></div>' +
      '<div class="wl-sched">' + _schedulePage(l) +
      '<div style="border-top:1px solid #c8a02a;margin-top:22px;padding-top:6px;text-align:center;font-size:10.5px;color:#555;font-style:italic;">This is a computer-generated document issued by ' + esc(_firm().name) + '.</div></div>';
  }

  function _printHTML(l) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc((l.name || 'Customer') + ' - Welcome Letter') + '</title>' +
      '<style>@page{size:A4;margin:16mm 14mm;} body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#141414;} .pgbreak{page-break-before:always;border:0 !important;margin:0 !important;} table{page-break-inside:auto;} tr{page-break-inside:avoid;}</style>' +
      '</head><body>' + _content(l) + '</body></html>';
  }

  window.openWelcomeLetter = function (id) {
    var l = loans.find(function (x) { return x.id === id; });
    if (!l) { toast('Loan not found'); return; }
    window._wlLoan = l;
    var ov = document.getElementById('wlOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'wlOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,12,26,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto;';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) window.closeWelcomeLetter(); });
    }
    ov.innerHTML =
      '<div style="background:#fff;max-width:840px;width:100%;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#0b1f4b;color:#fff;">' +
          '<div style="font-weight:700;">Welcome Letter &amp; Schedule — ' + esc(l.name || '') + '</div>' +
          '<div style="display:flex;gap:8px;">' +
            '<button onclick="printWelcomeLetter()" style="border:0;border-radius:8px;padding:7px 14px;background:#0b7a4b;color:#fff;font-weight:600;cursor:pointer;">🖶 Print / PDF</button>' +
            '<button onclick="waWelcomeLetter()" style="border:0;border-radius:8px;padding:7px 14px;background:#128C7E;color:#fff;font-weight:600;cursor:pointer;">WhatsApp</button>' +
            '<button onclick="closeWelcomeLetter()" style="border:0;border-radius:8px;padding:7px 12px;background:#334155;color:#fff;font-weight:600;cursor:pointer;">Close</button>' +
          '</div>' +
        '</div>' +
        '<div style="padding:22px 26px;max-height:80vh;overflow:auto;">' + _content(l) + '</div>' +
      '</div>';
    ov.style.display = 'flex';
    try { logAudit('Welcome Letter Opened', (l.name || '') + ' (' + (l.acno || '') + ')'); } catch (e) {}
  };

  window.closeWelcomeLetter = function () { var ov = document.getElementById('wlOverlay'); if (ov) ov.style.display = 'none'; };

  window.printWelcomeLetter = function () {
    var l = window._wlLoan; if (!l) return;
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(f);
    var doc = f.contentWindow.document; doc.open(); doc.write(_printHTML(l)); doc.close();
    var old = document.title;
    try { document.title = (l.name || 'Customer').replace(/[^\w -]/g, '') + '_Welcome_Letter'; } catch (e) {}
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {}
      setTimeout(function () { f.remove(); try { document.title = old; } catch (e) {} }, 1500);
    }, 350);
  };

  window.waWelcomeLetter = function () {
    var l = window._wlLoan; if (!l) return;
    var p = String(l.phone || '').replace(/\D/g, '');
    if (p.length === 10) p = '91' + p; else if (p.length === 11 && p[0] === '0') p = '91' + p.slice(1);
    if (!p) { toast('No phone number on file — open the loan to add one'); return; }
    var msg = 'Namaste ' + (l.name || '') + ', welcome to ' + _firm().name + '! Please find your Welcome Letter and repayment schedule for loan account ' + (l.acno || '') + ' attached.\n\n— ' + _firm().name;
    window.open('https://wa.me/' + p + '?text=' + encodeURIComponent(msg), '_blank');
    toast('WhatsApp opened — attach the saved PDF and send');
  };

  /* ---- Auto WhatsApp payment receipt (offered after a payment is recorded) ---- */
  window.offerPaymentReceiptWA = function (l, p) {
    if (!l || !p) return;
    var ph = String(l.phone || '').replace(/\D/g, '');
    if (ph.length === 10) ph = '91' + ph; else if (ph.length === 11 && ph[0] === '0') ph = '91' + ph.slice(1);
    if (!ph) return; // no number on file — nothing to offer
    if (!confirm('Send a WhatsApp payment receipt to ' + (l.name || 'the customer') + '?\n\nAmount: ' + _r(p.amount) + '   ·   Remaining: ' + _r(l.outstanding || 0))) return;
    var tpl = '';
    try { if (typeof TPL !== 'undefined' && TPL && TPL.thanks) tpl = TPL.thanks; } catch (e) {}
    if (!tpl) tpl = 'Namaste {name}, we have received your payment of {amount} towards loan account {acno}. Your remaining balance is {outstanding}. Thank you. - ' + _firm().name;
    var msg = tpl
      .replace(/\{name\}/g, l.name || '')
      .replace(/\{amount\}/g, _r(p.amount))
      .replace(/\{acno\}/g, l.acno || '')
      .replace(/\{outstanding\}/g, _r(l.outstanding || 0))
      .replace(/\{disbursed\}/g, _r(l.principal || 0))
      .replace(/\{emi\}/g, _r(l.emi || 0));
    window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(msg), '_blank');
    try { toast('WhatsApp receipt opened for ' + (l.name || '')); } catch (e) {}
  };
})();
