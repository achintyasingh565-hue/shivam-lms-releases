/* ===========================================================================
 * src/app/26-letterhead.js
 *
 * BLANK LETTERHEAD COMPOSER — a free-form letter on the firm letterhead. The
 * owner types (rich text: bold / italic / underline / bullet & numbered lists /
 * alignment), then prints, saves as PDF, or shares on WhatsApp. Uses the same
 * letterhead header/footer + watermark + corner graphics as every other document.
 *
 * Public: window.openBlankLetter()
 * ======================================================================== */
(function () {
  function _firm() { return (typeof FIRM === 'function') ? FIRM() : { name: 'Shivam Enterprises', address: '', phones: '', udyam: '' }; }
  function _today() { try { return (typeof fmtDate === 'function' && fmtDate(todayISO())) ? fmtDate(todayISO()) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }

  function _doc(bodyHTML, ref, date) {
    var f = _firm();
    var brandCSS = (typeof docBrandCSS === 'function') ? docBrandCSS() : '';
    var brand = (typeof docBrandHTML === 'function') ? docBrandHTML(true) : '';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(f.name) + ' — Letter</title><style>'
      + brandCSS
      + '@page{size:A4;margin:0;} body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#1b1b1b;padding:18mm 18mm 16mm;position:relative;min-height:297mm;}'
      + '.lhn{text-align:center;font-size:26px;font-weight:bold;letter-spacing:1px;color:#0b1f4b;font-family:Georgia,"Times New Roman",serif;}'
      + '.lha{text-align:center;font-size:11px;color:#555;margin-top:6px;line-height:1.6;}'
      + '.lhr{border-bottom:2px solid #c8a02a;margin:10px 0 16px;}'
      + '.lhref{display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:#1b1b1b;margin-bottom:16px;}'
      + '.lhbody{font-size:13.5px;line-height:1.75;text-align:justify;}'
      + '.lhbody ul,.lhbody ol{margin:8px 0 8px 22px;} .lhbody p{margin:8px 0;}'
      + '.lhfoot{border-top:1.5px solid #c8a02a;margin-top:30px;padding-top:6px;text-align:center;font-size:9.5px;color:#555;}'
      + '</style></head><body>'
      + brand
      + '<div class="lhn">' + esc(f.name) + '</div>'
      + '<div class="lha">' + esc(firmAddrLine()) + '<br>' + esc(firmRegLine()) + '</div>'
      + '<div class="lhr"></div>'
      + '<div class="lhref"><div>Ref. No.: ' + esc(ref || '') + '</div><div>Date: ' + esc(date || '') + '</div></div>'
      + '<div class="lhbody">' + (bodyHTML || '') + '</div>'
      + '<div class="lhfoot">Proprietor: Achintya Kumar &bull; ' + esc(f.address) + ' &bull; ' + esc(f.phones) + (f.udyam ? (' &bull; Udyam Reg. No.: ' + esc(f.udyam)) : '') + '</div>'
      + '</body></html>';
  }

  function _tbtn(cmd, label, title) {
    return '<button type="button" title="' + title + '" onmousedown="event.preventDefault()" onclick="blCmd(\'' + cmd + '\')" '
      + 'style="min-width:34px;height:32px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;font-size:14px;color:#0b1f4b;">' + label + '</button>';
  }

  window.openBlankLetter = function () {
    var ov = document.getElementById('blOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'blOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,12,26,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto;';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) window.closeBlankLetter(); });
    }
    var toolbar = _tbtn('bold', '<b>B</b>', 'Bold') + _tbtn('italic', '<i>I</i>', 'Italic') + _tbtn('underline', '<u>U</u>', 'Underline')
      + '<span style="width:1px;height:24px;background:#e2e8f0;display:inline-block;margin:0 4px;"></span>'
      + _tbtn('insertUnorderedList', '&bull; List', 'Bullet list') + _tbtn('insertOrderedList', '1. List', 'Numbered list')
      + '<span style="width:1px;height:24px;background:#e2e8f0;display:inline-block;margin:0 4px;"></span>'
      + _tbtn('justifyLeft', '⯇', 'Align left') + _tbtn('justifyCenter', '≡', 'Align centre') + _tbtn('justifyRight', '⯈', 'Align right')
      + '<span style="width:1px;height:24px;background:#e2e8f0;display:inline-block;margin:0 4px;"></span>'
      + _tbtn('removeFormat', '⌫ Clear', 'Clear formatting');

    ov.innerHTML =
      '<div style="background:#fff;max-width:860px;width:100%;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;background:#0b1f4b;color:#fff;">'
      + '<div style="font-weight:700;">Letterhead — Compose a Letter</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button onclick="printBlankLetter()" style="border:0;border-radius:8px;padding:7px 14px;background:#0b7a4b;color:#fff;font-weight:600;cursor:pointer;">🖶 Print / PDF</button>'
      + '<button onclick="waBlankLetter()" style="border:0;border-radius:8px;padding:7px 14px;background:#128C7E;color:#fff;font-weight:600;cursor:pointer;">WhatsApp</button>'
      + '<button onclick="closeBlankLetter()" style="border:0;border-radius:8px;padding:7px 12px;background:#334155;color:#fff;font-weight:600;cursor:pointer;">Close</button>'
      + '</div></div>'
      + '<div style="padding:16px 18px;">'
      + '<div style="display:flex;gap:14px;margin-bottom:12px;flex-wrap:wrap;">'
      + '<label style="font-size:13px;color:#334155;">Ref. No. <input id="blRef" style="border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:13px;width:150px;"></label>'
      + '<label style="font-size:13px;color:#334155;">Date <input id="blDate" value="' + esc(_today()) + '" style="border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:13px;width:170px;"></label>'
      + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + toolbar + '</div>'
      + '<div id="blBody" contenteditable="true" style="min-height:380px;max-height:60vh;overflow:auto;border:1px solid #cbd5e1;border-radius:8px;padding:16px;font-size:14px;line-height:1.7;outline:none;background:#fff;color:#111;"></div>'
      + '<div style="font-size:11.5px;color:#94a3b8;margin-top:8px;">Type or paste your letter above. It prints on the Shivam Enterprises letterhead with the header, footer, watermark and corner design. Use Print / PDF to save or print, then WhatsApp to share the saved PDF.</div>'
      + '</div></div>';
    ov.style.display = 'flex';
    setTimeout(function () { var b = document.getElementById('blBody'); if (b) b.focus(); }, 60);
    try { logAudit('Letterhead Composer Opened', ''); } catch (e) {}
  };

  window.blCmd = function (cmd) {
    try { var b = document.getElementById('blBody'); if (b) b.focus(); document.execCommand(cmd, false, null); } catch (e) {}
  };

  window.closeBlankLetter = function () { var ov = document.getElementById('blOverlay'); if (ov) ov.style.display = 'none'; };

  window.printBlankLetter = function () {
    var body = document.getElementById('blBody'); if (!body) return;
    var inner = (body.innerHTML || '').trim();
    if (!inner || inner === '<br>') { toast('Please type the letter first'); return; }
    var ref = (document.getElementById('blRef') || {}).value || '';
    var date = (document.getElementById('blDate') || {}).value || '';
    var html = _doc(inner, ref, date);
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(f);
    var doc = f.contentWindow.document; doc.open(); doc.write(html); doc.close();
    var old = document.title;
    try { document.title = 'Shivam_Enterprises_Letter'; } catch (e) {}
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {}
      setTimeout(function () { f.remove(); try { document.title = old; } catch (e) {} }, 1500);
    }, 350);
    try { logAudit('Letterhead Letter Printed', ''); } catch (e) {}
  };

  window.waBlankLetter = function () {
    var msg = 'Please find the attached letter from ' + _firm().name + '.';
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
    try { toast('WhatsApp opened — attach the saved PDF and send'); } catch (e) {}
  };
})();
