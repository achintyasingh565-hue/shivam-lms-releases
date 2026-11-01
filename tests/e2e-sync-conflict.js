// An offline edit must survive a remote edit of the same loan.
//
// The pending-edit queue used to store only loan IDs. On reconnect the poll ran
// first: cloudMergeCompute replaced the local loan with the remote version, and
// flushPendingEdits then looked the ID up in `loans` and re-sent whatever it
// found — which was now the OTHER device's row. The offline edit vanished, and
// the outbox cheerfully pushed the other device's copy back up as if it were
// ours. No warning, no trace.
//
// Sequence under test:
//   1. Device A edits a loan offline      -> queued with a baseline
//   2. Device B edits the same loan       -> server row moves past that baseline
//   3. A reconnects and pulls B's version
//   4. A's edit must still be there, and the clash must be reported

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
const ctx = { JSON, Object, Array, String, Number, Math, console };
vm.createContext(ctx);
vm.runInContext(extract('cloudMergeCompute') + '\nthis.merge = cloudMergeCompute;', ctx);
const merge = ctx.merge;

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

const A = 'device-A', B = 'device-B';
const base = { id: 'L1', name: 'Rajguru Tiwari', acno: '16286', principal: 120000, phone: '9000000001' };

// --- 1. the reported case: both devices edited, A's edit is still queued
const aEdit = Object.assign({}, base, { phone: '9111111111' });       // A, offline
const bRow  = { id: 'L1', updated_at: '2026-11-01T10:00:00Z', updated_by: B,
                data: Object.assign({}, base, { phone: '9222222222' }) };
let res = merge([aEdit], [bRow], null,
                { L1: { base: '2026-10-01T00:00:00Z', data: aEdit } }, A);

chk('A\'s offline edit is NOT overwritten', res.loans[0].phone, '9111111111');
chk('the clash is reported', res.conflicts.length, 1);
chk('  as both-edited', res.conflicts[0].kind, 'both-edited');
chk('  naming the other device', res.conflicts[0].by, B);
chk('  keeping OUR version', res.conflicts[0].local.phone, '9111111111');
chk('  and THEIR version, so neither is lost', res.conflicts[0].remote.phone, '9222222222');

// --- 2. no pending edit -> the remote version simply wins, as before
res = merge([base], [bRow], null, {}, A);
chk('without a pending edit the remote version is adopted', res.loans[0].phone, '9222222222');
chk('  and nothing is flagged', res.conflicts.length, 0);

// --- 3. the remote row is OUR OWN earlier upload coming back -> not a conflict
const mineBack = { id: 'L1', updated_at: '2026-11-01T10:00:00Z', updated_by: A,
                   data: Object.assign({}, base, { phone: '9111111111' }) };
res = merge([aEdit], [mineBack], null,
            { L1: { base: '2026-10-01T00:00:00Z', data: aEdit } }, A);
chk('our own write echoing back is not a conflict', res.conflicts.length, 0);

// --- 4. the server row is NOT newer than our baseline -> not a conflict
const stale = { id: 'L1', updated_at: '2026-09-01T00:00:00Z', updated_by: B, data: base };
res = merge([aEdit], [stale], null,
            { L1: { base: '2026-10-01T00:00:00Z', data: aEdit } }, A);
chk('a server row older than our baseline is not a conflict', res.conflicts.length, 0);

// --- 5. they deleted it while we edited it offline
const del = { id: 'L1', updated_at: '2026-11-01T10:00:00Z', updated_by: B, deleted: true };
res = merge([aEdit], [del], null,
            { L1: { base: '2026-10-01T00:00:00Z', data: aEdit } }, A);
chk('a remote delete does not silently bin our edited loan', res.loans.length, 1);
chk('  and is reported', res.conflicts[0].kind, 'deleted-remotely');

// a remote delete with NO pending edit still deletes normally
res = merge([base], [del], null, {}, A);
chk('a remote delete with no pending edit still removes the loan', res.loans.length, 0);
chk('  and goes to the recycle bin', res.recycleAdd.length, 1);

// --- 6. legacy queue entries (bare id, no baseline) must stay safe
res = merge([aEdit], [bRow], null, { L1: { base: '', data: null } }, A);
chk('a legacy queue entry with no baseline is treated as a conflict', res.conflicts.length, 1);
chk('  and still keeps our copy', res.loans[0].phone, '9111111111');

// --- 7. untouched loans flow through as before
const other = { id: 'L2', name: 'Lallu Singh', acno: '16237' };
const otherRow = { id: 'L2', updated_at: '2026-11-01T10:00:00Z', updated_by: B,
                   data: Object.assign({}, other, { name: 'Lallu Singh Jr' }) };
res = merge([aEdit, other], [bRow, otherRow], null,
            { L1: { base: '2026-10-01T00:00:00Z', data: aEdit } }, A);
chk('a loan with no pending edit still takes the remote version',
  res.loans.find(l => l.id === 'L2').name, 'Lallu Singh Jr');
chk('  while the conflicted one keeps ours',
  res.loans.find(l => l.id === 'L1').phone, '9111111111');
chk('  exactly one conflict', res.conflicts.length, 1);

// --- 8. a brand-new remote loan is still added
res = merge([], [otherRow], null, {}, A);
chk('a new remote loan is added', res.loans.length, 1);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL SYNC-CONFLICT CHECKS PASS');
process.exitCode = fails ? 1 : 0;
