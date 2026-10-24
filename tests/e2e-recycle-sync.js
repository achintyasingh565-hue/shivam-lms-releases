// Recycle Bin showing loans the OTHER device deleted.
//
// Deliberately a display-time merge: delete and restore are untouched. The
// cloud already holds a deleted loan in full (pushDelete soft-deletes), and
// restoring calls the normal save(), which writes deleted=false upstream.
//
// The risks worth testing are all about a record appearing or vanishing when
// it should not: a live loan listed as deleted, a purge undone by the next
// fetch, or a restore that silently does nothing.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '07-loans-crud.js'), 'utf8');

function slice(decl) {
  const i = src.indexOf(decl);
  if (i < 0) throw new Error('not found: ' + decl);
  let b = src.indexOf('{', i + decl.length - 1), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(i, j + 1); }
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

const DAY = 24 * 60 * 60 * 1000;
function env(localBin, cloudBin, live, purged) {
  const store = {
    'shivam_recycle_v1': JSON.stringify(localBin || []),
    'shivam_recycle_purged_v1': JSON.stringify(purged || []),
  };
  const ctx = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    loans: live || [],
    Date, JSON, Math, console,
    RECYCLE_STORE: 'shivam_recycle_v1',
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    'function recycleLoad(){ try{ return JSON.parse(localStorage.getItem(RECYCLE_STORE)||"[]")||[]; }catch(e){ return []; } }\n' +
    'function recycleSave(a){ try{ localStorage.setItem(RECYCLE_STORE, JSON.stringify(a)); }catch(e){} }\n' +
    'function recyclePurgeOld(){ const cut=Date.now()-30*24*60*60*1000; let arr=recycleLoad(); const keep=arr.filter(x=>(x.deletedAt||0)>=cut); if(keep.length!==arr.length) recycleSave(keep); return keep; }\n' +
    'var _cloudBin = [];\n' +
    "const PURGED_STORE = 'shivam_recycle_purged_v1';\n" +
    slice('function purgedLoad()') + '\n' +
    slice('function purgedAdd(id)') + '\n' +
    slice('function recycleMerged()') + '\n', ctx);
  vm.runInContext('_cloudBin = ' + JSON.stringify(cloudBin || []) + ';', ctx);
  return ctx;
}

const mk = (id, name, days, fromCloud) => ({
  id, name, acno: 'A' + id, deletedAt: Date.now() - (days || 1) * DAY,
  payments: [], charges: [], _fromCloud: !!fromCloud,
});
const ids = c => vm.runInContext('recycleMerged().map(function(x){return x.id;})', c).sort();

// 1. the point of the whole change
chk('a loan deleted on the other device appears in the bin',
  ids(env([], [mk('L2', 'Theirs', 2, true)], [])), ['L2']);

// 2. both devices' deletions show, without duplicates
chk('local + cloud merge',
  ids(env([mk('L1', 'Mine', 1)], [mk('L2', 'Theirs', 2, true)], [])), ['L1', 'L2']);
chk('the same loan in both is listed once',
  ids(env([mk('L1', 'Mine', 1)], [mk('L1', 'Mine', 1, true)], [])), ['L1']);

// 3. a loan that is LIVE must never be listed as deleted — this is the one that
//    would frighten someone: seeing an active borrower in the Recycle Bin
chk('a restored/live loan is not listed',
  ids(env([], [mk('L3', 'Active', 1, true)], [{ id: 'L3', name: 'Active' }])), []);

// 4. "Delete forever" must stick — the next cloud fetch must not resurrect it
chk('a purged loan stays gone',
  ids(env([], [mk('L4', 'Gone', 1, true)], [], ['L4'])), []);

// 5. the 30-day window applies to cloud entries too
chk('cloud entry older than 30 days is dropped',
  ids(env([], [mk('L5', 'Ancient', 40, true)], [])), []);
chk('cloud entry inside the window is kept',
  ids(env([], [mk('L6', 'Recent', 29, true)], [])), ['L6']);

// 6. offline / empty cloud -> behaves exactly as before
chk('no cloud data still shows the local bin',
  ids(env([mk('L7', 'Mine', 1)], [], [])), ['L7']);
chk('nothing anywhere -> empty bin',
  ids(env([], [], [])), []);

// 7. local entries keep their own deletedAt, not the cloud's
const c = env([mk('L8', 'Mine', 5)], [Object.assign(mk('L8', 'Mine', 1, true))], []);
chk('local record wins for a loan in both',
  vm.runInContext('recycleMerged()[0]._fromCloud === true', c), false);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL RECYCLE-SYNC CHECKS PASS');
process.exitCode = fails ? 1 : 0;
