// Proves (1) load() repairs a corrupt loan book instead of crashing, and
// (2) backups carry a checksum that detects tampering/corruption.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    // ---- schema validation on load ----
    const bad = [null, { name: 'no id' }, { id: 'V1', name: 'Valid', payments: 'notarray', principal: 'abc' }, { id: 'V2', name: 'Two', payments: [{ amount: 5 }] }];
    localStorage.setItem('shivam_loans_v1', JSON.stringify(bad));
    load();
    const v1 = loans.find(l => l.id === 'V1') || {};
    const norm = { len: loans.length, ids: loans.map(l => l.id).sort(), v1PayIsArray: Array.isArray(v1.payments), v1Principal: v1.principal };

    // ---- backup checksum ----
    loans.splice(0, loans.length, { id: 'B1', name: 'One', principal: 1000 }, { id: 'B2', name: 'Two', principal: 2000 });
    const s1 = _backupChecksum(loans);
    const payload = JSON.parse(makeBackupPayload());
    const tampered = loans.slice(); tampered.push({ id: 'B3', name: 'Injected' });
    const s2 = _backupChecksum(tampered);

    return { norm, backup: { count: payload.count, sumPresent: payload.sum != null, sumMatches: payload.sum === s1, tamperDetected: s2 !== s1 } };
  });

  const checks = {
    'junk records dropped (2 valid kept)': out.norm.len === 2 && JSON.stringify(out.norm.ids) === JSON.stringify(['V1', 'V2']),
    'bad payments coerced to array':       out.norm.v1PayIsArray === true,
    'bad numeric coerced to 0':            out.norm.v1Principal === 0,
    'backup records the count':            out.backup.count === 2,
    'backup carries a checksum':           out.backup.sumPresent && out.backup.sumMatches,
    'tampering changes the checksum':      out.backup.tamperDetected === true,
    'no page errors':                      errs.length === 0
  };

  console.log('\n===== DATA INTEGRITY (load repair + backup checksum) =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  console.log('\n  ' + (bad === 0 ? '✅ CORRUPT DATA FAILS SAFE; BACKUPS ARE VERIFIABLE' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
