// A retried delete must keep the record, not blank it.
//
// pendingDelAdd stored only the loan id. On retry flushPendingDeletes called
// pushDelete(id, {id}) and that upsert REPLACED the cloud row's data with an
// id-only object. The other device's Recycle Bin then held a tombstone with no
// borrower, no account number and no payment history — nothing to restore.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '20-cloud-sync.js'), 'utf8');
function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

const LOAN = { id: 'L1', name: 'Rajguru Tiwari', acno: '16286', principal: 120000,
               payments: [{ id: 'p1', date: '2026-03-01', amount: 7400, status: 'Cleared' }] };

function makeOutbox() {
  const store = {};
  const ctx = {
    PENDING_DEL_STORE: 'shivam_cloud_pending_del_v1',
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    },
    loans: [],
    JSON, Object, Array, String, Number, console,
  };
  vm.createContext(ctx);
  vm.runInContext([extract('_pendLoad'), extract('_pendSave'),
                   extract('pendingDelLoad'), extract('pendingDelAdd'),
                   extract('pendingDelRemove')].join('\n'), ctx);
  ctx._store = store;
  return ctx;
}

// --- a failed delete keeps the whole record
let ob = makeOutbox();
ob.pendingDelAdd('L1', LOAN);
let queued = ob.pendingDelLoad();
chk('one entry queued', queued.length, 1);
chk('  it keeps the borrower name', queued[0].data.name, 'Rajguru Tiwari');
chk('  the account number', queued[0].data.acno, '16286');
chk('  and the payment history', queued[0].data.payments.length, 1);

// --- queueing the same id twice must not blank an existing snapshot
ob.pendingDelAdd('L1', null);
queued = ob.pendingDelLoad();
chk('a second attempt does not overwrite the snapshot', queued.length, 1);
chk('  the record survives', queued[0].data.name, 'Rajguru Tiwari');

// --- removal works on the object form
ob.pendingDelRemove('L1');
chk('removing by id clears the entry', ob.pendingDelLoad().length, 0);

// --- legacy bare-id entries still load and can be removed
ob = makeOutbox();
ob._store['shivam_cloud_pending_del_v1'] = JSON.stringify(['OLD1']);
chk('a legacy bare id still loads', ob.pendingDelLoad(), ['OLD1']);
ob.pendingDelRemove('OLD1');
chk('  and can be removed', ob.pendingDelLoad().length, 0);

// --- the retry must send data, not {id}
const flush = src.slice(src.indexOf('async function flushPendingDeletes()'),
                        src.indexOf('async function flushPendingDeletes()') + 800);
chk('the retry no longer hardcodes an id-only payload', /pushDelete\(a\[i\], \{ id: a\[i\] \}\)/.test(flush), false);
chk('  it prefers the stored snapshot', /e\.data/.test(flush), true);
chk('  and falls back to the live record', /loans \|\| \[\]\)\.find/.test(flush), true);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL DELETE-OUTBOX CHECKS PASS');
process.exitCode = fails ? 1 : 0;
