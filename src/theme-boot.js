/* theme-boot.js — MUST load parser-blocking in <head> BEFORE the stylesheets.
 * Applies the saved (or system) theme class synchronously so the external CSS
 * never paints a light body for a frame before the app's JS runs. This is the
 * fix for the "white flash" on startup. It mirrors resolveTheme() in
 * src/app/14-pwa-backup.js exactly, and applyTheme() re-applies it later
 * (idempotent), so there is a single source of truth for the theme. */
(function () {
  try {
    var t = localStorage.getItem('shivam_theme');
    if (t !== 'dark' && t !== 'light') {
      t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    document.documentElement.classList.toggle('dark', t === 'dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
