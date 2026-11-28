// Two things used to live only on the machine that set them:
//
//   * the working settings — late fee, bounce fee, grace days, manual overdue
//     interest and its start date, and the light/dark theme;
//   * every uploaded KYC scan, which sits in this device's IndexedDB.
//
// A replaced or reset laptop therefore came back with the loan book intact and
// the fee rules silently reset to their defaults, and with no scans at all.
// Worse, the "Backup (.json)" button wrote a BARE ARRAY of loans while the
// automatic backup had always written the full payload — so the backup a person
// takes deliberately, before wiping a machine, was the weakest the app produces.
//
// These checks pin all three fixes.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const INIT = R('src/app/15-init-errors.js');
const BK = R('src/app/14-pwa-backup.js');
const CLOUD = R('src/app/20-cloud-sync.js');
const ADM = R('src/views/administration.html');

function extract(src, name) {
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

// a localStorage that behaves like the real one: strings in, strings out
function makeLS(seed) {
  const m = Object.assign({}, seed || {});
  return {
    _m: m,
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; },
  };
}

function sandbox(seed) {
  const ctx = { localStorage: makeLS(seed), JSON, String, Object };
  vm.createContext(ctx);
  const decl = INIT.slice(INIT.indexOf('var SE_SETTING_KEYS'), INIT.indexOf('function makeBackupPayload'));
  vm.runInContext(decl + '\nthis.collect = collectSettings; this.apply = applySettings; this.KEYS = SE_SETTING_KEYS;', ctx);
  return ctx;
}

// ---------------------------------------------------------------------------
console.log('--- which settings travel ---');
{
  const S = sandbox();
  chk('the six the owner asked for, plus the credit-appraisal limits', S.KEYS, [
    'shivam_latefee_v1', 'shivam_bouncefee_v1', 'shivam_lategrace_v1',
    'shivam_ovdint_v1', 'shivam_ovdfrom_v1', 'shivam_theme', 'shivam_appraisal_v1']);
  chk('  the WhatsApp token is NOT among them', S.KEYS.indexOf('shivam_wacfg_v1'), -1);
  chk('  nor the ID-encryption passphrase', S.KEYS.indexOf('shivam_idkey'), -1);
  chk('  nor the user roster', S.KEYS.indexOf('shivam_users_enc'), -1);
}

// ---------------------------------------------------------------------------
console.log('\n--- collect / apply round-trip ---');
{
  const src = sandbox({
    shivam_latefee_v1: '750', shivam_bouncefee_v1: '600', shivam_lategrace_v1: '5',
    shivam_ovdint_v1: '1200', shivam_ovdfrom_v1: '2026-04-01', shivam_theme: 'dark',
    shivam_users_enc: 'SECRET', shivam_idkey: 'KEYSTUFF',
  });
  const bag = src.collect();
  chk('every set value is carried', bag, {
    shivam_latefee_v1: '750', shivam_bouncefee_v1: '600', shivam_lategrace_v1: '5',
    shivam_ovdint_v1: '1200', shivam_ovdfrom_v1: '2026-04-01', shivam_theme: 'dark' });
  chk('  secrets are not swept up', [bag.shivam_users_enc, bag.shivam_idkey], [undefined, undefined]);

  const dst = sandbox({ shivam_latefee_v1: '500' });   // a fresh machine on defaults
  chk('applied count', dst.apply(bag), 6);
  chk('  late fee landed', dst.localStorage.getItem('shivam_latefee_v1'), '750');
  chk('  overdue start date landed', dst.localStorage.getItem('shivam_ovdfrom_v1'), '2026-04-01');
  chk('  theme landed', dst.localStorage.getItem('shivam_theme'), 'dark');
  chk('  round-trips identically', dst.collect(), bag);
}

