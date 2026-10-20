// Expenses shared between devices, one row per entry.
//
// The whole reason this is a table and not a settings key: a settings key is
// one blob rewritten whole, so two devices adding an expense in the same sync
// window would silently lose one. These checks are mostly about proving the
// merge keeps BOTH, and that a deletion does not come back from the dead.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

// A device: its own local expense list, talking to a shared fake `expenses` table.
function makeDevice(cloudRows, localList, opts) {
  opts = opts || {};
  let local = JSON.parse(JSON.stringify(localList || []));
  const ctx = {
    session: opts.signedOut ? null : { access_token: 't' },
    deviceId: opts.deviceId || 'devA',
    loadExpenses: () => JSON.parse(JSON.stringify(local)),
    saveExpenses: (a) => { local = JSON.parse(JSON.stringify(a || [])); },
    api: async (p, o) => {
      if (o && o.method === 'POST') {
        const body = JSON.parse(o.body)[0];
        const ix = cloudRows.findIndex(r => r.id === body.id);
        if (ix >= 0) cloudRows[ix] = body; else cloudRows.push(body);
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => JSON.parse(JSON.stringify(cloudRows)) };
    },
    JSON, Array, Object, String, Date, console,
    window: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(slice('window.cloudPutExpense = async function (exp)') +
                  slice('window.cloudDeleteExpense = async function (id)') +
                  slice('window.pullExpenses = async function ()'), ctx);
  ctx._list = () => local;
  return ctx;
}

const e = (id, amount, date) => ({ id, date: date || '2026-10-01', cat: 'Fuel', note: '', amount });
const ids = d => d._list().map(x => x.id).sort();

(async () => {
  // 1. THE CASE THIS EXISTS FOR: each device adds one, both must survive
  let cloud = [];
  const A = makeDevice(cloud, [e('a1', 500)], { deviceId: 'devA' });
  const B = makeDevice(cloud, [e('b1', 700)], { deviceId: 'devB' });
  await A.pullExpenses();            // A seeds a1
  await B.pullExpenses();            // B sees a1, seeds b1
  await A.pullExpenses();            // A now sees b1
  chk('both devices keep both expenses — A', ids(A), ['a1', 'b1']);
  chk('both devices keep both expenses — B', ids(B), ['a1', 'b1']);
  chk('cloud holds exactly two rows', cloud.length, 2);

  // 2. a delete on one device must propagate, not resurrect
  await B.cloudDeleteExpense('a1');
  await A.pullExpenses();
  chk('deletion reaches the other device', ids(A), ['b1']);
  await A.pullExpenses();            // run again: must not seed a1 back
  chk('deleted entry is not re-seeded', ids(A), ['b1']);

  // 3. an edited amount is adopted
  cloud = [{ id: 'x1', data: e('x1', 999), deleted: false }];
  let d = makeDevice(cloud, [e('x1', 100)]);
  await d.pullExpenses();
  chk('edited amount adopted', d._list()[0].amount, 999);

  // 4. pre-existing local-only history is seeded up for the second device
  cloud = [];
  d = makeDevice(cloud, [e('old1', 10), e('old2', 20)]);
  await d.pullExpenses();
  chk('back history pushed to cloud', cloud.map(r => r.id).sort(), ['old1', 'old2']);
  chk('  and marked not-deleted', cloud.every(r => r.deleted === false), true);

  // 5. results come back sorted by date, so the P&L list is not shuffled
  cloud = [
    { id: 'z', data: e('z', 1, '2026-12-01'), deleted: false },
    { id: 'y', data: e('y', 1, '2026-01-01'), deleted: false },
  ];
  d = makeDevice(cloud, []);
  await d.pullExpenses();
  chk('merged list is date ordered', d._list().map(x => x.date), ['2026-01-01', '2026-12-01']);

  // 6. signed out: every call is a silent no-op, nothing is lost locally
  cloud = [];
  d = makeDevice(cloud, [e('keep', 50)], { signedOut: true });
  chk('pull while signed out', await d.pullExpenses(), false);
  chk('put while signed out', (await d.cloudPutExpense(e('n', 1))).ok, false);
  chk('delete while signed out', (await d.cloudDeleteExpense('n')).ok, false);
  chk('  local list untouched', ids(d), ['keep']);

  // 7. junk rows must not corrupt the local list
  cloud = [{ id: 'ok', data: e('ok', 5), deleted: false }, { id: 'bad', data: null, deleted: false }, { bogus: true }];
  d = makeDevice(cloud, []);
  await d.pullExpenses();
  chk('junk rows skipped, good row kept', ids(d), ['ok']);

  // 8. a put with no id is refused rather than writing a broken row
  cloud = [];
  d = makeDevice(cloud, []);
  chk('put with no id refused', (await d.cloudPutExpense({ amount: 5 })).ok, false);
  chk('  nothing written', cloud.length, 0);

  console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL EXPENSE-SYNC CHECKS PASS');
  process.exitCode = fails ? 1 : 0;
})();
