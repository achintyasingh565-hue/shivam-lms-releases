/* 21-doc-fit.js — scale the on-screen A4 document previews DOWN to fit their
 * column on narrower windows, so a page is never clipped or cut off. Covers
 * every document surface: Certificates (certificate + receipt), Loan Documents
 * (file cover, loan agreement, security & note) and the Proposal Form.
 *
 * A page is re-fitted whenever it becomes visible — the observer watches both
 * content changes (childList) AND show/hide changes (the style/class toggles
 * used to switch between sub-tab documents). Print/PDF are never scaled:
 *   - window.print() uses @media print, where zoom is reset to 1 (redesign.css)
 *   - the html2canvas PDF path clones the page and forces clone.style.zoom='1'
 * Uses CSS `zoom` (affects layout, so there is no leftover whitespace). */
(function () {
  var SEL = '#sec-cert .page, #sec-cert .adoc, #sec-cert .cover-page, #sec-cert .pform, ' +
            '#sec-hpfile .cover-page, #sec-hpfile .page, #sec-hpfile .adoc, #sec-hpfile .pform, ' +
            '#sec-proposal .pform, #sec-proposal .page, #sec-proposal .adoc, #sec-proposal .cover-page';
  var ROOTS = ['#sec-cert', '#sec-hpfile', '#sec-proposal'];
  var mo = null, roots = [];
  function connect() {
    if (!mo) return;
    roots.forEach(function (r) { try { mo.observe(r, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] }); } catch (e) {} });
  }
  function fit() {
    if (mo) mo.disconnect();               // don't let our own zoom writes retrigger us
    try {
      document.querySelectorAll(SEL).forEach(function (pg) {
        if (!pg.offsetParent) { return; }  // hidden — measure it when it is shown
        pg.style.zoom = '';                // reset so we read the true A4 width
        var parent = pg.parentElement; if (!parent) return;
        var avail = parent.clientWidth, natural = pg.offsetWidth;
        if (avail > 0 && natural > 0 && natural > avail - 8) {
          pg.style.zoom = ((avail - 8) / natural).toFixed(4);
        }
      });
    } catch (e) {}
    connect();
  }
  var raf = null;
  function schedule() { if (raf) return; try { raf = requestAnimationFrame(function () { raf = null; fit(); }); } catch (e) { fit(); } }
  window.fitDocPreview = schedule;
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(schedule, 120); });
  function observe() {
    roots = ROOTS.map(function (s) { return document.querySelector(s); }).filter(Boolean);
    try { mo = new MutationObserver(schedule); } catch (e) {}
    connect();
    schedule();
  }
  if (document.readyState !== 'loading') observe();
  else document.addEventListener('DOMContentLoaded', observe);
})();