// ---------------------------------------------------------------------------
console.log('\n--- the shapes the app actually reads ---');
{
  // getLateFeeRate does Number(raw). A JSON-wrapped '"750"' would give NaN and
  // silently fall back to the 500 default — the bug this guards against.
  const dst = sandbox();
  dst.apply({ shivam_latefee_v1: '750' });
  const raw = dst.localStorage.getItem('shivam_latefee_v1');
  chk('stored as a bare string, not JSON', raw, '750');
  chk('  so Number() reads it', Number(raw), 750);
  chk('  (a JSON-wrapped value would be NaN)', Number.isNaN(Number('"750"')), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- absent vs cleared ---');
{
  const dst = sandbox({ shivam_latefee_v1: '500', shivam_ovdint_v1: '900' });
  dst.apply({ shivam_bouncefee_v1: '600' });
  chk('a key not in the bag is left alone', dst.localStorage.getItem('shivam_latefee_v1'), '500');
  dst.apply({ shivam_ovdint_v1: '' });
  chk('an empty string clears it, as the app does', dst.localStorage.getItem('shivam_ovdint_v1'), null);
  chk('rubbish input is a no-op', dst.apply(null), 0);
  chk('  and so is a non-object', dst.apply('nonsense'), 0);
}

// ---------------------------------------------------------------------------
console.log('\n--- the manual backup now matches the automatic one ---');
{
  chk('exportJSON builds from makeBackupObject', /makeBackupObject\(\)/.test(BK), true);
  chk('  it no longer writes a bare loans array',
    /download\('shivam-loans-backup-'\+todayISO\(\)\+'\.json', JSON\.stringify\(loans,null,2\)/.test(BK), false);
  chk('  settings ride in the payload', /settings:collectSettings\(\)/.test(INIT), true);
  chk('  makeBackupObject exists for callers that need to add to it',
    /function makeBackupObject\(\)/.test(INIT), true);
  chk('  the automatic backup path still uses makeBackupPayload',
    /content:makeBackupPayload\(\)/.test(INIT), true);
  chk('the file size is reported to the owner', /mb\.toFixed\(1\)/.test(BK), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- documents are opt-in ---');
{
  chk('the tick-box exists', /id="bkInclDocs"/.test(ADM), true);
  chk('  and is unticked by default', /id="bkInclDocs"[^>]*checked/.test(ADM), false);
  chk('  exportJSON reads it', /\$\('bkInclDocs'\)/.test(BK), true);
  chk('  and only then packs the vault', /withDocs && typeof window\._vaultBackupData==='function'/.test(BK), true);
  chk('  a vault read failure does not lose the records',
    /Could not read the document vault — saving records only/.test(BK), true);
  chk('restore feeds them back through the additive vault restore',
    /window\._vaultRestoreData\(\{docs:extras\.docs\}\)/.test(BK), true);
  chk('  guarded so an old backup without docs is fine',
    /Array\.isArray\(extras\.docs\) && extras\.docs\.length/.test(BK), true);
  chk('the standing warning now explains the tick-box', /Also include scanned documents/.test(ADM), true);
  chk('  and still says scans never reach the cloud', /never synced to the cloud/.test(ADM), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- restore applies settings without JSON-wrapping them ---');
{
  chk('importJSON routes settings through applySettings',
    /extras\.settings && typeof applySettings==='function'/.test(BK), true);
  const seg = BK.slice(BK.indexOf('const put=(k,v)=>'), BK.indexOf('logAudit(\'Backup Restored\''));
  chk('  and NOT through put(), which would stringify them', /put\('shivam_latefee_v1'/.test(seg), false);
}

// ---------------------------------------------------------------------------
console.log('\n--- the cloud snapshot ---');
{
  chk('payload bumped to v3', /var _payload = \{ v: 3, loans: loans \}/.test(CLOUD), true);
  chk('  settings attached, guarded', /typeof collectSettings === 'function'\) _payload\.settings = collectSettings\(\)/.test(CLOUD), true);
  chk('  restore applies them', /_d\.settings && typeof applySettings === 'function'/.test(CLOUD), true);
  // older snapshots must still restore: v2 has no settings key, legacy is a bare array
  // search forward from the restore block — 'recomputeAll' also appears earlier
  const _from = CLOUD.indexOf('var _d = rows[0].data;');
  const seg = CLOUD.slice(_from, CLOUD.indexOf('try { recomputeAll(); }', _from));
  chk('  a legacy bare-array snapshot still loads', /if \(Array\.isArray\(_d\)\) \{ loans = _d; \}/.test(seg), true);
  chk('  a v2 snapshot without settings is unharmed', /_d\.settings &&/.test(seg), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- nothing about the money moved ---');
{
  const { makeSandbox } = require('./harness');
  const S = makeSandbox('2026-06-01');
  const t = S.calcLoanTotals(100000, 2, 10);
  chk('flat interest still P x r x n', t.tint, 20000);
  chk('  EMI still total / tenure', t.emi, 12000);
  const l = { id: 'B', interestOnly: true, principal: 100000, rate: 2, tenure: 0, tpay: 100000, emi: 2000,
              disb: '2026-01-01', charges: [],
              payments: [{ date: '2026-02-01', amount: 2000, status: 'Cleared' }] };
  S.recomputeLoan(l);
  chk('  byaj principal still untouched by interest', l.outstanding, 100000);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
