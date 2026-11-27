// A payment entered on this computer must survive the next sign-in.
//
// Reported: payments and edits entered in the app were gone a few days later
// and had to be typed again, only to vanish again.
//
// How it happened: when an edit could not be uploaded at once (laptop just
// woke, Wi-Fi not up, sign-in token being renewed, app closed straight after
// saving) it waited in the outbox. At the next sign-in the first sync fetched
// every cloud row and, for a loan with a waiting edit, REPLACED the local loan
// with the cloud copy whenever that copy was
//   - this computer's own earlier upload, or
//   - not newer than the version the edit was made on.
// In both cases the cloud copy is OLDER than the waiting edit. The payment
// disappeared from the screen, the next save uploaded the old copy over it,
// and it was gone for good.

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

const ME = 'dev_office', OTHER = 'dev_home';
const before = { id: 'L9', acno: '16289', name: 'Test Borrower', payments: [{ date: '2026-10-05', amount: 5000 }] };
const withPay = { id: 'L9', acno: '16289', name: 'Test Borrower',
  payments: [{ date: '2026-10-05', amount: 5000 }, { date: '2026-11-05', amount: 5000 }] };
const pays = (r) => (r.loans.find((l) => l.id === 'L9') || { payments: [] }).payments.length;

// 1. this computer's own earlier upload comes back at sign-in
let r = merge([withPay], [{ id: 'L9', data: before, deleted: false, updated_at: '2026-11-01T09:00:00Z', updated_by: ME }],
  null, { L9: { base: '2026-11-01T09:00:00Z', data: withPay } }, ME);
chk('own older upload does not wipe the waiting payment', pays(r), 2);
chk('  and it is not reported as a conflict', r.conflicts.length, 0);

// 2. cloud copy (from the other computer) is the same version the edit was made on
r = merge([withPay], [{ id: 'L9', data: before, deleted: false, updated_at: '2026-11-01T09:00:00Z', updated_by: OTHER }],
  null, { L9: { base: '2026-11-01T09:00:00Z', data: withPay } }, ME);
chk('a cloud copy no newer than the edit does not wipe it', pays(r), 2);
chk('  no conflict', r.conflicts.length, 0);

// 3. the other computer really did change it afterwards -> both kept, owner asked
const theirs = Object.assign({}, before, { phone: '9000000000' });
r = merge([withPay], [{ id: 'L9', data: theirs, deleted: false, updated_at: '2026-11-03T09:00:00Z', updated_by: OTHER }],
  null, { L9: { base: '2026-11-01T09:00:00Z', data: withPay } }, ME);
chk('a genuine clash keeps our payment', pays(r), 2);
chk('  and is reported', r.conflicts.length, 1);

// 4. with nothing waiting, the cloud copy is still adopted (other computer's work arrives)
r = merge([before], [{ id: 'L9', data: withPay, deleted: false, updated_at: '2026-11-03T09:00:00Z', updated_by: OTHER }],
  null, {}, ME);
chk('no waiting edit: the other computer\'s payment arrives', pays(r), 2);

// 5. the waiting copy is used even if the screen copy was already replaced
r = merge([before], [{ id: 'L9', data: before, deleted: false, updated_at: '2026-11-01T09:00:00Z', updated_by: ME }],
  null, { L9: { base: '2026-11-01T09:00:00Z', data: withPay } }, ME);
chk('an edit still in the outbox is put back on screen', pays(r), 2);

// 6. our own old tombstone does not bin a loan we restored and edited
r = merge([withPay], [{ id: 'L9', deleted: true, updated_at: '2026-11-01T09:00:00Z', updated_by: ME }],
  null, { L9: { base: '2026-11-01T09:00:00Z', data: withPay } }, ME);
chk('restored-and-edited loan is not deleted by our old tombstone', pays(r), 2);

// 7. a remote delete with nothing waiting still deletes
r = merge([before], [{ id: 'L9', deleted: true, updated_at: '2026-11-03T09:00:00Z', updated_by: OTHER }], null, {}, ME);
chk('remote delete with nothing waiting still deletes', r.loans.length, 0);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL UNSENT-EDIT CHECKS PASS');
process.exitCode = fails ? 1 : 0;
