// Firm details shared between devices through the `firm` key in app_settings.
//
// The dangerous failure here is not "it didn't sync" — it is a device coming
// online after a week and quietly overwriting details edited this morning, so
// every document silently prints a stale address. These checks are mostly
// about the timestamp rule that prevents that.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '24-firm-details.js'), 'utf8');

// Lift a declaration out of the source by brace matching, so the test runs the
// exact shipped code rather than a re-typed copy.
function slice(decl) {
  const i = src.indexOf(decl);
  if (i < 0) throw new Error('not found in source: ' + decl);
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

// A sandbox with a fake localStorage and a fake cloud.
function makeDevice(cloud, localFirm, localStamp) {
  const store = {};
  if (localFirm !== undefined) store['shivam_firm_v1'] = JSON.stringify(localFirm);
  if (localStamp !== undefined) store['shivam_firm_at_v1'] = String(localStamp);
  const ctx = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    cloudGetSetting: async () => (cloud.row ? { data: cloud.row } : null),
    cloudSetSetting: async (key, data) => { cloud.row = data; return { ok: true }; },
    document: { getElementById: () => null },
    Number, Date, JSON, isFinite, console,
  };
  vm.createContext(ctx);
  vm.runInContext(
    'var FIRM_AT_KEY = "shivam_firm_at_v1";\n' +
    slice('function _firmStamp()') + '\n' +
    slice('function _setFirmStamp(at)') + '\n' +
    slice('async function publishFirmDetails(firmOrNull, at)') + '\n' +
    slice('async function pullFirmDetails()') + '\n', ctx);
  ctx._store = store;
  return ctx;
}

const A = { name: 'SHIVAM ENTERPRISES', address: 'D-295, D-Block, Indira Nagar, Lucknow', phones: '9559561162, 9839125800' };
const B = { name: 'SHIVAM ENTERPRISES', address: 'NEW ADDRESS', phones: '9559561162' };
const firmOf = d => { const v = d._store['shivam_firm_v1']; return v ? JSON.parse(v) : null; };

(async () => {
  // 1. fresh second device with nothing local adopts the cloud copy
  let cloud = { row: { firm: A, at: 1000 } };
  let d = makeDevice(cloud);
  chk('fresh device adopts cloud firm', await d.pullFirmDetails(), true);
  chk('  and stores it', firmOf(d), A);

  // 2. cloud is OLDER than this device's own edit -> must NOT overwrite
  cloud = { row: { firm: A, at: 1000 } };
  d = makeDevice(cloud, B, 5000);
  chk('stale cloud does not clobber a newer local edit', await d.pullFirmDetails(), false);
  chk('  local edit survives', firmOf(d), B);

  // 3. cloud is NEWER -> adopt
  cloud = { row: { firm: B, at: 9000 } };
  d = makeDevice(cloud, A, 5000);
  chk('newer cloud is adopted', await d.pullFirmDetails(), true);
  chk('  local now matches cloud', firmOf(d), B);

  // 4. identical timestamps -> no change (avoids pointless rewrites on every poll)
  cloud = { row: { firm: B, at: 5000 } };
  d = makeDevice(cloud, A, 5000);
  chk('equal timestamp is not adopted', await d.pullFirmDetails(), false);

  // 5. a RESET on the other device must reach this one
  cloud = { row: { firm: null, at: 9000 } };
  d = makeDevice(cloud, A, 5000);
  chk('reset propagates', await d.pullFirmDetails(), true);
  chk('  local firm cleared, so defaults apply', firmOf(d), null);

  // 6. publishing writes both the firm and the stamp
  cloud = { row: null };
  d = makeDevice(cloud);
  chk('publish succeeds', await d.publishFirmDetails(B, 7777), true);
  chk('  cloud holds firm + timestamp', cloud.row, { firm: B, at: 7777 });

  // 7. round trip: publish from one device, pull on the other
  cloud = { row: null };
  const dev1 = makeDevice(cloud, A, 100);
  await dev1.publishFirmDetails(B, 8888);
  const dev2 = makeDevice(cloud, A, 100);
  chk('second device picks up the change', await dev2.pullFirmDetails(), true);
  chk('  both devices now agree', firmOf(dev2), B);

  // 8. offline / no cloud helpers -> silent no-op, never throws
  const offline = makeDevice({ row: null });
  offline.cloudGetSetting = undefined;
  offline.cloudSetSetting = undefined;
  vm.runInContext('var _r1 = null, _r2 = null;', offline);
  chk('pull with no cloud is safe', await offline.pullFirmDetails(), false);
  chk('publish with no cloud is safe', await offline.publishFirmDetails(A, 1), false);

  // 9. junk in the cloud must not corrupt local details
  cloud = { row: 'not an object' };
  d = makeDevice(cloud, A, 100);
  chk('junk cloud payload ignored', await d.pullFirmDetails(), false);
  chk('  local details intact', firmOf(d), A);

  console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL FIRM-SYNC CHECKS PASS');
  process.exitCode = fails ? 1 : 0;
})();
