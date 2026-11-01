// save() must not stamp the clock when the loan book was not actually written.
//
// When localStorage is full, save() gives up on the loan book but used to write
// shivam_loans_ts_v1 anyway. The IndexedDB mirror got the same timestamp, so on
// the next boot the two looked equally fresh — and bootStore only restores from
// the mirror when it is STRICTLY newer. The stale localStorage book therefore
// won and was copied over the good mirror. Every change since the device filled
// up was lost, silently.
//
// The browser-level reconciliation test (tests/e2e-durability.js) needs
// Playwright; this one exercises the same decision in plain Node.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '01-core-store.js'), 'utf8');
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

const STORE = 'shivam_loans_v1', STORE_TS = 'shivam_loans_ts_v1';

// `full` makes writes of the loan book fail, as a quota error does, while the
// small timestamp key still fits.
function run({ full }) {
  const mem = {};
  const idb = {};
  const ctx = {
    SCHEMA_VERSION: 2,
    loans: [{ id: 'L1', name: 'Rajguru Tiwari', principal: 120000 }],
    STORE, STORE_TS,
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => {
        if (full && (k === STORE || k === 'shivam_backup_snapshot')) {
          const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e;
        }
        mem[k] = v;
      },
      removeItem: (k) => { delete mem[k]; },
    },
    idbSetLoans: (l, ts) => { idb.loans = l; idb.ts = ts; },
    toast: () => {},
    cloudPush: () => {},
    scheduleAutoBackup: () => {},
    window: {},
    JSON, Date, Array, Number, String, Math, console,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(extract('save') + '\nthis.save = save;', ctx);
  ctx.save();
  return { ls: mem, idb };
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// --- normal device: book written, timestamp written, both agree
const ok = run({ full: false });
chk('normal save writes the loan book', !!ok.ls[STORE], true);
chk('  and stamps the timestamp', !!ok.ls[STORE_TS], true);
chk('  the mirror gets the same stamp', String(ok.idb.ts), ok.ls[STORE_TS]);

// --- full device: the book could not be written
const bad = run({ full: true });
chk('a full device does not write the loan book', bad.ls[STORE], undefined);
chk('  and must NOT stamp the timestamp', bad.ls[STORE_TS], undefined);
chk('  the mirror still receives the new book', bad.idb.loans.length, 1);
chk('  and carries a real timestamp', typeof bad.idb.ts, 'number');

// --- the consequence bootStore depends on: mirror strictly newer
const lsTs = Number(bad.ls[STORE_TS] || 0);
chk('mirror timestamp is strictly newer than localStorage', bad.idb.ts > lsTs, true);
// bootStore restores when (localStorage present ? idbTs > lsTs : idbTs >= lsTs)
const lsEmpty = !bad.ls[STORE];
chk('  so bootStore would restore the newer book',
  (lsEmpty ? bad.idb.ts >= lsTs : bad.idb.ts > lsTs), true);

// --- and the old behaviour would NOT have restored it
const staleTs = bad.idb.ts;              // what the buggy version stamped
chk('with the old equal-timestamp behaviour the stale copy would have won',
  staleTs > staleTs, false);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL STORE-TIMESTAMP CHECKS PASS');
process.exitCode = fails ? 1 : 0;
