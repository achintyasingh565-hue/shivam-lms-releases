// Proves the central user-list merge is correct and non-destructive:
//  - a device where "sanidhya" is a self-made Admin gets DEMOTED to Manager to
//    match the owner's roster (case-insensitive), without deleting the account or
//    changing the password, and the signed-in user's live role updates.
//  - a brand-new roster user is added; a local-only account is kept (no lockout).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    // Sanidhya's device state: he's a self-made admin (lowercase username), plus a
    // local-only helper account that isn't in the owner's roster.
    saveUsers([
      { user: 'sanidhya', name: 'Administrator', role: 'admin',   hash: 'HASH_S' },
      { user: 'localguy', name: 'Local Only',    role: 'staff',   hash: 'HASH_L' }
    ]);
    currentUser = { user: 'sanidhya', name: 'Administrator', role: 'admin' };

    // Owner (Achintya) publishes this roster:
    const ownerRoster = [
      { user: 'admin',    name: 'Achintya', role: 'admin',   hash: 'HASH_A' },
      { user: 'Sanidhya', name: 'Sanidhya', role: 'manager', hash: 'HASH_S2' }
    ];
    const changed = applyUserRoster(ownerRoster);

    const users = loadUsers();
    const find = u => users.find(x => x.user.toLowerCase() === u);
    const san = find('sanidhya');
    return {
      changed,
      sanRole: san && san.role,
      sanHashKept: san && san.hash === 'HASH_S',          // password NOT overwritten
      currentRole: currentUser.role,                       // live session demoted
      adminAdded: !!find('admin'),
      localKept: !!find('localguy'),                       // local-only account not deleted
      count: users.length
    };
  });

  const checks = {
    'roster caused a change':                    out.changed === true,
    'sanidhya DEMOTED admin -> manager':         out.sanRole === 'manager',
    'sanidhya password NOT changed':             out.sanHashKept === true,
    'signed-in session role updated live':       out.currentRole === 'manager',
    "owner's admin account added":               out.adminAdded === true,
    'local-only account kept (no lockout)':      out.localKept === true
  };

  console.log('\n===== CENTRAL USER LIST MERGE =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ ROLES SYNC NON-DESTRUCTIVELY ACROSS DEVICES' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
