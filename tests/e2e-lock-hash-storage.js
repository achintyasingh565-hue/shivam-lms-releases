// No password hash may sit in plaintext localStorage.
//
// The account roster is encrypted with the OS keychain (safeStorage) precisely
// so that someone who copies the app profile cannot attack it offline. But the
// admin's hash was ALSO mirrored into shivam_lock_v1, which is ordinary
// localStorage — handing a copied profile exactly what the encryption existed
// to protect, and letting an attacker test password guesses at their leisure.
//
// Four places mirrored it (enabling the lock, changing the password, adopting a
// cloud roster, recovery). The stripping is centralised in saveLockCfg so none
// of them can reintroduce it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '13-security-lock.js'), 'utf8');
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

const LOCK_STORE = 'shivam_lock_v1';
const USERS_STORE = 'shivam_users_v1';

function makeApp(seed) {
  const mem = Object.assign({}, seed || {});
  const ctx = {
    LOCK_STORE, USERS_STORE,
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = v; },
      removeItem: (k) => { delete mem[k]; },
    },
    _users: [],
    logAudit: () => {},
    JSON, Object, Array, String, Number, Boolean, console,
  };
  ctx.loadUsers = () => ctx._users;
  vm.createContext(ctx);
  vm.runInContext([extract('lockCfg'), extract('saveLockCfg'),
                   extract('scrubLegacyHash'), extract('isLocked')].join('\n'), ctx);
  ctx._mem = mem;
  return ctx;
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
const HASH = 'sha256$deadbeefcafe';

// --- 1. enabling the lock must not leave a hash behind
let app = makeApp();
app.saveLockCfg({ hash: HASH, touch: false });
let stored = JSON.parse(app._mem[LOCK_STORE]);
chk('enabling the lock stores no hash', stored.hash, undefined);
chk('  the raw JSON contains no hash at all', /deadbeefcafe/.test(app._mem[LOCK_STORE]), false);
chk('  but records that the lock is on', stored.on, true);
chk('  and keeps the Touch ID preference', stored.touch, false);

// --- 2. changing the password must not reintroduce it
app = makeApp();
app.saveLockCfg({ hash: HASH, touch: true });
app.saveLockCfg(Object.assign({}, app.lockCfg(), { hash: 'sha256$newhash' }));
chk('a password change stores no hash', /newhash|deadbeefcafe/.test(app._mem[LOCK_STORE]), false);
chk('  Touch ID survives the change', JSON.parse(app._mem[LOCK_STORE]).touch, true);

// --- 3. the lock still engages without a stored hash
app = makeApp();
app.saveLockCfg({ hash: HASH });
app._users = [];
chk('isLocked() is true from the on-flag alone', app.isLocked(), true);
app._users = [{ user: 'admin', role: 'admin', hash: HASH }];
chk('  and true when the roster is loaded', app.isLocked(), true);

// --- 4. an install with no lock is still unlocked
app = makeApp();
chk('no lock configured -> not locked', app.isLocked(), false);

// --- 5. a legacy plaintext hash is scrubbed once the roster exists
app = makeApp({ [LOCK_STORE]: JSON.stringify({ hash: HASH, touch: true }),
                'shivam_users_enc': 'ENCRYPTED-BLOB' });   // roster already persisted
app._users = [{ user: 'admin', role: 'admin', hash: HASH }];
chk('legacy install starts with a plaintext hash', /deadbeefcafe/.test(app._mem[LOCK_STORE]), true);
app.scrubLegacyHash();
chk('  it is removed after migration', /deadbeefcafe/.test(app._mem[LOCK_STORE]), false);
chk('  the lock stays enabled', JSON.parse(app._mem[LOCK_STORE]).on, true);
chk('  Touch ID preference is preserved', JSON.parse(app._mem[LOCK_STORE]).touch, true);
chk('  and the app is still locked', app.isLocked(), true);

// --- 6. do NOT scrub before the roster has been migrated, or the only copy
//        of the password would be destroyed and the owner locked out
app = makeApp({ [LOCK_STORE]: JSON.stringify({ hash: HASH }) });
app._users = [];
app.scrubLegacyHash();
chk('the hash is kept while the roster is still empty', /deadbeefcafe/.test(app._mem[LOCK_STORE]), true);

// --- 8. the roster is only in memory (encrypted write still in flight):
//        scrubbing now could leave the lock on with no credential at all
app = makeApp({ [LOCK_STORE]: JSON.stringify({ hash: HASH }) });
app._users = [{ user: 'admin', role: 'admin', hash: HASH }];   // cache populated...
// ...but nothing persisted yet
app.scrubLegacyHash();
chk('the hash survives while the roster write is still in flight',
  /deadbeefcafe/.test(app._mem[LOCK_STORE]), true);

// once the encrypted roster is on disk, the scrub proceeds
app._mem['shivam_users_enc'] = 'ENCRYPTED-BLOB';
app.scrubLegacyHash();
chk('  and is removed once the roster is durable', /deadbeefcafe/.test(app._mem[LOCK_STORE]), false);

// a plaintext roster also counts as durable (safeStorage unavailable)
app = makeApp({ [LOCK_STORE]: JSON.stringify({ hash: HASH }),
                'shivam_users_v1': JSON.stringify([{ user: 'admin', hash: HASH }]) });
app._users = [{ user: 'admin', role: 'admin', hash: HASH }];
app.scrubLegacyHash();
chk('a persisted plaintext roster also allows the scrub',
  /deadbeefcafe/.test(app._mem[LOCK_STORE]), false);

// --- 7. no source path writes a hash into the lock store any more
const mirrors = [];
src.split('\n').forEach((L, i) => {
  if (/saveLockCfg\s*\(/.test(L) && /\.hash\s*=|hash\s*:/.test(L) && !/function saveLockCfg/.test(L)) {
    // allowed: the call passes a hash, saveLockCfg strips it. Flag only direct
    // localStorage writes of the lock store carrying a hash.
  }
  if (/localStorage\.setItem\(\s*LOCK_STORE/.test(L) && /hash/.test(L) && !/delete .*hash/.test(L)) {
    mirrors.push(i + 1);
  }
});
chk('no direct plaintext write of the lock store carries a hash', mirrors, []);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL LOCK-HASH-STORAGE CHECKS PASS');
process.exitCode = fails ? 1 : 0;
