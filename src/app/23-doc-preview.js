/* 23-doc-preview.js — "Preview" button for Certificates, Loan Documents and the
 * Proposal Form. The always-on side preview is hidden (see redesign.css) so the
 * form has the full width; clicking Preview clones the current document into a
 * full-size overlay, scaled to fit the overlay. The live document stays in the
 * page (hidden), so Print / Download / PDF are completely unaffected. */
(function () {
  function activeDocNode() {
    var sec = document.querySelector('.section.active');
    if (!sec) return null;
    if (sec.id === 'sec-cert') {
      return sec.querySelector('#pageCert:not(.doc-hide), #pageRcpt:not(.doc-hide)') || sec.querySelector('.page:not(.doc-hide)');
    }
    if (sec.id === 'sec-hpfile') {
      var h = sec.querySelector('.hpdoc.active') || sec.querySelector('.hpdoc');
      return h ? (h.querySelector('.cover-page, .adoc, .pform') || h) : null;
    }
    if (sec.id === 'sec-proposal') {
      return sec.querySelector('.pform') || sec.querySelector('#propPage');
    }
    return null;
  }
  window.openDocPreview = function () {
    try {
      var node = activeDocNode();
      if (!node) { try { toast('Open a document first'); } catch (e) {} return; }
      var body = document.getElementById('docPreviewBody');
      var ov = document.getElementById('docPreviewOverlay');
      if (!body || !ov) return;
      var clone = node.cloneNode(true);
      clone.classList.remove('doc-hide');
      clone.style.display = ''; clone.style.margin = '0 auto'; clone.style.zoom = '';
      body.innerHTML = ''; body.appendChild(clone);
      ov.classList.add('show');
      try {
        requestAnimationFrame(function () {
          var avail = body.clientWidth - 8, nat = clone.offsetWidth;
          if (avail > 0 && nat > 0 && nat > avail) clone.style.zoom = (avail / nat).toFixed(4);
        });
      } catch (e) {}
    } catch (e) {}
  };
  window.closeDocPreview = function () {
    var ov = document.getElementById('docPreviewOverlay');
    if (ov) ov.classList.remove('show');
    var body = document.getElementById('docPreviewBody');
    if (body) body.innerHTML = '';
  };
  /* close on backdrop click / Escape */
  document.addEventListener('click', function (e) {
    var ov = document.getElementById('docPreviewOverlay');
    if (ov && ov.classList.contains('show') && e.target === ov) window.closeDocPreview();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('docPreviewOverlay');
      if (ov && ov.classList.contains('show')) window.closeDocPreview();
    }
  });
})();
