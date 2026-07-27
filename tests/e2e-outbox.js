// Verifies the offline sync outbox queue mechanics (add/dedupe/remove/persist).
// The live retry is exercised against real Supabase; this locks the queue's
// correctness (no id lost, no duplicates, survives a reload).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const step1 = await p.evaluate(() => {
    const o = window.__cloudOutbox;
    if (!o) return { noHook: true };
    localStorage.removeItem('shivam_cloud_pending_del_v1');
    localStorage.removeItem('shivam_cloud_pending_edit_v1');
    o.delAdd('A'); o.delAdd('B'); o.delAdd('A');   // dup A ignored
    o.editAdd('E1'); o.editAdd('E1');              // dup ignored
    o.delRemove('B');                               // remove one
    return { del: o.delLoad(), edit: o.editLoad(),
             lsDel: JSON.parse(localStorage.getItem('shivam_cloud_pending_del_v1') || '[]') };
  });

  // reload — queue must persist
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(400);
  const step2 = await p.evaluate(() => {
    const o = window.__cloudOutbox;
    const del = o.delLoad(), edit = o.editLoad();
    o.delRemove('A'); o.editRemove('E1');          // drain
    return { delAfterReload: del, editAfterReload: edit, delDrained: o.delLoad(), editDrained: o.editLoad() };
  });

  const checks = {
    'hook present':                 !step1.noHook,
    'dedupe + remove (del=[A])':    JSON.stringify(step1.del) === JSON.stringify(['A']),
    'dedupe edits (E1 once)':       JSON.stringify(step1.edit) === JSON.stringify(['E1']),
    'persisted to localStorage':    JSON.stringify(step1.lsDel) === JSON.stringify(['A']),
    'survived reload (del)':        JSON.stringify(step2.delAfterReload) === JSON.stringify(['A']),
    'survived reload (edit)':       JSON.stringify(step2.editAfterReload) === JSON.stringify(['E1']),
    'drains to empty':              step2.delDrained.length === 0 && step2.editDrained.length === 0,
    'no page errors':               errs.length === 0
  };

  console.log('\n===== SYNC OUTBOX QUEUE =====');
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ OUTBOX QUEUE IS CORRECT & PERSISTENT' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
