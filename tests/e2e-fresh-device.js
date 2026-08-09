// Proves the fresh-device fix: a device with NO local users that DOES have a saved
// cloud session adopts the shared roster and shows "Sign in" (login) instead of
// "Set up" (which used to wrongly create a brand-new admin). A device with no saved
// session (cloudPeekRoster -> null) still falls back to setup.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(async () => {
    // ---- Case A: fresh device WITH a saved cloud session that has a roster ----
    saveUsers([]);                                  // no local users (brand-new install)
    currentUser = null;
    window.cloudPeekRoster = async function () {
      return [
        { user: 'admin',   name: 'Achintya', role: 'admin',   hash: 'HA' },
        { user: 'ramesh',  name: 'Ramesh',   role: 'manager', hash: 'HR' }
      ];
    };
    initLock();
    await new Promise(r => setTimeout(r, 250));      // let the async roster peek resolve
    const usersA = loadUsers();
    const adoptedLogin = (typeof authMode !== 'undefined') && authMode === 'login';
    const gotUsers = usersA.length === 2;
    const ramesh = usersA.find(u => u.user === 'ramesh');
    const rameshManager = ramesh && ramesh.role === 'manager' && ramesh.hash === 'HR';

    // ---- Case B: fresh device with NO saved session (peek returns null) -> setup ----
    saveUsers([]);
    currentUser = null;
    window.cloudPeekRoster = async function () { return null; };
    initLock();
    await new Promise(r => setTimeout(r, 250));
    const stillSetup = (typeof authMode !== 'undefined') && authMode === 'setup';
    const noUsersB = loadUsers().length === 0;

    return { adoptedLogin, gotUsers, rameshManager, stillSetup, noUsersB };
  });

  const checks = {
    'saved-session device adopts roster -> login': out.adoptedLogin === true,
    'roster users added locally with hashes':      out.gotUsers === true && out.rameshManager === true,
    'no-session device falls back to setup':       out.stillSetup === true,
    'no-session device creates no users yet':      out.noUsersB === true,
    'no page errors':                              errs.length === 0
  };

  console.log('\n===== FRESH-DEVICE ROSTER ADOPT =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ FRESH DEVICE SIGNS IN INSTEAD OF MAKING A NEW ADMIN' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
