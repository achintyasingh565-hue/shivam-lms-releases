/* ===========================================================================
 * src/app/26-letterhead.js
 *
 * BLANK LETTERHEAD COMPOSER — a free-form letter on the firm letterhead. Rich
 * text (font family & size, bold / italic / underline, bullet & numbered lists,
 * alignment), reliable paste, and an auto-saved draft so nothing is lost. Then
 * print, save as PDF, or share on WhatsApp. Uses the same letterhead header /
 * footer + watermark + corner graphics as every other document.
 *
 * Public: window.openBlankLetter()
 * ======================================================================== */
(function () {
  var DRAFT_KEY = 'shivam_letter_draft_v1';
  function _firm() { return (typeof FIRM === 'function') ? FIRM() : { name: 'Shivam Enterprises', address: '', phones: '', udyam: '' }; }
  function _today() { try { return (typeof fmtDate === 'function' && fmtDate(todayISO())) ? fmtDate(todayISO()) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }

  // Corner graphics + a watermark PINNED to the first page (so it never splits across a
  // page break on a long letter). Anchored to the body box: top-left frames page 1,
  // bottom-right frames the end, watermark sits inside page 1.
  function _brand() {
    var f = _firm();
    var svg = function (css) {
      return '<svg style="position:absolute;width:30mm;height:30mm;z-index:-1;pointer-events:none;' + css + '" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<polygon points="0,0 150,0 0,150" fill="#0b1f4b" opacity="0.07"/>'
        + '<polygon points="0,0 105,0 0,105" fill="#c8a02a" opacity="0.22"/>'
        + '<polygon points="0,0 48,0 0,48" fill="#0b1f4b" opacity="0.9"/></svg>';
    };
    var wm = '<div style="position:absolute;top:150mm;left:50%;transform:translate(-50%,-50%) rotate(-30deg);white-space:nowrap;'
      + 'font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:70px;letter-spacing:4px;color:#0b1f4b;opacity:.05;z-index:-1;pointer-events:none;">' + esc(f.name) + '</div>';
    return wm + svg('top:0;left:0;') + svg('bottom:0;right:0;transform:rotate(180deg);');
  }

  function _doc(bodyHTML, ref, date) {
    var f = _firm();
    var brandCSS = (typeof docBrandCSS === 'function') ? docBrandCSS() : '';
    // A real 10mm @page margin makes the printable area predictable regardless of the
    // print dialog's "Default" margins, and a fit-to-page script shrinks the letter just
    // enough to always land on ONE page (footer included).
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(f.name) + ' — Letter</title><style>'
      + brandCSS
      + '@page{size:A4;margin:10mm;} html,body{margin:0;padding:0;} body{font-family:Georgia,"Times New Roman",serif;color:#1b1b1b;position:relative;box-sizing:border-box;min-height:0 !important;}'
      + '@media print{body{min-height:0 !important;}}'
      + '#lhpage{overflow:hidden;} #lhsheet{transform-origin:top left;}'
      + '.lhn{text-align:center;font-size:23px;font-weight:bold;letter-spacing:1px;color:#0b1f4b;font-family:Georgia,"Times New Roman",serif;}'
      + '.lha{text-align:center;font-size:10.5px;color:#555;margin-top:4px;line-height:1.5;font-family:-apple-system,"Segoe UI",Arial,sans-serif;}'
      + '.lhr{border-bottom:2px solid #c8a02a;margin:7px 0 10px;}'
      + '.lhref{display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;color:#1b1b1b;margin-bottom:10px;font-family:-apple-system,"Segoe UI",Arial,sans-serif;}'
      + '.lhbody{font-size:12px;line-height:1.4;text-align:left;}'
      + '.lhbody ul,.lhbody ol{margin:4px 0 4px 22px;} .lhbody p{margin:3px 0;} .lhbody div{margin:1px 0;}'
      + '.lhfoot{border-top:1.5px solid #c8a02a;margin-top:16px;padding-top:5px;text-align:center;font-size:9px;color:#555;font-family:-apple-system,"Segoe UI",Arial,sans-serif;}'
      + '</style></head><body>'
      + _brand()
      + '<div id="lhpage"><div id="lhsheet">'
      + '<div class="lhn">' + esc(f.name) + '</div>'
      + '<div class="lha">' + esc(firmAddrLine()) + '<br>' + esc(firmRegLine()) + '</div>'
      + '<div class="lhr"></div>'
      + '<div class="lhref"><div>Ref. No.: ' + esc(ref || '') + '</div><div>Date: ' + esc(date || '') + '</div></div>'
      + '<div class="lhbody">' + (bodyHTML || '') + '</div>'
      + '<div class="lhfoot">Proprietor: Achintya Kumar &bull; ' + esc(f.address) + ' &bull; ' + esc(f.phones) + (f.udyam ? (' &bull; Udyam Reg. No.: ' + esc(f.udyam)) : '') + '</div>'
      + '</div></div>'
      + '<script>(function(){function fit(){try{var pg=document.getElementById("lhpage"),sh=document.getElementById("lhsheet");if(!pg||!sh)return;sh.style.transform="none";var h=sh.getBoundingClientRect().height;var TARGET=1030;if(h>TARGET){var s=TARGET/h;sh.style.transform="scale("+s+")";sh.style.width=(100/s)+"%";pg.style.height=(h*s)+"px";}else{pg.style.height=h+"px";}}catch(e){}}fit();window.addEventListener("load",fit);setTimeout(fit,120);})();<\/script>'
      + '</body></html>';
  }

  function _tbtn(cmd, label, title) {
    return '<button type="button" title="' + title + '" onmousedown="event.preventDefault()" onclick="blCmd(\'' + cmd + '\')" '
      + 'style="min-width:34px;height:32px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;font-size:14px;color:#0b1f4b;">' + label + '</button>';
  }
  function _sep() { return '<span style="width:1px;height:24px;background:#e2e8f0;display:inline-block;margin:0 3px;"></span>'; }

  function _saveDraft() {
    try {
      var body = document.getElementById('blBody'); if (!body) return;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        html: body.innerHTML,
        ref: (document.getElementById('blRef') || {}).value || '',
        date: (document.getElementById('blDate') || {}).value || ''
      }));
    } catch (e) {}
  }
  function _loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; } }

  function _onPaste(e) {
    // Insert pasted content ourselves so paste always works and doesn't drag in
    // page-wide styles. Prefer HTML (keeps bold/lists), fall back to plain text.
    try {
      e.preventDefault();
      var cb = e.clipboardData || window.clipboardData;
      if (!cb) return;
      var html = cb.getData('text/html');
      var text = cb.getData('text/plain');
      var out;
      if (html) {
        out = html
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<\s*(script|style|meta|link|title|head)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
          .replace(/<\/?(html|body|head)[^>]*>/gi, '')
          .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
          .replace(/\son\w+\s*=\s*'[^']*'/gi, '');
      } else {
        out = (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      }
      document.execCommand('insertHTML', false, out);
      _saveDraft();
    } catch (err) {}
  }

  window.openBlankLetter = function () {
    var ov = document.getElementById('blOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'blOverlay';
      // NOTE: deliberately NO click-to-close on the backdrop — an accidental click
      // must never discard the letter.
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,12,26,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto;';
      document.body.appendChild(ov);
    }
    // Build the composer only once, so switching away and back keeps everything typed.
    if (!document.getElementById('blBody')) {
      // These are ACTION menus (not state) — a "▾" placeholder is always reselected after
      // use, so choosing the same font/size again still applies to the selected text.
      var fam = function (label, css) { return '<option value="' + css.replace(/"/g, '&quot;') + '">' + label + '</option>'; };
      var fontSel = '<select id="blFont" onchange="blFont(this.value)" onmousedown="blSaveSel()" title="Font" style="height:32px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;padding:0 4px;max-width:150px;">'
        + '<option value="" selected>Font ▾</option>'
        + '<optgroup label="Serif">'
        + fam('Georgia', "Georgia, serif")
        + fam('Times New Roman', "'Times New Roman', Times, serif")
        + fam('Cambria', "Cambria, Georgia, serif")
        + fam('Garamond', "Garamond, serif")
        + fam('Book Antiqua', "'Book Antiqua', Palatino, serif")
        + fam('Palatino Linotype', "'Palatino Linotype', Palatino, serif")
        + '</optgroup>'
        + '<optgroup label="Sans-serif">'
        + fam('Arial', "Arial, Helvetica, sans-serif")
        + fam('Calibri', "Calibri, Candara, sans-serif")
        + fam('Segoe UI', "'Segoe UI', Arial, sans-serif")
        + fam('Verdana', "Verdana, Geneva, sans-serif")
        + fam('Tahoma', "Tahoma, Geneva, sans-serif")
        + fam('Trebuchet MS', "'Trebuchet MS', sans-serif")
        + fam('Century Gothic', "'Century Gothic', sans-serif")
        + fam('Franklin Gothic', "'Franklin Gothic Medium', Arial, sans-serif")
        + fam('Lucida Sans', "'Lucida Sans Unicode', 'Lucida Grande', sans-serif")
        + '</optgroup>'
        + '<optgroup label="Monospace">'
        + fam('Courier New', "'Courier New', Courier, monospace")
        + fam('Consolas', "Consolas, 'Courier New', monospace")
        + fam('Lucida Console', "'Lucida Console', Monaco, monospace")
        + '</optgroup>'
        + '<optgroup label="Display">'
        + fam('Impact', "Impact, Charcoal, sans-serif")
        + fam('Comic Sans MS', "'Comic Sans MS', cursive")
        + '</optgroup>'
        + '</select>';
      var sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 60, 72];
      var sizeSel = '<select id="blSize" onchange="blSize(this.value)" onmousedown="blSaveSel()" title="Font size (pt)" style="height:32px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;padding:0 4px;">'
        + '<option value="" selected>Size ▾</option>'
        + sizes.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('')
        + '</select>';
      var toolbar = fontSel + sizeSel + _sep()
        + _tbtn('bold', '<b>B</b>', 'Bold') + _tbtn('italic', '<i>I</i>', 'Italic') + _tbtn('underline', '<u>U</u>', 'Underline') + _sep()
        + _tbtn('insertUnorderedList', '&bull; List', 'Bullet list') + _tbtn('insertOrderedList', '1. List', 'Numbered list') + _sep()
        + _tbtn('justifyLeft', '⯇', 'Align left') + _tbtn('justifyCenter', '≡', 'Align centre') + _tbtn('justifyRight', '⯈', 'Align right') + _sep()
        + _tbtn('removeFormat', '⌫ Clear format', 'Clear formatting');

      ov.innerHTML =
        '<div style="background:#fff;max-width:880px;width:100%;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;background:#0b1f4b;color:#fff;">'
        + '<div style="font-weight:700;">Letterhead — Compose a Letter</div>'
        + '<div style="display:flex;gap:8px;">'
        + '<button onclick="printBlankLetter()" style="border:0;border-radius:8px;padding:7px 14px;background:#0b7a4b;color:#fff;font-weight:600;cursor:pointer;">🖶 Print / PDF</button>'
        + '<button onclick="waBlankLetter()" style="border:0;border-radius:8px;padding:7px 14px;background:#128C7E;color:#fff;font-weight:600;cursor:pointer;">WhatsApp</button>'
        + '<button onclick="clearBlankLetter()" title="Clear and start fresh" style="border:0;border-radius:8px;padding:7px 12px;background:#b45309;color:#fff;font-weight:600;cursor:pointer;">New</button>'
        + '<button onclick="closeBlankLetter()" style="border:0;border-radius:8px;padding:7px 12px;background:#334155;color:#fff;font-weight:600;cursor:pointer;">Close</button>'
        + '</div></div>'
        + '<div style="padding:16px 18px;">'
        + '<div style="display:flex;gap:14px;margin-bottom:12px;flex-wrap:wrap;">'
        + '<label style="font-size:13px;color:#334155;">Ref. No. <input id="blRef" oninput="blSaveDraft()" style="border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:13px;width:150px;"></label>'
        + '<label style="font-size:13px;color:#334155;">Date <input id="blDate" oninput="blSaveDraft()" value="' + esc(_today()) + '" style="border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:13px;width:170px;"></label>'
        + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center;">' + toolbar + '</div>'
        + '<div id="blBody" contenteditable="true" spellcheck="true" style="min-height:380px;max-height:58vh;overflow:auto;border:1px solid #cbd5e1;border-radius:8px;padding:16px;font-size:14px;line-height:1.7;outline:none;background:#fff;color:#111;font-family:Georgia,\'Times New Roman\',serif;"></div>'
        + '<div style="font-size:11.5px;color:#94a3b8;margin-top:8px;">Type or paste your letter above (it auto-saves as a draft, so it is never lost). Choose the font and size from the toolbar. It prints on the Shivam Enterprises letterhead. Use “New” to start a fresh letter.</div>'
        + '</div></div>';

      var draft = _loadDraft();
      if (draft && typeof draft === 'object') {
        try {
          document.getElementById('blBody').innerHTML = draft.html || '';
          if (draft.ref) document.getElementById('blRef').value = draft.ref;
          if (draft.date) document.getElementById('blDate').value = draft.date;
        } catch (e) {}
      }
      var body = document.getElementById('blBody');
      body.addEventListener('input', _saveDraft);
      body.addEventListener('paste', _onPaste);
    }
    ov.style.display = 'flex';
    setTimeout(function () { var b = document.getElementById('blBody'); if (b) b.focus(); }, 60);
    try { logAudit('Letterhead Composer Opened', ''); } catch (e) {}
  };

  // Remember the current selection so a toolbar dropdown (which briefly steals focus)
  // still applies to the text the user had highlighted.
  var _savedRange = null;
  window.blSaveSel = function () {
    try { var s = window.getSelection(); if (s && s.rangeCount) { var b = document.getElementById('blBody'); if (b && b.contains(s.anchorNode)) _savedRange = s.getRangeAt(0).cloneRange(); } } catch (e) {}
  };
  function _restoreSel() {
    try { var b = document.getElementById('blBody'); if (!b) return; b.focus(); if (_savedRange) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(_savedRange); } } catch (e) {}
  }
  window.blSaveDraft = _saveDraft;
  window.blCmd = function (cmd) { try { var b = document.getElementById('blBody'); if (b) b.focus(); document.execCommand(cmd, false, null); _saveDraft(); } catch (e) {} };
  window.blFont = function (v) {
    if (!v) return;
    try { _restoreSel(); document.execCommand('styleWithCSS', false, true); document.execCommand('fontName', false, v); _saveDraft(); } catch (e) {}
    var s = document.getElementById('blFont'); if (s) s.selectedIndex = 0;   // reset to "Font ▾"
  };
  // Apply an exact point size: mark the selection with the largest built-in size, then
  // rewrite those marked spans to the requested pt (execCommand only supports 1–7 natively).
  window.blSize = function (v) {
    if (!v) return;
    try {
      _restoreSel();
      var b = document.getElementById('blBody'); if (!b) return;
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('fontSize', false, '7');
      Array.prototype.forEach.call(b.querySelectorAll('*'), function (el) {
        if (el.style && (el.style.fontSize === 'xxx-large' || el.style.fontSize === '-webkit-xxx-large')) {
          el.style.fontSize = v + 'pt';
        }
      });
      _saveDraft();
    } catch (e) {}
    var s = document.getElementById('blSize'); if (s) s.selectedIndex = 0;    // reset to "Size ▾"
  };

  window.closeBlankLetter = function () { _saveDraft(); var ov = document.getElementById('blOverlay'); if (ov) ov.style.display = 'none'; };

  window.clearBlankLetter = function () {
    if (!confirm('Clear the whole letter and start a fresh one? Your current text will be removed.')) return;
    var b = document.getElementById('blBody'); if (b) { b.innerHTML = ''; b.focus(); }
    var r = document.getElementById('blRef'); if (r) r.value = '';
    _saveDraft();
  };

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
