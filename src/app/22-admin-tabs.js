/* 22-admin-tabs.js — tabbed Administration page. The 9 admin sections are
 * grouped into 4 tabs (Backup & Data, Security & Team, WhatsApp, Maintenance).
 * Every original element/id is preserved; this only toggles which group is
 * visible, so all the existing render/save logic keeps working unchanged. */
(function () {
  window.admTab = function (name) {
    try {
      document.querySelectorAll('#sec-backup .adm-tab').forEach(function (t) {
        t.classList.toggle('active', t.getAttribute('data-adm') === name);
      });
      document.querySelectorAll('#admSeg button').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-adm') === name);
      });
    } catch (e) {}
  };
})();
