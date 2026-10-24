// Can the daily cloud backups actually be restored?
//
// There are 56 snapshots sitting in Supabase. A backup nobody has ever restored
// is a hope, not a backup. This runs the REAL cloudRestoreSnapshot() against a
// snapshot payload and checks the book comes back whole — and, just as
// importantly, that a safety snapshot of the CURRENT state is taken first, so a
// restore of the wrong day is itself recoverable.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeSandbox } = require('./harness');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '20-cloud-sync.js'), 'utf8');

function slice(decl) {
  const i = src.indexOf(decl);
  if (i < 0) throw new Error('not found in source: ' + decl);
  let b = src.indexOf('{', i + decl.length - 1), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(i, j + 1) + ';'; }
  }
  throw new Error('unbalanced: ' + decl);
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// A believable book: three loans with payments and a charge.
function book() {
  const mk = (id, name, acno, pays, charges) => ({
    id, name, acno, principal: 120000, tpay: 177600, tint: 57600, tenure: 24,
    emi: 7400, rate: 2, disb: '2026-02-01', due: '2026-03-01',
    payments: pays, charges: charges || [], status: 'Active',
  });
  const p = (d, a) => ({ id: 'p' + d + a, date: d, amount: a, status: 'Cleared' });
  return [
    mk('L1', 'Rajguru Tiwari', '16286', [p('2026-03-01', 7400), p('2026-04-01', 7400)]),
    mk('L2', 'Lallu Singh', '16237', [p('2026-03-01', 7400)], [{ id: 'c1', type: 'Late fee', amount: 500, date: '2026-04-05' }]),
    mk('L3', 'Jameela', '16265', []),
  ];
}

function makeApp(snapshotData, opts) {
  opts = opts || {};
  const ctx = {
    session: opts.signedOut ? null : { access_token: 't' },
    loans: opts.current || [],
    api: async (p) => ({ ok: true, json: async () => (snapshotData === null ? [] : [{ data: snapshotData, day: '2026-10-24' }]) }),
    confirm: () => (opts.decline ? false : true),
    toast: (m) => { ctx._toasts.push(m); },
    snapBefore: (label) => { ctx._safety.push(label); },
    recomputeAll: () => { ctx.loans.forEach(l => ctx._recompute(l)); ctx._recomputed = true; },
    save: () => { ctx._saved = true; },
    rerenderAll: () => { ctx._rerendered = true; },
    logAudit: (a, b) => { ctx._audit.push(a + ':' + b); },
    saveExpenses: (a) => { ctx._expenses = a; },
    localStorage: { getItem: () => null, setItem: (k, v) => { ctx._firm = JSON.parse(v); }, removeItem: () => {} },
    encodeURIComponent, JSON, Number, String, Array, Object, console,
    _toasts: [], _safety: [], _audit: [], _saved: false, _rerendered: false, _recomputed: false,
  };
  ctx.window = ctx;
  ctx._recompute = makeSandbox('2026-10-25').recomputeLoan;
  vm.createContext(ctx);
  vm.runInContext(slice('window.cloudRestoreSnapshot = async function (id)'), ctx);
  return ctx;
}

(async () => {
  const saved = book();

  // 1. the core promise: the whole book comes back
  let app = makeApp(saved, { current: [] });
  await app.cloudRestoreSnapshot('42');
  chk('all three loans restored', app.loans.length, 3);
  chk('borrowers and account numbers intact',
    app.loans.map(l => l.name + '/' + l.acno), ['Rajguru Tiwari/16286', 'Lallu Singh/16237', 'Jameela/16265']);
  chk('payment history intact', app.loans.map(l => (l.payments || []).length), [2, 1, 0]);
  chk('charges intact', app.loans[1].charges[0].amount, 500);

  // 2. figures are RECOMPUTED after restore, not trusted from the snapshot
  chk('recomputeAll ran', app._recomputed, true);
  chk('outstanding recalculated on restored data',
    app.loans.every(l => typeof l.outstanding === 'number' && isFinite(l.outstanding)), true);

  // 3. a safety snapshot of the CURRENT book is taken BEFORE overwriting it,
  //    so restoring the wrong day is itself recoverable
  chk('safety snapshot taken first', app._safety.length, 1);
  chk('  and it is labelled with the day', /Before cloud restore 2026-10-24/.test(app._safety[0]), true);

  // 4. the restore is pushed so the other device receives it
  chk('saved (pushes to the other device)', app._saved, true);
  chk('screens refreshed', app._rerendered, true);
  chk('written to the audit log', app._audit.join(''), 'Cloud Backup Restored:2026-10-24');

  // 5. declining the confirmation must change NOTHING
  const current = book().slice(0, 1);
  app = makeApp(saved, { current: current, decline: true });
  await app.cloudRestoreSnapshot('42');
  chk('declining leaves the book untouched', app.loans.length, 1);
  chk('  nothing saved', app._saved, false);
  chk('  no audit entry', app._audit.length, 0);

  // 6. a missing backup must not wipe the live book
  app = makeApp(null, { current: book() });
  await app.cloudRestoreSnapshot('999');
  chk('missing backup leaves the book intact', app.loans.length, 3);
  chk('  and says so', app._toasts.join(''), 'Backup not found');

  // 7. signed out -> refuses, book untouched
  app = makeApp(saved, { current: book(), signedOut: true });
  await app.cloudRestoreSnapshot('42');
  chk('signed out refuses', app._toasts.join(''), 'Not connected to the cloud');
  chk('  book untouched', app.loans.length, 3);

  // 8. an empty snapshot restores to an empty book rather than throwing
  app = makeApp([], { current: book() });
  await app.cloudRestoreSnapshot('42');
  chk('empty snapshot handled', app.loans.length, 0);

  // 9. LEGACY snapshots (a bare array of loans) must keep restoring — all 56
  //    backups already in Supabase are this shape.
  app = makeApp(saved, { current: [] });
  await app.cloudRestoreSnapshot('42');
  chk('legacy array snapshot still restores', app.loans.length, 3);

  // 10. v2 snapshots also carry the expense register and the firm letterhead,
  //     which the old payload dropped entirely.
  const v2 = { v: 2, loans: saved, expenses: [{ id: 'e1', date: '2026-10-01', cat: 'Fuel', amount: 500 }],
               firm: { name: 'SHIVAM ENTERPRISES', phones: '9559561162, 9839125800' } };
  app = makeApp(v2, { current: [] });
  await app.cloudRestoreSnapshot('42');
  chk('v2 snapshot restores the loan book', app.loans.length, 3);
  chk('  and the expense register', app._expenses.length, 1);
  chk('  and the firm details', app._firm.phones, '9559561162, 9839125800');

  // 11. a v2 snapshot with no extras must not blow up or invent data
  app = makeApp({ v: 2, loans: saved }, { current: [] });
  await app.cloudRestoreSnapshot('42');
  chk('v2 without extras is fine', app.loans.length, 3);
  chk('  expenses left alone', app._expenses, undefined);

  // 12. junk payload must leave an empty book rather than throw
  app = makeApp('not an object', { current: book() });
  await app.cloudRestoreSnapshot('42');
  chk('junk payload handled', app.loans.length, 0);

  console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CLOUD-RESTORE CHECKS PASS');
  process.exitCode = fails ? 1 : 0;
})();
