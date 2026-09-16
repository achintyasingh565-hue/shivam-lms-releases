/* ===========================================================================
 * src/app/28-loan-file.js
 *
 * LOAN FILE — the full printable loan booklet (Cover, Proposal Form, Loan
 * Agreement, Security & Declaration Letter + Promissory Note) in the firm's
 * serif theme with the framed cover. Auto-fills every detail it can from the
 * selected loan record (name, s/o, address, SE- account no., amounts, EMI,
 * dates, guarantor, security); anything not on record prints as a line to fill
 * in by hand. Print / Save-as-PDF.
 *
 * Public: window.openLoanFile(loanId)
 * ======================================================================== */
(function () {
  function _r(n) { n = Number(n) || 0; return n ? n.toLocaleString('en-IN') : ''; }
  function _d(iso) { try { return (typeof fmtDate === 'function' && fmtDate(iso)) ? fmtDate(iso) : (iso || ''); } catch (e) { return iso || ''; } }
  function _addM(iso, n) { try { return (typeof repAddMonths === 'function') ? repAddMonths(iso, n) : iso; } catch (e) { return iso; } }
  function _so(l) { var t = (l.reltype || 's/o'); return l.relname ? (t + ' ' + l.relname) : ''; }
  function _aadhaar(l) {
    try { if (Array.isArray(l.ids)) { var a = l.ids.find(function (x) { return /aadhaar/i.test(x.t || x.type || ''); }); if (a) return a.n || a.number || ''; } } catch (e) {}
    return l.idproof || '';
  }
  // filled value (underlined) when we have data, else a blank line to write on
  function fv(val, cls) { val = (val == null ? '' : String(val)).trim(); return val ? ('<span class="fv">' + esc(val) + '</span>') : ('<span class="b ' + (cls || '') + '"></span>'); }

  function _css() {
    return ':root{--navy:#0b1f4b;--gold:#c8a02a;--ink:#1a1a1a;}*{box-sizing:border-box;margin:0;padding:0;}'
      + '@page{size:A4;margin:0;}body{font-family:Georgia,"Times New Roman",serif;color:var(--ink);font-size:12.5px;line-height:1.42;}'
      + '.sheet{position:relative;overflow:visible;padding:11mm 14mm;page-break-before:always;}.sheet:first-child{page-break-before:avoid;}.cover-sheet{padding:0;min-height:296mm;height:296mm;overflow:hidden;}'
      + '.sheet:last-child{page-break-after:avoid;}'
      + '.cv-frame{position:absolute;top:6mm;left:6mm;right:6mm;bottom:6mm;border:2.5px solid var(--navy);}'
      + '.cv-frame::after{content:"";position:absolute;top:4px;left:4px;right:4px;bottom:4px;border:1px solid var(--gold);}'
      + '.cv-corner{position:absolute;width:17mm;height:17mm;z-index:3;}'
      + '.cv-tl{top:6mm;left:6mm;}.cv-tr{top:6mm;right:6mm;transform:rotate(90deg);}.cv-br{bottom:6mm;right:6mm;transform:rotate(180deg);}.cv-bl{bottom:6mm;left:6mm;transform:rotate(270deg);}'
      + '.cv-content{position:absolute;top:6mm;left:6mm;right:6mm;bottom:6mm;display:flex;flex-direction:column;align-items:center;padding:18mm;text-align:center;}'
      + '.cv-om{font-size:12px;color:#777;letter-spacing:1px;margin-top:6mm;}'
      + '.cv-firm{font-family:Georgia,serif;font-size:29px;font-weight:bold;color:var(--navy);letter-spacing:2px;margin-top:10px;}'
      + '.cv-addr{font-size:10.5px;color:#555;margin-top:9px;line-height:1.55;font-family:Arial,sans-serif;}'
      + '.cv-divide{width:55%;margin:16px auto 4px;border:none;border-top:1.5px solid var(--gold);}'
      + '.cv-title{font-family:Georgia,serif;font-size:26px;font-weight:bold;letter-spacing:8px;color:var(--navy);margin-top:12px;}'
      + '.cv-box{width:100%;max-width:155mm;margin:auto 0 8mm;border:1px solid #c9d2e0;border-radius:7px;padding:16px 22px;text-align:left;background:#fcfdff;}'
      + '.cv-box .line{margin:13px 0;font-size:12.5px;}.cv-box .line b{color:var(--navy);}'
      + '.om{text-align:center;font-size:13.5px;letter-spacing:1px;color:#666;}'
      + '.firm{text-align:center;font-size:27px;font-weight:bold;color:var(--navy);}'
      + '.addr{text-align:center;font-size:12px;color:#444;margin-top:3px;font-family:Arial,sans-serif;}'
      + '.rule{border-bottom:2px solid var(--gold);margin:6px 0 10px;}'
      + '.doctitle{text-align:center;font-size:19px;font-weight:bold;color:var(--navy);text-decoration:underline;letter-spacing:.5px;margin:6px 0 4px;}'
      + '.docsub{text-align:center;font-size:12.5px;font-style:italic;color:#555;margin-bottom:8px;}'
      + 'p.cl{margin:6px 0;text-align:justify;}'
      + '.b{display:inline-block;border-bottom:1px dotted #444;min-width:110px;height:15px;vertical-align:baseline;}'
      + '.bl{min-width:210px;}.bxl{min-width:330px;}.bw{min-width:165px;}.bfull{display:block;border-bottom:1px dotted #444;height:17px;margin-top:2px;}'
      + '.fv{border-bottom:1px solid #333;padding:0 5px;font-weight:600;color:#111;font-family:Arial,sans-serif;}'
      + '.sec-h{font-weight:bold;color:var(--navy);margin-top:8px;letter-spacing:.5px;}'
      + '.row{display:flex;gap:18px;flex-wrap:wrap;margin:5px 0;}.row>div{flex:1;min-width:180px;}'
      + 'table.kv{width:100%;border-collapse:collapse;margin-top:6px;}table.kv td{padding:5px 4px;vertical-align:top;}'
      + '.sig-line{border-top:1px solid #333;margin-top:16px;padding-top:4px;}'
      + '.note{font-size:12.5px;font-style:italic;color:#333;margin-top:10px;border:1px solid #ddd;background:#fafafa;padding:8px 10px;}'
      + '.photo{float:right;width:30mm;height:38mm;border:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:10px;color:#888;text-align:center;margin-left:12px;}'
      + 'ol.clauses{margin:5px 0 0 18px;}ol.clauses li{margin:3px 0;text-align:justify;page-break-inside:avoid;}'
      + '.sig-row,table.kv,.note{page-break-inside:avoid;}';
  }

  function _corner(cls) {
    return '<svg class="cv-corner ' + cls + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 100,0 0,100" fill="#0b1f4b" opacity="0.10"/><polygon points="0,0 64,0 0,64" fill="#c8a02a" opacity="0.30"/><polygon points="0,0 30,0 0,30" fill="#0b1f4b"/></svg>';
  }
  var OM = '|| ॐ नमः शिवाय ||';

  function _html(l) {
    var untilD = (l.tenure && (l.due || l.disb)) ? _addM(l.due || _addM(l.disb, 1), (Number(l.tenure) || 1) - 1) : '';
    var nameAddr = (l.name || '') + (l.relname ? (' ' + (l.reltype || 's/o') + ' ' + l.relname) : '') + (l.addr ? (', ' + l.addr) : '');
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc((l.name || 'Loan') + ' - Loan File') + '</title><style>' + _css() + '</style></head><body>'

      /* ---- Page 1: Cover ---- */
      + '<section class="sheet cover-sheet">'
      + '<div class="cv-frame"></div>' + _corner('cv-tl') + _corner('cv-tr') + _corner('cv-br') + _corner('cv-bl')
      + '<div class="cv-content">'
      + '<div class="cv-om">' + OM + '</div>'
      + '<div class="cv-firm">SHIVAM ENTERPRISES</div>'
      + '<div class="cv-addr">' + esc(firmAddrLine()) + '<br>' + esc(firmRegLine()) + '</div>'
      + '<hr class="cv-divide"><div class="cv-title">LOAN FILE</div>'
      + '<div class="cv-box">'
      + '<div class="line"><b>Name &amp; Address of Borrower:</b> ' + (nameAddr ? ('<span class="fv">' + esc(nameAddr) + '</span>') : '<span class="b bfull"></span><span class="b bfull"></span>') + '</div>'
      + '<div class="line"><b>Loan A/C No.:</b> ' + fv(l.acno, 'bl') + '</div>'
      + '<div class="line"><b>Loan Amount ₹:</b> ' + fv(_r(l.principal), 'bl') + '</div>'
      + '<div class="line"><b>Date:</b> ' + fv(_d(l.disb), 'bl') + '</div>'
      + '<div class="line"><b>Purpose:</b> ' + fv(l.product || l.type, 'bfull') + '</div>'
      + '</div></div></section>'

      /* ---- Page 2: Proposal Form ---- */
      + '<section class="sheet">'
      + '<div class="om">' + OM + '</div><div class="firm">SHIVAM ENTERPRISES</div>'
      + '<div class="addr">' + esc(l && firmAddrLine()) + '<br>' + esc(firmRegLine()) + '</div><div class="rule"></div>'
      + '<div class="doctitle">PROPOSAL FORM</div>'
      + '<div class="photo">Affix<br>Photo</div>'
      + '<div class="row"><div>Case No.: ' + fv(l.caseno) + '</div><div>Month: ' + fv(l.disb ? _d(l.disb) : '') + '</div></div>'
      + '<div class="row"><div>Loan Purpose: ' + fv(l.product) + '</div><div>Ref.: ' + fv(l.refno) + '</div></div>'
      + '<div class="sec-h">FOR OFFICE USE ONLY</div>'
      + '<table class="kv"><tr><td>Referred By / Source: ' + fv(l.dealer, 'bl') + '</td><td>Date: ' + fv(_d(l.disb)) + '</td></tr>'
      + '<tr><td>Down Payment ₹: ' + fv(_r(l.downpay)) + '</td><td>Financed Amount ₹: ' + fv(_r(l.principal)) + '</td></tr>'
      + '<tr><td>Interest @ (%): ' + fv(l.rate) + '</td><td></td></tr></table>'
      + '<div class="sec-h">APPLICANT</div>'
      + '<p class="cl">1. (a) Name of the Applicant: ' + fv(l.name, 'bl') + ' &nbsp; Age: ' + fv(l.age) + '</p>'
      + '<p class="cl">(b) Father’s / Husband’s Name: ' + fv(l.relname, 'bxl') + '</p>'
      + '<p class="cl">(c) Permanent House Address in Full: ' + fv(l.addr, 'bfull') + '</p>'
      + '<p class="cl">Telephone: ' + fv(l.phone, 'bl') + '</p>'
      + '<p class="cl">(d) Residence: ' + (l.residence ? ('<span class="fv">' + esc(l.residence) + '</span>') : ' Own &#9633; &nbsp; Rental &#9633; &nbsp; Parent’s / Spouse &#9633; &nbsp; Employee Leased &#9633;') + '</p>'
      + '<p class="cl">(e) Occupation: ' + fv(l.occupation, 'bl') + ' &nbsp; (f) Designation: ' + fv(l.designation) + '</p>'
      + '<p class="cl">(g) Office Address / Place of Business: ' + fv(l.officeaddr, 'bfull') + '</p>'
      + '<p class="cl">(h) Aadhaar / Passport / Driving Licence No.: ' + fv(_aadhaar(l), 'bxl') + '</p>'
      + '<p class="cl">(i) PAN Card No.: ' + fv(l.pan, 'bl') + '</p>'
      + '<p class="cl">Guarantor Name: ' + fv(l.gname, 'bxl') + '</p>'
      + '<div class="note">Note:- We the undersigned solemnly affirm that the declaration made above by us is absolutely true and no part is false and nothing has been withheld or concealed. This declaration is signed on the basis of the agreement.</div>'
      + '<div style="display:flex;justify-content:space-between;margin-top:36px;gap:40px;font-size:12.5px;"><div style="text-align:left;">Place: <b>Lucknow</b><br><br>Date: ' + fv(_d(l.disb), 'bl') + '</div>'
      + '<div style="text-align:center;flex:0 0 45%;"><div class="sig-line" style="margin-top:6px;">Applicant Signature</div><div class="sig-line" style="margin-top:34px;">Guarantor Signature</div></div></div>'
      + '</section>'

      /* ---- Page 3: Loan Agreement ---- */
      + '<section class="sheet">'
      + '<div class="om">' + OM + '</div><div class="doctitle">LOAN AGREEMENT</div>'
      + '<div class="docsub">(Secured by Mortgage of Immovable Property)</div>'
      + '<div class="addr">Shivam Enterprises, ' + esc(FIRM().address) + ' &nbsp;|&nbsp; ' + esc(firmRegLine()) + '</div><div class="rule"></div>'
      + '<p class="cl">Memorandum of agreement made this ' + fv(l.disb ? new Date(l.disb).getDate() : '') + ' day of ' + fv(l.disb ? new Date(l.disb).toLocaleString('en-IN', { month: 'long' }) : '') + ' 20' + fv(l.disb ? String(new Date(l.disb).getFullYear()).slice(2) : '') + ' between <b>Shivam Enterprises, ' + esc(FIRM().address) + '</b>, hereinafter called the “Lender” (which expression shall include its successors and assigns) of the first part, and Shri ' + fv(l.name, 'bl') + ' Son / Daughter / Wife of Shri ' + fv(l.relname, 'bw') + ' residing at ' + fv(l.addr, 'bl') + ', hereinafter called the “Borrower”, and Shri ' + fv(l.gname, 'bl') + ' Son / Daughter / Wife of Shri <span class="b bw"></span> residing at <span class="b bl"></span>, hereinafter called the “Guarantor”, of the second part.</p>'
      + '<p class="cl">WHEREAS the Borrower has applied to the Lender for a loan, and the Lender has agreed to advance the same against the security of the immovable property described in the Schedule of Property hereunder, on the terms following.</p>'
      + '<p class="cl"><b>NOW THIS AGREEMENT WITNESSES AS FOLLOWS:</b></p><ol class="clauses">'
      + '<li>The Lender has advanced / agreed to advance to the Borrower the sum of Rs. ' + fv(_r(l.principal)) + ' (“the Loan”), together with interest at the rate of ' + fv(l.rate) + ' % per month.</li>'
      + '<li>The Borrower shall repay the Loan with interest in ' + fv(l.tenure) + ' monthly instalments of Rs. ' + fv(_r(l.emi)) + ' each, commencing from ' + fv(_d(l.due || _addM(l.disb, 1))) + ' and continuing until ' + fv(_d(untilD)) + ', payable at the Lender’s office at Lucknow, for which a printed receipt shall be obtained.</li>'
      + '<li>As and by way of security for the due repayment of the Loan, interest and all charges, the Borrower hereby mortgages and charges in favour of the Lender the immovable property described in the Schedule of Property below, and has deposited / shall deposit with the Lender the original title documents thereof with intent to create security over the said property, which shall remain so charged until the entire dues are fully repaid.</li>'
      + '<li>The Borrower covenants and declares: (a) that the Borrower is the sole, lawful and absolute owner of the said property and that it is free from any prior mortgage, charge or encumbrance; (b) to pay every instalment punctually on its due date; (c) to keep the property in good condition and duly insured, and to pay all taxes, rates and outgoings in respect thereof; (d) not to sell, transfer, lease, gift or further encumber the property, nor part with possession thereof, without the prior written consent of the Lender, until the entire dues are cleared.</li>'
      + '<li>In the event of default in payment of any instalment on its due date, a late-payment surcharge as applicable shall be payable; and the Lender may, by notice in writing, declare the entire outstanding amount immediately due and payable, and shall be entitled to enforce the security and recover the dues by sale of the mortgaged property in accordance with law, the Borrower and the Guarantor remaining jointly and severally liable for any shortfall.</li>'
      + '<li>The Guarantor jointly and severally guarantees the due repayment of the Loan together with interest and all charges; and the liability of the Guarantor shall be co-extensive with that of the Borrower.</li>'
      + '<li>The Lender may assign all its rights and the security under this Agreement to any person, firm or company, and the Borrower agrees to accept such assignee as the Lender for all purposes of this Agreement.</li>'
      + '<li>All disputes or differences arising out of or relating to this Agreement shall be referred to the sole arbitrator Shri <span class="b bl"></span>, whose award shall be final and binding; and the courts at Lucknow alone shall have jurisdiction. This Agreement shall be binding upon the heirs, executors, administrators and assigns of the parties.</li></ol>'
      + '<div class="sec-h">SECURITY</div><p class="cl">Type of security held: ' + fv(l.propdesc, 'bl') + ' &nbsp; Approx. value of security Rs. ' + fv(_r(l.propvalue)) + '</p>'
      + '<div class="sec-h">SCHEDULE OF LOAN</div><table class="kv"><tr><td>Loan amount Rs. ' + fv(_r(l.principal)) + '</td><td>Rate of interest ' + fv(l.rate) + ' % per month</td></tr>'
      + '<tr><td>Monthly instalment Rs. ' + fv(_r(l.emi)) + ' &times; ' + fv(l.tenure) + '</td><td>Total amount repayable Rs. ' + fv(_r(l.tpay)) + '</td></tr></table>'
      + '<div style="display:flex;justify-content:space-between;margin-top:14px;gap:24px;font-size:12.5px;text-align:center;"><div style="flex:1;"><div class="sig-line">Signature of the Borrower</div></div><div style="flex:1;"><div class="sig-line">Signature of Guarantor</div></div><div style="flex:1;"><div class="sig-line">For Shivam Enterprises (Lender)</div></div></div>'
      + '<div class="row" style="margin-top:6px;"><div>Witness 1: <span class="b" style="min-width:95px;"></span> Addr: <span class="b" style="min-width:80px;"></span></div><div>Witness 2: <span class="b" style="min-width:95px;"></span> Addr: <span class="b" style="min-width:80px;"></span></div></div>'
      + '</section>'

      /* ---- Page 4: Security & Declaration + Promissory Note ---- */
      + '<section class="sheet">'
      + '<div class="om">' + OM + '</div><div class="doctitle">LOAN SECURITY &amp; DECLARATION LETTER</div><div class="rule"></div>'
      + '<p class="cl">To,<br><b>Shivam Enterprises</b><br>' + esc(FIRM().address) + '</p>'
      + '<div class="row"><div>From: ' + fv(l.name, 'bl') + '</div><div>Date: ' + fv(_d(l.disb)) + '</div></div>'
      + '<p class="cl">Dear Sir,</p>'
      + '<p class="cl">I confirm that I have availed a loan of Rs. ' + fv(_r(l.principal)) + ' from you under your loan scheme, repayable with interest as per the Loan Agreement executed by me. As and by way of security for the due repayment of the said loan together with interest and all charges, I hereby offer, mortgage and charge in your favour the immovable property described below, and confirm that I have deposited / shall deposit with you the original title documents of the said property with intent to create security over it. I declare that I am the lawful owner of the property, that it is free from prior encumbrance, and I undertake not to sell, transfer or further encumber it until the entire dues are fully cleared.</p>'
      + '<table class="kv"><tr><td>Type of security: ' + fv(l.propdesc, 'bl') + '</td><td>Situated at: ' + fv(l.propaddr, 'bl') + '</td></tr>'
      + '<tr><td>Area: ' + fv(l.proparea) + '</td><td>Approx. value Rs. ' + fv(_r(l.propvalue)) + '</td></tr></table>'
      + '<p class="cl" style="margin-top:20px;">Yours faithfully,</p>'
      + '<div style="margin-top:8px;">Borrower (sign): <span class="b bl"></span><br><br>Name: ' + fv(l.name, 'bl') + '</div>'
      + '<div class="rule" style="margin-top:30px;"></div><div class="doctitle" style="margin-top:6px;">PROMISSORY NOTE</div>'
      + '<p class="cl"><b>Rs. ' + fv(_r(l.principal)) + '</b></p>'
      + '<p class="cl">On demand I, (Borrower) ' + fv(l.name, 'bl') + ' Son / Daughter / Wife of ' + fv(l.relname, 'bw') + ', resident of ' + fv(l.addr, 'bl') + ', and (Guarantor) ' + fv(l.gname, 'bl') + ' Son / Daughter / Wife of <span class="b bw"></span>, resident of <span class="b bl"></span>, jointly and severally promise to pay <b>Shivam Enterprises, ' + esc(FIRM().address) + '</b>, or order, the sum of Rs. ' + fv(_r(l.principal)) + ' (Rupees <span class="b bl"></span>) together with interest at ' + fv(l.rate) + ' % per month, for value received. Dated this ' + fv(l.disb ? new Date(l.disb).getDate() : '') + ' day of ' + fv(l.disb ? new Date(l.disb).toLocaleString('en-IN', { month: 'long' }) : '') + ' 20' + fv(l.disb ? String(new Date(l.disb).getFullYear()).slice(2) : '') + '.</p>'
      + '<div style="display:flex;justify-content:space-between;margin-top:26px;gap:40px;font-size:12.5px;"><div style="text-align:left;">Place: <b>Lucknow</b></div><div style="text-align:center;flex:0 0 45%;"><div class="sig-line" style="margin-top:6px;">Signature of Borrower</div><div class="sig-line" style="margin-top:34px;">Signature of Guarantor</div></div></div>'
      + '</section>'

      + '</body></html>';
  }

  window.openLoanFile = function (id) {
    var l = loans.find(function (x) { return x.id === id; });
    if (!l) { toast('Loan not found'); return; }
    window._lfLoan = l;
    var ov = document.getElementById('lfOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'lfOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,12,26,.6);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto;';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) window.closeLoanFile(); });
    }
    ov.innerHTML =
      '<div style="background:#fff;max-width:880px;width:100%;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.4);overflow:hidden;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0b1f4b;color:#fff;">'
      + '<div style="font-weight:700;">Loan File — ' + esc(l.name || '') + (l.acno ? (' (' + esc(l.acno) + ')') : '') + '</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button onclick="printLoanFile()" style="border:0;border-radius:8px;padding:7px 14px;background:#0b7a4b;color:#fff;font-weight:600;cursor:pointer;">🖶 Print / PDF</button>'
      + '<button onclick="waLoanFile()" style="border:0;border-radius:8px;padding:7px 14px;background:#128C7E;color:#fff;font-weight:600;cursor:pointer;">WhatsApp</button>'
      + '<button onclick="closeLoanFile()" style="border:0;border-radius:8px;padding:7px 12px;background:#334155;color:#fff;font-weight:600;cursor:pointer;">Close</button>'
      + '</div></div>'
      + '<div style="padding:10px 12px;"><iframe id="lfFrame" style="width:100%;height:78vh;border:1px solid #e2e8f0;border-radius:6px;background:#fff;"></iframe>'
      + '<div style="font-size:11.5px;color:#94a3b8;margin-top:6px;">Auto-filled from this loan. Blank lines are for details not on record (guarantor s/o &amp; address, witnesses, property title). Print / Save-as-PDF, then print on A4.</div>'
      + '</div></div>';
    ov.style.display = 'flex';
    var fr = document.getElementById('lfFrame');
    try { fr.srcdoc = _html(l); } catch (e) {}
    try { logAudit('Loan File Opened', (l.name || '') + ' (' + (l.acno || '') + ')'); } catch (e) {}
  };

  window.printLoanFile = function () {
    var fr = document.getElementById('lfFrame');
    if (!fr) return;
    try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {}
    try { logAudit('Loan File Printed', (window._lfLoan && window._lfLoan.acno) || ''); } catch (e) {}
  };

  window.closeLoanFile = function () { var ov = document.getElementById('lfOverlay'); if (ov) ov.style.display = 'none'; };

  window.waLoanFile = function () {
    var l = window._lfLoan; if (!l) return;
    var p = String(l.phone || '').replace(/\D/g, '');
    if (p.length === 10) p = '91' + p; else if (p.length === 11 && p[0] === '0') p = '91' + p.slice(1);
    if (!p) { toast('No phone number on file — open the loan to add one'); return; }
    var msg = 'Namaste ' + (l.name || '') + ', please find your loan file for account ' + (l.acno || '') + ' attached.\n\n— ' + FIRM().name;
    window.open('https://wa.me/' + p + '?text=' + encodeURIComponent(msg), '_blank');
    toast('WhatsApp opened — attach the saved PDF and send');
  };
})();
