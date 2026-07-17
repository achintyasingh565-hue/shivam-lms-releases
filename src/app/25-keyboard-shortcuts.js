/* ===================== src/app/25-keyboard-shortcuts.js =====================
 * Fast keyboard navigation for the proprietor.
 *
 * IMPORTANT: navigation uses Cmd/Ctrl + SHIFT + letter, NOT plain Cmd/Ctrl.
 * Plain Cmd+A / Cmd+P / Cmd+M / Cmd+F are reserved by macOS & apps for
 * Select-All / Print / Minimise / Find — hijacking them breaks normal use
 * (you couldn't select an amount, print a document, or minimise the window).
 * Adding Shift keeps every OS shortcut working while still being one chord.
 *
 *   /                    focus the search box (when not typing)
 *   Esc                  close any open dialog (loan, schedule, notice, preview)
 *   Cmd/Ctrl+Shift+D     Dashboard
 *   Cmd/Ctrl+Shift+L     Customers & Loans
 *   Cmd/Ctrl+Shift+P     Payments
 *   Cmd/Ctrl+Shift+R     Reporting Center
 *   Cmd/Ctrl+Shift+M     Reminders & Messages
 *   Cmd/Ctrl+Shift+A     Administration
 *   Cmd/Ctrl+Shift+N     New Loan
 * ========================================================================= */
document.addEventListener('keydown', function (e) {
  var tag = document.activeElement ? document.activeElement.tagName : '';
  var isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (document.activeElement && document.activeElement.isContentEditable);
  var mod = e.metaKey || e.ctrlKey;

  // Esc — close whatever dialog is open (all are safe no-ops when nothing is open)
  if (e.key === 'Escape') {
    try { if (typeof closeLoan === 'function') closeLoan(); } catch (x) {}
    try { if (typeof closeSchedule === 'function') closeSchedule(); } catch (x) {}
    try { if (typeof closeDefaultNotice === 'function') closeDefaultNotice(); } catch (x) {}
    try { if (typeof closeRestructure === 'function') closeRestructure(); } catch (x) {}
    try { if (typeof closeDocPreview === 'function') closeDocPreview(); } catch (x) {}
    return;
  }

  // "/" — jump to the search box (only when not already typing in a field)
  if (e.key === '/' && !isTyping && !mod) {
    var s = document.getElementById('globalSearch');
    if (s) { e.preventDefault(); s.focus(); if (s.select) s.select(); }
    return;
  }

  // Navigation needs Cmd/Ctrl + SHIFT (so plain OS shortcuts keep working)
  if (!mod || !e.shiftKey) return;
  var go2 = (typeof go === 'function') ? go : null;
  var k = (e.key || '').toLowerCase();
  var handled = true;
  switch (k) {
    case 'd': if (go2) go2('dash'); break;
    case 'l': if (go2) go2('cust'); break;
    case 'p': if (go2) go2('pay'); break;
    case 'r': if (go2) go2('reports'); break;
    case 'm': if (go2) go2('messages'); break;
    case 'a': if (go2) go2('backup'); break;
    case 'n': if (typeof openLoan === 'function') openLoan(); break;
    default: handled = false;
  }
  if (handled) e.preventDefault();
});
