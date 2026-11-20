/* ===========================================================================
 * src/app/37-gst-invoice.js
 *
 * GST TAX INVOICES for the processing charge.
 *
 * Interest on a loan is exempt from GST; the processing charge withheld at
 * disbursement is a fee for a service and is taxable at 18% (SAC 997113). From
 * the effective date of registration every new loan with a processing charge
 * gets a tax invoice.
 *
 *   * Per loan, GST is either ADDED ON TOP of the processing charge (the
 *     default: 4% + 18% of it is kept back) or INCLUDED in it (the borrower
 *     sees no change; part of the 4% is GST).
 *   * GST changes only the CASH handed over. The loan amount, EMI, interest,
 *     total payable and outstanding are untouched — the same rule the 4%
 *     itself has always followed.
 *   * Numbers run SE/26-27/0001 … per financial year and are never reused.
 *   * An issued invoice is never edited. A change goes through a CREDIT NOTE
 *     (SE/CN/26-27/0001 …) and, where still chargeable, a fresh invoice.
 *   * Every invoice and credit note is also kept in a log on this device and
 *     in the backup, so a deleted loan never takes its tax record with it.
 *
 * Intra-state only (CGST 9% + SGST 9%): every borrower so far is in UP.
 * ======================================================================== */
(function () {
  var GSTLOG = 'shivam_gstlog_v1', GSTSEQ = 'shivam_gstseq_v1';

  function _r2(x) { return Math.round((Number(x) || 0) * 100) / 100; }
  function _iso(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function _today() { return (typeof todayISO === 'function') ? todayISO() : new Date().toISOString().slice(0, 10); }

  /* ---------- settings (from Firm Details) ---------- */
  function gstCfg() {
    var f = (typeof FIRM === 'function') ? FIRM() : {};
    var gstin = String(f.gstin || '').trim().toUpperCase();
    return {
      gstin: gstin,
      from: _iso(f.gstFrom) ? f.gstFrom : '',
      name: f.name || 'SHIVAM ENTERPRISES',
      addr: f.gstAddress || f.address || '',
      phone: String(f.phones || '').split(/[,/]/)[0].trim(),
      email: f.email || '',
      stateCode: gstin.slice(0, 2) || '09',
      stateName: 'Uttar Pradesh'
    };
  }
  function gstActive() { var c = gstCfg(); return !!(c.gstin && c.from); }

  /* ---------- arithmetic ---------- */
  function feeGstMode(l) { return (l && l.gstOnFee === 'incl') ? 'incl' : 'top'; }
  /* ON TOP: the charge is the taxable value; 9% + 9% is added; the total is
     rounded to the rupee (the round-off is shown, as the law allows).
     INCLUDED: the charge is the total; taxable value = total / 1.18; CGST and
     SGST are kept equal and the taxable value absorbs the last paisa. */
  function feeGstSplit(base, mode) {
    base = Math.max(0, Math.round(Number(base) || 0));
    if (!base) return { fee: 0, cgst: 0, sgst: 0, gst: 0, roundOff: 0, total: 0 };
    if (mode === 'incl') {
      var tx = _r2(base / 1.18), half = _r2((base - tx) / 2);
      return { fee: _r2(base - 2 * half), cgst: half, sgst: half, gst: _r2(2 * half), roundOff: 0, total: base };
    }
    var c = _r2(base * 0.09), gross = _r2(base + 2 * c), tot = Math.round(gross);
    return { fee: base, cgst: c, sgst: c, gst: _r2(2 * c), roundOff: _r2(tot - gross), total: tot };
  }
  function feeInvoiceQualifies(l) {
    var c = gstCfg();
    if (!l || !c.gstin || !c.from || l._test) return false;
    if (!(Math.round(Number(l.deductions) || 0) > 0)) return false;
    return _iso(l.disb) && l.disb >= c.from;
  }
  function feeActiveInvoice(l) { var v = l && l.feeInvoice; return (v && v.no && v.status !== 'cancelled') ? v : null; }
  /* What is kept back from the loan amount at disbursement. An issued
     invoice is what was actually charged, so it wins. */
  function feeWithheld(l) {
    var ded = Math.max(0, Math.round(Number(l && l.deductions) || 0));
    if (!ded) return 0;
    var inv = feeActiveInvoice(l);
    if (inv) return Number(inv.total) || ded;
    if (feeInvoiceQualifies(l)) return feeGstSplit(ded, feeGstMode(l)).total;
    return ded;
  }
  function feeNetDisbursed(l) { return Math.max(0, (Number(l && l.principal) || 0) - (Number(l && l.downpay) || 0) - feeWithheld(l)); }

  /* ---------- numbering ---------- */
  function gstFY(iso) { var y = +String(iso).slice(0, 4), m = +String(iso).slice(5, 7); var s = (m >= 4) ? y : y - 1; return String(s).slice(2) + '-' + String(s + 1).slice(2); }
  function gstSeries(kind, iso) { return 'SE/' + (kind === 'CN' ? 'CN/' : '') + gstFY(iso); }

  /* ---------- the durable log ---------- */
  function gstLogLoad() { try { var a = JSON.parse(localStorage.getItem(GSTLOG) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function gstLogSave(a) { try { localStorage.setItem(GSTLOG, JSON.stringify(a)); } catch (e) {} }
  function gstLogAdd(doc) {
    if (!doc || !doc.no) return;
    var a = gstLogLoad(), i = -1;
    for (var k = 0; k < a.length; k++) { if (a[k] && a[k].no === doc.no && a[k].loanId === doc.loanId) { i = k; break; } }
    if (i >= 0) a[i] = Object.assign({}, a[i], doc); else a.push(doc);
    gstLogSave(a);
  }
  /* Restoring a backup ADDS documents; it never drops one this device has. */
  function gstLogMerge(list) {
    if (!Array.isArray(list)) return 0;
    var a = gstLogLoad(), n = 0;
    list.forEach(function (d) {
      if (!d || !d.no) return;
      var j = -1;
      for (var k = 0; k < a.length; k++) { if (a[k] && a[k].no === d.no && a[k].loanId === d.loanId) { j = k; break; } }
      if (j < 0) { a.push(d); n++; }
      else if (d.status === 'cancelled' && a[j].status !== 'cancelled') { a[j] = Object.assign({}, a[j], d); n++; }
    });
    if (n) gstLogSave(a);
    return n;
  }

  function _party(l) {
    return { name: l.name || '', reltype: l.reltype || '', relname: l.relname || '', addr: l.addr || '', acno: l.acno || '',
             principal: Number(l.principal) || 0, disb: l.disb || '', tenure: Number(l.tenure) || 0, interestOnly: !!l.interestOnly, type: l.type || '' };
  }
  function _invDoc(l, v) {
    return { kind: 'INV', no: v.no, date: v.date, loanId: l.id, acno: (v.party && v.party.acno) || l.acno || '', name: (v.party && v.party.name) || l.name || '',
             base: v.base, mode: v.mode, fee: v.fee, cgst: v.cgst, sgst: v.sgst, roundOff: v.roundOff, total: v.total,
             status: v.status || 'issued', party: v.party || _party(l), gstin: v.gstin, cn: v.creditNote ? v.creditNote.no : '' };
  }
  function _cnDoc(l, v) {
    var cn = v.creditNote;
    return { kind: 'CN', no: cn.no, date: cn.date, loanId: l.id, acno: (v.party && v.party.acno) || l.acno || '', name: (v.party && v.party.name) || l.name || '',
             base: v.base, mode: v.mode, fee: v.fee, cgst: v.cgst, sgst: v.sgst, roundOff: v.roundOff, total: v.total,
             status: 'issued', party: v.party || _party(l), gstin: v.gstin, against: v.no, againstDate: v.date, reason: cn.reason || '' };
  }

  /* Every invoice and credit note this device can see: its own log, plus
     whatever is carried on loans (live or in the Recycle Bin) — which is how an
     invoice issued on the other device reaches this one. A number found on
     two DIFFERENT loans is a duplicate (two devices issued it at once). */
  function gstAllDocs() {
    var map = {}, dups = {};
    var put = function (d) {
      if (!d || !d.no) return;
      var e = map[d.no];
      if (e && e.loanId !== d.loanId) { (dups[d.no] = dups[d.no] || [e]).push(d); return; }
      map[d.no] = Object.assign({}, e || {}, d);
    };
    gstLogLoad().forEach(put);
    var src = [].concat((typeof loans !== 'undefined' && Array.isArray(loans)) ? loans : [],
                        (typeof recycleLoad === 'function') ? recycleLoad() : []);
    src.forEach(function (l) {
      if (!l) return;
      [].concat(l.feeInvoice ? [l.feeInvoice] : [], Array.isArray(l.feeInvoiceHistory) ? l.feeInvoiceHistory : []).forEach(function (v) {
        if (!v || !v.no) return;
        put(_invDoc(l, v));
        if (v.creditNote && v.creditNote.no) put(_cnDoc(l, v));
      });
    });
    var docs = Object.keys(map).map(function (k) { return map[k]; });
    docs.dups = Object.keys(dups).map(function (k) { return { no: k, docs: dups[k] }; });
    return docs;
  }

  function gstNextNo(kind, iso) {
    var key = gstSeries(kind, iso), max = 0;
    gstAllDocs().forEach(function (d) {
      if (d && typeof d.no === 'string' && d.no.indexOf(key + '/') === 0) { var n = parseInt(d.no.slice(key.length + 1), 10); if (n > max) max = n; }
    });
    var seq = {}; try { seq = JSON.parse(localStorage.getItem(GSTSEQ) || '{}') || {}; } catch (e) {}
    if ((Number(seq[key]) || 0) > max) max = Number(seq[key]);   // never reuse a number, even one whose loan is gone
    var next = max + 1; seq[key] = next;
    try { localStorage.setItem(GSTSEQ, JSON.stringify(seq)); } catch (e) {}
    return key + '/' + String(next).padStart(4, '0');
  }

  /* ---------- issue and cancel ---------- */
  function _by() { try { return (typeof currentUser !== 'undefined' && currentUser && (currentUser.name || currentUser.user)) || ''; } catch (e) { return ''; } }
  function gstIssue(l) {
    if (!feeInvoiceQualifies(l) || feeActiveInvoice(l)) return null;
    var c = gstCfg(), mode = feeGstMode(l), sp = feeGstSplit(l.deductions, mode);
    var inv = { no: gstNextNo('INV', l.disb), date: l.disb, base: Math.round(Number(l.deductions) || 0), mode: mode,
                fee: sp.fee, cgst: sp.cgst, sgst: sp.sgst, roundOff: sp.roundOff, total: sp.total,
                gstin: c.gstin, status: 'issued', at: Date.now(), by: _by(), party: _party(l) };
    l.feeInvoice = inv;
    gstLogAdd(_invDoc(l, inv));
    try { logAudit('Tax Invoice Issued', inv.no + ' — ' + (l.name || '') + ' (' + (l.acno || '') + ') ' + inr(inv.total)); } catch (e) {}
    return inv;
  }
  function gstCancel(l, reason) {
    var inv = feeActiveInvoice(l); if (!inv) return null;
    var today = _today();
    inv.status = 'cancelled';
    inv.creditNote = { no: gstNextNo('CN', today), date: today, reason: String(reason || 'Cancelled'), at: Date.now(), by: _by() };
    l.feeInvoiceHistory = (Array.isArray(l.feeInvoiceHistory) ? l.feeInvoiceHistory : []).concat([inv]);
    delete l.feeInvoice;
    gstLogAdd(_invDoc(l, inv)); gstLogAdd(_cnDoc(l, inv));
    try { logAudit('Credit Note Issued', inv.creditNote.no + ' against ' + inv.no + ' — ' + (l.name || '') + ' (' + (l.acno || '') + '): ' + inv.creditNote.reason); } catch (e) {}
    return inv.creditNote;
  }

  /* Called by the loan form on Save, after the record is built.
     Returns a short line for the "saved" toast, or ''. */
  function gstOnLoanSave(rec) {
    if (!rec) return '';
    var inv = feeActiveInvoice(rec), q = feeInvoiceQualifies(rec);
    if (inv) {
      var mode = feeGstMode(rec), base = Math.round(Number(rec.deductions) || 0);
      if (q && base === inv.base && mode === inv.mode) return '';
      var now = q ? feeGstSplit(base, mode).total : 0;
      var why = q ? ('Tax invoice ' + inv.no + ' was issued for ' + inr(inv.total) + '. With the change just made, the processing charge comes to ' + inr(now) + '.')
                  : ('Tax invoice ' + inv.no + ' (' + inr(inv.total) + ') was issued for this loan, which no longer has a taxable processing charge.');
      if (confirm(why + '\n\nAn issued invoice cannot be edited.\n\nOK = cancel it with a credit note' + (q ? ' and issue a new invoice' : '') + '\nCancel = keep the invoice exactly as issued')) {
        gstCancel(rec, q ? 'Processing charge amended' : 'No longer chargeable');
        if (q) { var n = gstIssue(rec); return n ? ('Invoice ' + inv.no + ' cancelled, ' + n.no + ' issued') : ('Invoice ' + inv.no + ' cancelled'); }
        return 'Invoice ' + inv.no + ' cancelled by credit note';
      }
      return '';
    }
    if (q) { var n2 = gstIssue(rec); return n2 ? ('Tax invoice ' + n2.no + ' issued') : ''; }
    return '';
  }
  /* Called before a loan goes to the Recycle Bin. false = stop the delete. */
  function gstOnLoanDelete(l) {
    var inv = feeActiveInvoice(l); if (!inv) return true;
    var r = confirm('This loan has tax invoice ' + inv.no + ' (' + inr(inv.total) + ').\n\n'
      + 'OK = cancel the invoice with a credit note (the loan was entered by mistake / never disbursed)\n'
      + 'Cancel = keep the invoice — GST on it is still due');
    if (r) gstCancel(l, 'Loan record deleted');
    return true;
  }

  /* ---------- the printed document ---------- */
  function _m(n) { return (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function _d(iso) { return (typeof fmtDate === 'function' && iso) ? fmtDate(iso).replace(/-(\d\d)$/, '-20$1') : (iso || ''); }
  function _words(n) {
    var r = Math.round(Number(n) || 0);
    var w = (typeof inrWords === 'function') ? inrWords(r) : String(r);
    w = String(w || '').replace(/\s*Only\s*$/i, '');
    return 'Rupees ' + w + ' Only';
  }
  function _e(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s); }
  function gstDocHTML(doc) {
    var c = gstCfg(), p = doc.party || {}, isCN = doc.kind === 'CN';
    var row = function (lbl, val, bold) { return '<tr><td></td><td class="r" colspan="2"' + (bold ? ' style="font-weight:700"' : '') + '>' + lbl + '</td><td class="r"' + (bold ? ' style="font-weight:700"' : '') + '>' + val + '</td></tr>'; };
    var so = p.relname ? ((p.reltype || 's/o').replace(/^./, function (x) { return x.toUpperCase(); }) + ' ' + p.relname) : '';
    var lessGst = (doc.mode === 'incl') ? 'Less: processing charges (GST included)' : 'Less: processing charges incl. GST (this invoice)';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + _e(doc.no.replace(/\//g, '-')) + '</title><style>'
      + '@page{size:A4;margin:14mm}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141414;margin:0;font-size:13px;line-height:1.5;font-variant-numeric:lining-nums tabular-nums}'
      + '.wrap{max-width:720px;margin:0 auto;padding:6px}.hd{display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid #0b1f4b;padding-bottom:10px}'
      + '.fn{font-family:Georgia,"Times New Roman",serif;font-size:22px;font-weight:700;letter-spacing:.6px;color:#0b1f4b}.mut{color:#555;font-size:12px;line-height:1.55}'
      + '.ttl{font-size:17px;font-weight:700;color:#0b1f4b;text-align:right}.meta{font-size:12px;color:#555;text-align:right;line-height:1.7;white-space:nowrap}.meta b{color:#141414;font-weight:600}'
      + '.two{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:10px 0;border-bottom:1px solid #ccc}.lb{font-size:11.5px;color:#666}'
      + 'table{width:100%;border-collapse:collapse;margin-top:10px;table-layout:fixed}th{font-size:11.5px;font-weight:600;color:#555;text-align:left;border-bottom:1px solid #888;padding:6px}'
      + 'td{padding:6px;border-bottom:1px solid #ddd;vertical-align:top}.r{text-align:right}.box{background:#f5f2e8;border:1px solid #e3d9b8;padding:9px 11px;margin-top:12px}'
      + '.ln{display:flex;justify-content:space-between}.sig{text-align:right;margin-top:26px;font-size:12px}.sig div{border-top:1px solid #333;display:inline-block;padding-top:4px;min-width:200px;text-align:center}'
      + '.cn{border:1px solid #c0392b;color:#7b1d12;padding:7px 10px;margin-top:10px;font-size:12px}'
      + '</style></head><body><div class="wrap">'
      + '<div class="hd"><div><div class="fn">' + _e(c.name) + '</div>'
      + '<div class="mut">' + _e(c.addr) + '<br>' + (c.phone ? ('Mob. ' + _e(c.phone)) : '') + (c.email ? (' · ' + _e(c.email)) : '') + '</div>'
      + '<div style="margin-top:4px"><span class="lb">GSTIN</span> <b>' + _e(doc.gstin || c.gstin) + '</b></div></div>'
      + '<div><div class="ttl">' + (isCN ? 'Credit note' : 'Tax invoice') + '</div><div class="meta">'
      + (isCN ? 'Credit note no.' : 'Invoice no.') + ' <b>' + _e(doc.no) + '</b><br>Date <b>' + _e(_d(doc.date)) + '</b><br>'
      + (isCN ? ('Against invoice <b>' + _e(doc.against) + '</b><br>dated <b>' + _e(_d(doc.againstDate)) + '</b><br>') : '')
      + 'Place of supply <b>' + _e(c.stateName) + ' (' + _e(c.stateCode) + ')</b><br>Reverse charge <b>No</b></div></div></div>'
      + '<div class="two"><div><div class="lb">' + (isCN ? 'Issued to' : 'Billed to') + '</div><div style="line-height:1.55"><b>' + _e(p.name) + '</b>' + (so ? ('<br>' + _e(so)) : '') + (p.addr ? ('<br>' + _e(p.addr)) : '') + '<br><span class="lb">GSTIN</span> Unregistered</div></div>'
      + '<div><div class="lb">Loan</div><div style="line-height:1.55">A/C <b>' + _e(p.acno) + '</b><br>Amount sanctioned ₹' + _m(p.principal) + (p.disb ? ('<br>Disbursed ' + _e(_d(p.disb))) : '')
      + (p.interestOnly ? '<br>Interest-only loan' : (p.tenure ? ('<br>' + _e(p.type || 'Loan') + ' · ' + p.tenure + ' months') : '')) + '</div></div></div>'
      + '<table><colgroup><col style="width:34px"><col><col style="width:74px"><col style="width:130px"></colgroup>'
      + '<tr><th>#</th><th>Description</th><th>SAC</th><th class="r">Amount (₹)</th></tr>'
      + '<tr><td>1</td><td>Loan processing charges' + (isCN ? ' — reversed' : '') + '<div class="lb">' + (doc.mode === 'incl' ? ('Processing charge of ₹' + _m(doc.base) + ', GST included') : ('Processing charge on loan amount ₹' + _m(p.principal))) + '</div></td><td>997113</td><td class="r">' + _m(doc.fee) + '</td></tr>'
      + row('Taxable value', _m(doc.fee)) + row('CGST @ 9%', _m(doc.cgst)) + row('SGST @ 9%', _m(doc.sgst))
      + (Math.abs(Number(doc.roundOff) || 0) >= 0.005 ? row('Round off', _m(doc.roundOff)) : '')
      + row(isCN ? 'Credit note total' : 'Invoice total', _m(doc.total), true) + '</table>'
      + '<div class="mut" style="margin:8px 0 0">Amount in words: <span style="color:#141414">' + _e(_words(doc.total)) + '</span></div>'
      + (isCN
        ? ('<div class="cn">This credit note cancels tax invoice ' + _e(doc.against) + ' in full. Reason: ' + _e(doc.reason || '—') + '</div>')
        : ('<div class="box"><div style="font-weight:700;margin-bottom:4px">Disbursement summary</div>'
          + '<div class="ln"><span>Loan amount sanctioned</span><span>₹' + _m(p.principal) + '</span></div>'
          + '<div class="ln"><span>' + lessGst + '</span><span>− ₹' + _m(doc.total) + '</span></div>'
          + '<div class="ln" style="border-top:1px solid #bfb38a;margin-top:4px;padding-top:4px;font-weight:700"><span>Net amount paid to borrower</span><span>₹' + _m(Math.max(0, p.principal - doc.total)) + '</span></div>'
          + '<div class="lb" style="margin-top:4px">Processing charges collected by deduction at disbursement</div></div>'))
      + '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px"><div class="lb">This is a computer-generated ' + (isCN ? 'credit note' : 'invoice') + '.</div>'
      + '<div class="sig"><div>For ' + _e(c.name) + '<br><span class="lb">Authorised signatory</span></div></div></div>'
      + '</div></body></html>';
  }
  function gstFindDoc(no, loanId) {
    var all = gstAllDocs();
    return all.find(function (d) { return d.no === no && (!loanId || d.loanId === loanId); }) || all.find(function (d) { return d.no === no; }) || null;
  }
  function gstOpenDoc(no, loanId) {
    var doc = gstFindDoc(no, loanId);
    if (!doc) { if (typeof toast === 'function') toast('Invoice ' + no + ' not found'); return; }
    var ov = document.getElementById('gstOverlay');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'gstOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,12,26,.6);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto;';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) gstCloseDoc(); });
    }
    ov.innerHTML = '<div style="background:#fff;max-width:860px;width:100%;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.4);overflow:hidden;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0b1f4b;color:#fff;">'
      + '<b>' + _e((doc.kind === 'CN' ? 'Credit note ' : 'Tax invoice ') + doc.no) + '</b><div style="display:flex;gap:8px;">'
      + '<button onclick="gstPrintDoc()" style="border:0;border-radius:8px;padding:7px 14px;background:#c8a02a;color:#0b1f4b;font-weight:600;cursor:pointer;">Print / Save PDF</button>'
      + '<button onclick="gstCloseDoc()" style="border:0;border-radius:8px;padding:7px 12px;background:#334155;color:#fff;font-weight:600;cursor:pointer;">Close</button></div></div>'
      + '<div style="padding:10px 12px;"><iframe id="gstFrame" style="width:100%;height:78vh;border:1px solid #e2e8f0;border-radius:6px;background:#fff;"></iframe></div></div>';
    ov.style.display = 'flex';
    var fr = document.getElementById('gstFrame');
    try { fr.srcdoc = gstDocHTML(doc); } catch (e) {}
  }
  function gstPrintDoc() { var fr = document.getElementById('gstFrame'); if (!fr) return; try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} }
  function gstCloseDoc() { var ov = document.getElementById('gstOverlay'); if (ov) ov.style.display = 'none'; }

  /* ---------- issue from the register (a loan saved before this version) ---------- */
  function gstIssueFor(id) {
    var l = (typeof loans !== 'undefined' && Array.isArray(loans)) ? loans.find(function (x) { return x && x.id === id; }) : null;
    if (!l) { toast('Loan not found'); return; }
    if (!feeInvoiceQualifies(l)) { toast('This loan does not need a tax invoice'); return; }
    var sp = feeGstSplit(l.deductions, feeGstMode(l));
    if (!confirm('Issue a tax invoice for ' + (l.name || '') + ' (' + (l.acno || '') + ')?\n\n'
      + 'Processing charge ₹' + _m(sp.fee) + ' + GST ₹' + _m(sp.gst) + (sp.roundOff ? (' (round off ' + _m(sp.roundOff) + ')') : '') + ' = ₹' + _m(sp.total) + '\n'
      + (feeGstMode(l) === 'incl' ? 'GST is INCLUDED in the processing charge.' : 'GST is ADDED ON TOP of the processing charge.') + '\n\nDated ' + _d(l.disb) + ' (the disbursement date).')) return;
    var inv = gstIssue(l);
    if (!inv) return;
    try { save(); } catch (e) {}
    toast('Tax invoice ' + inv.no + ' issued');
    try { if (typeof repGstFill === 'function') repGstFill(); } catch (e) {}
  }

  /* ---------- the register (Reports → GST Invoices) ---------- */
  var _gstMonth = null;
  function repGst() {
    if (!_gstMonth) _gstMonth = _today().slice(0, 7);
    $('repBody').innerHTML = '<div class="panel"><div class="panel-head"><div class="t"><h3>GST Invoices</h3>'
      + '<p>Tax invoices and credit notes for the processing charge, month by month — the figures for GSTR-1 and GSTR-3B.</p></div>'
      + '<div class="actions"><input type="month" id="gstMonth" value="' + _gstMonth + '" onchange="repGstMonth(this.value)" style="padding:6px 8px;">'
      + '<button class="btn" onclick="repGstCSV()">Export CSV</button><button class="btn btn-primary" onclick="repGstPrint()">Print</button></div></div>'
      + '<div id="gstBody"></div></div>';
    repGstFill();
  }
  function repGstMonth(v) { _gstMonth = v || _today().slice(0, 7); repGstFill(); }
  function repGstData() {
    var all = gstAllDocs(), ym = _gstMonth || _today().slice(0, 7);
    var docs = all.filter(function (d) { return String(d.date || '').slice(0, 7) === ym; })
      .sort(function (a, b) { return (String(a.date) + a.no).localeCompare(String(b.date) + b.no); });
    var sign = function (d) { return d.kind === 'CN' ? -1 : 1; };
    var t = { fee: 0, cgst: 0, sgst: 0, roundOff: 0, total: 0, nInv: 0, nCn: 0 };
    docs.forEach(function (d) { var s = sign(d); t.fee += s * (+d.fee || 0); t.cgst += s * (+d.cgst || 0); t.sgst += s * (+d.sgst || 0); t.roundOff += s * (+d.roundOff || 0); t.total += s * (+d.total || 0); if (d.kind === 'CN') t.nCn++; else t.nInv++; });
    Object.keys(t).forEach(function (k) { t[k] = _r2(t[k]); });
    var missing = ((typeof loans !== 'undefined' && Array.isArray(loans)) ? loans : [])
      .filter(function (l) { return l && feeInvoiceQualifies(l) && !feeActiveInvoice(l); });
    return { ym: ym, docs: docs, t: t, missing: missing, dups: all.dups || [] };
  }
  function repGstFill() {
    var host = $('gstBody'); if (!host) return;
    var c = gstCfg(), D = repGstData(), h = '';
    if (!c.gstin || !c.from) {
      host.innerHTML = '<p class="muted" style="padding:10px 2px;">Add your GSTIN and the date GST invoices start from in <b>Administration → Firm Details</b>.</p>'; return;
    }
    if (D.dups.length) h += '<div class="bk-card" style="border-color:#e5484d;color:#7b1d12;margin-bottom:10px;">⚠ The same number was issued twice — usually two devices saving loans at the same moment: <b>'
      + D.dups.map(function (x) { return _e(x.no) + ' (' + x.docs.map(function (d) { return _e(d.acno || d.name); }).join(', ') + ')'; }).join('; ')
      + '</b>. Cancel one of them with a credit note (edit that loan) so it is reissued under a fresh number.</div>';
    if (D.missing.length) h += '<div class="bk-card" style="margin-bottom:10px;"><b>Loans that need a tax invoice</b> <span class="muted">(disbursed on or after ' + _e(_d(c.from)) + ' with a processing charge)</span>'
      + D.missing.map(function (l) { var sp = feeGstSplit(l.deductions, feeGstMode(l)); return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--line);"><span>' + _e(l.name) + ' <span class="muted">· ' + _e(l.acno || '') + ' · ' + _e(_d(l.disb)) + ' · ₹' + _m(sp.total) + '</span></span><button class="btn btn-sm btn-primary" onclick="gstIssueFor(\'' + l.id + '\')">Issue invoice</button></div>'; }).join('')
      + '</div>';
    h += '<div class="ptiles" style="margin-bottom:10px;">'
      + repTile('Invoices', String(D.t.nInv)) + (D.t.nCn ? repTile('Credit notes', String(D.t.nCn)) : '')
      + repTile('Taxable value', '₹' + _m(D.t.fee)) + repTile('CGST', '₹' + _m(D.t.cgst)) + repTile('SGST', '₹' + _m(D.t.sgst)) + repTile('GST payable', '₹' + _m(D.t.cgst + D.t.sgst), 'bad') + '</div>';
    h += '<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Number</th><th>Borrower</th><th>A/C</th><th class="right">Taxable</th><th class="right">CGST</th><th class="right">SGST</th><th class="right">Total</th><th></th></tr></thead><tbody>'
      + (D.docs.length ? D.docs.map(function (d) {
        var s = d.kind === 'CN' ? '− ' : '';
        var tag = d.kind === 'CN' ? ' <span class="badge overdue">credit note</span>' : (d.status === 'cancelled' ? ' <span class="badge closed">cancelled' + (d.cn ? (' by ' + _e(d.cn)) : '') + '</span>' : '');
        return '<tr><td>' + _e(_d(d.date)) + '</td><td>' + _e(d.no) + tag + '</td><td class="name">' + _e(d.name) + '</td><td>' + _e(d.acno) + '</td>'
          + '<td class="right num">' + s + _m(d.fee) + '</td><td class="right num">' + s + _m(d.cgst) + '</td><td class="right num">' + s + _m(d.sgst) + '</td><td class="right num">' + s + _m(d.total) + '</td>'
          + '<td><button class="lnk" onclick="gstOpenDoc(\'' + _e(d.no) + '\',\'' + _e(d.loanId) + '\')">view</button></td></tr>';
      }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--grey);padding:18px;">No invoices or credit notes in this month.</td></tr>')
      + '</tbody></table></div>'
      + '<p class="muted" style="font-size:11.5px;margin-top:8px;">A cancelled invoice stays in the month it was issued; its credit note is counted in the month the credit note is dated, as negative figures. GST payable is CGST + SGST net of credit notes.</p>';
    host.innerHTML = h;
  }
  function repGstCSV() {
    var D = repGstData();
    var rows = D.docs.map(function (d) { var s = d.kind === 'CN' ? -1 : 1; return [_d(d.date), d.kind === 'CN' ? 'Credit note' : 'Invoice', d.no, d.against || '', d.name, d.acno, 'Unregistered', '997113', (s * d.fee).toFixed(2), '18', (s * d.cgst).toFixed(2), (s * d.sgst).toFixed(2), (s * (d.roundOff || 0)).toFixed(2), (s * d.total).toFixed(2), d.status === 'cancelled' ? 'cancelled' : '']; });
    repCSV('GST_Invoices_' + D.ym + '.csv', ['Date', 'Type', 'Number', 'Against invoice', 'Borrower', 'A/C', 'Recipient GSTIN', 'SAC', 'Taxable value', 'GST rate %', 'CGST', 'SGST', 'Round off', 'Total', 'Status'], rows);
  }
  function repGstPrint() {
    var D = repGstData();
    var t = '<table><thead><tr><th>Date</th><th>Number</th><th>Borrower</th><th>A/C</th><th class="r">Taxable</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Total</th></tr></thead><tbody>'
      + (D.docs.length ? D.docs.map(function (d) { var s = d.kind === 'CN' ? '− ' : ''; return '<tr><td>' + _e(_d(d.date)) + '</td><td>' + _e(d.no) + (d.kind === 'CN' ? ' (credit note)' : (d.status === 'cancelled' ? ' (cancelled)' : '')) + '</td><td>' + _e(d.name) + '</td><td>' + _e(d.acno) + '</td><td class="r">' + s + _m(d.fee) + '</td><td class="r">' + s + _m(d.cgst) + '</td><td class="r">' + s + _m(d.sgst) + '</td><td class="r">' + s + _m(d.total) + '</td></tr>'; }).join('')
        : '<tr><td colspan="8" style="text-align:center;">No invoices or credit notes in this month.</td></tr>')
      + '<tr class="tot"><td colspan="4" class="r">Net for the month</td><td class="r">' + _m(D.t.fee) + '</td><td class="r">' + _m(D.t.cgst) + '</td><td class="r">' + _m(D.t.sgst) + '</td><td class="r">' + _m(D.t.total) + '</td></tr></tbody></table>';
    printReport('GST Invoice Register', 'Processing charges — SAC 997113', [['Month', D.ym], ['GSTIN', gstCfg().gstin], ['GST payable', '₹' + _m(D.t.cgst + D.t.sgst)]], t, 'GST_Invoices_' + D.ym);
  }

  /* ---------- loan form helpers ---------- */
  /* One quiet line under the GST selector: what the GST is and what is kept
     back, plus a link to an invoice already issued. */
  function gstFormHint(probe, existing) {
    if (!gstActive()) return '';
    var c = gstCfg(), ded = Math.round(Number(probe.deductions) || 0);
    if (!ded) return '';
    if (!_iso(probe.disb)) return 'GST applies to loans disbursed on or after ' + _d(c.from) + '.';
    if (probe.disb < c.from) return 'No GST — disbursed before ' + _d(c.from) + '.';
    var sp = feeGstSplit(ded, feeGstMode(probe)), s;
    if (feeGstMode(probe) === 'incl') s = 'Fee ₹' + _m(sp.fee) + ' + GST ₹' + _m(sp.gst) + ' inside ₹' + _m(sp.total) + '.';
    else s = 'GST ₹' + _m(sp.gst) + ' (CGST ' + _m(sp.cgst) + ' + SGST ' + _m(sp.sgst) + ')' + (sp.roundOff ? (', round off ' + _m(sp.roundOff)) : '') + ' — kept back ₹' + _m(sp.total) + '.';
    var inv = feeActiveInvoice(existing);
    if (inv) s += ' <button type="button" class="lnk" onclick="gstOpenDoc(\'' + _e(inv.no) + '\',\'' + _e(existing.id) + '\')">Tax invoice ' + _e(inv.no) + '</button>';
    else s += ' A tax invoice is issued when you save.';
    return s;
  }

  window.gstCfg = gstCfg; window.gstActive = gstActive;
  window.feeGstMode = feeGstMode; window.feeGstSplit = feeGstSplit; window.feeInvoiceQualifies = feeInvoiceQualifies;
  window.feeActiveInvoice = feeActiveInvoice; window.feeWithheld = feeWithheld; window.feeNetDisbursed = feeNetDisbursed;
  window.gstFY = gstFY; window.gstNextNo = gstNextNo; window.gstAllDocs = gstAllDocs;
  window.gstLogLoad = gstLogLoad; window.gstLogMerge = gstLogMerge;
  window.gstIssue = gstIssue; window.gstCancel = gstCancel; window.gstOnLoanSave = gstOnLoanSave; window.gstOnLoanDelete = gstOnLoanDelete;
  window.gstDocHTML = gstDocHTML; window.gstOpenDoc = gstOpenDoc; window.gstPrintDoc = gstPrintDoc; window.gstCloseDoc = gstCloseDoc;
  window.gstIssueFor = gstIssueFor; window.gstFormHint = gstFormHint;
  window.repGst = repGst; window.repGstMonth = repGstMonth; window.repGstFill = repGstFill; window.repGstCSV = repGstCSV; window.repGstPrint = repGstPrint;
})();
