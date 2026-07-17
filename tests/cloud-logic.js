// Unit tests for the parts of cloud sync that don't need a live server:
// the pure merge/tombstone logic, and the AES-GCM field encryption round-trip.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

// ---- load the pure cloudMergeCompute out of the shipped module -------------
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '20-cloud-sync.js'), 'utf8');
function extractFn(name) {
  const i = src.indexOf('function ' + name + '(');
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); } }
}
const sb = { console };
vm.createContext(sb);
vm.runInContext(extractFn('cloudMergeCompute') + '; this.cloudMergeCompute = cloudMergeCompute;', sb);
const merge = sb.cloudMergeCompute;
vm.runInContext(extractFn('cloudConflictDecision') + '; this.cloudConflictDecision = cloudConflictDecision;', sb);
const decide = sb.cloudConflictDecision;

let pass = 0, fail = 0;
function ok(name, cond, extra) { (cond ? pass++ : fail++); console.log((cond ? '  ok   ' : ' FAIL  ') + name + (extra && !cond ? '  -> ' + extra : '')); }

// T1: a remote NEW loan is added locally
(() => {
  const local = [{ id: 'A', name: 'Anil' }];
  const r = merge(local, [{ id: 'B', data: { id: 'B', name: 'Bina' }, deleted: false, updated_at: '2026-07-01T10:00:00Z' }], d => d);
  ok('remote new loan is added', r.loans.length === 2 && r.loans.some(l => l.id === 'B'));
  ok('maxTs tracked', r.maxTs === '2026-07-01T10:00:00Z');
})();

// T2: a remote EDIT replaces the local copy (last-write-wins)
(() => {
  const local = [{ id: 'A', name: 'Anil', emi: 1000 }];
  const r = merge(local, [{ id: 'A', data: { id: 'A', name: 'Anil', emi: 2000 }, deleted: false, updated_at: '2026-07-02T10:00:00Z' }], d => d);
  ok('remote edit overwrites local', r.loans.length === 1 && r.loans[0].emi === 2000);
})();

// T3: a remote DELETE (tombstone) removes the loan and queues it for the recycle bin
(() => {
  const local = [{ id: 'A', name: 'Anil' }, { id: 'B', name: 'Bina' }];
  const r = merge(local, [{ id: 'A', deleted: true, updated_at: '2026-07-03T10:00:00Z', updated_by: 'dev2' }], d => d);
  ok('remote delete removes loan', r.loans.length === 1 && !r.loans.some(l => l.id === 'A'));
  ok('remote delete queues recycle add', r.recycleAdd.length === 1 && r.recycleAdd[0].id === 'A');
})();

// T4: a remote RESTORE (deleted:false for an id we don't have) re-adds it and lifts it out of recycle
(() => {
  const local = [{ id: 'B', name: 'Bina' }];
  const r = merge(local, [{ id: 'A', data: { id: 'A', name: 'Anil' }, deleted: false, updated_at: '2026-07-04T10:00:00Z' }], d => d);
  ok('remote restore re-adds loan', r.loans.some(l => l.id === 'A'));
  ok('remote restore queues recycle remove', r.recycleRemove.indexOf('A') >= 0);
})();

// T5: an empty batch changes nothing
(() => {
  const local = [{ id: 'A' }, { id: 'B' }];
  const r = merge(local, [], d => d);
  ok('empty batch is a no-op', r.loans.length === 2 && r.recycleAdd.length === 0 && r.recycleRemove.length === 0);
})();

// T6: mixed batch (add + edit + delete) applied together
(() => {
  const local = [{ id: 'A', v: 1 }, { id: 'B', v: 1 }];
  const r = merge(local, [
    { id: 'A', data: { id: 'A', v: 9 }, deleted: false, updated_at: '2026-07-05T09:00:00Z' },
    { id: 'B', deleted: true, updated_at: '2026-07-05T09:01:00Z' },
    { id: 'C', data: { id: 'C', v: 1 }, deleted: false, updated_at: '2026-07-05T09:02:00Z' }
  ], d => d);
  const ids = r.loans.map(l => l.id).sort().join(',');
  ok('mixed batch: A edited, B removed, C added', ids === 'A,C' && r.loans.find(l => l.id === 'A').v === 9, ids);
  ok('mixed batch: maxTs is the latest', r.maxTs === '2026-07-05T09:02:00Z');
})();

// T7: two-device conflict decision (optimistic concurrency)
(() => {
  const DEV = 'dev_me';
  ok('conflict: no server row -> safe', decide(null, '', DEV).ok === true);
  ok('conflict: our own last write -> safe', decide({ updated_by: 'dev_me', updated_at: '2026-07-05T10:00:00Z' }, '2026-07-01T00:00:00Z', DEV).ok === true);
  ok('conflict: other device newer than baseline -> BLOCK', decide({ updated_by: 'dev_other', updated_at: '2026-07-05T10:00:00Z' }, '2026-07-01T00:00:00Z', DEV).ok === false);
  ok('conflict: other device NOT newer than baseline -> safe', decide({ updated_by: 'dev_other', updated_at: '2026-07-01T00:00:00Z' }, '2026-07-01T00:00:00Z', DEV).ok === true);
  ok('conflict: other device, no baseline yet -> BLOCK', decide({ updated_by: 'dev_other', updated_at: '2026-07-05T10:00:00Z' }, '', DEV).ok === false);
  const c = decide({ updated_by: 'dev_other', updated_at: '2026-07-05T10:00:00Z', deleted: true }, '', DEV);
  ok('conflict: result carries who / when / deleted', c.ok === false && c.by === 'dev_other' && c.at === '2026-07-05T10:00:00Z' && c.deleted === true);
})();

// ---- encryption round-trip (mirrors encField/decField in the module) --------
(async () => {
  const enc = new TextEncoder();
  const base = await webcrypto.subtle.importKey('raw', enc.encode('office-secret-2026'), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('shivam-lms-idsalt-v1'), iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  async function encF(txt) { const iv = webcrypto.getRandomValues(new Uint8Array(12)); const ct = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(txt)); const buf = new Uint8Array(iv.length + ct.byteLength); buf.set(iv, 0); buf.set(new Uint8Array(ct), iv.length); return 'enc1:' + Buffer.from(buf).toString('base64'); }
  async function decF(tok) { const bytes = Buffer.from(tok.slice(5), 'base64'); const iv = bytes.slice(0, 12), ct = bytes.slice(12); const pt = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct); return new TextDecoder().decode(pt); }
  const aadhaar = '1234 5678 9012';
  const token = await encF(aadhaar);
  const back = await decF(token);
  ok('Aadhaar encrypts to opaque token', token.startsWith('enc1:') && token.indexOf(aadhaar) < 0);
  ok('Aadhaar decrypts back exactly', back === aadhaar);

  console.log('\n' + (fail ? fail + ' FAILED' : 'ALL ' + pass + ' CLOUD-LOGIC TESTS PASS'));
  process.exitCode = fail ? 1 : 0;
})();
