// Unlimited IDs: multi-ID save, per-type validation (fixes the PAN-validates-Aadhaar
// bug), migration of legacy records, and customer-record labels by actual type.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(async () => {
    const $ = id => document.getElementById(id);
    window.print = () => {}; window.confirm = () => true; window.alert = () => {};
    let toastMsg = ''; const _t = window.toast; window.toast = m => { toastMsg += ' ' + m; if (_t) try { _t(m); } catch (e) {} };
    const fillCore = (acno, nm) => { $('m_name').value = nm || 'Multi Id'; $('m_acno').value = acno || 'MID-1'; $('m_phone').value = '9839125800';
      $('m_principal').value = '100000'; $('m_rate').value = '2'; $('m_tenure').value = '12'; $('m_disb').value = '2026-01-01'; recalc(); };

    // ---- T1: three IDs save into rec.ids + mirrors ----
    loans.splice(0, loans.length);
    openLoan(null); fillCore();
    addIdRow(); idRowType(0, 'Aadhaar'); idRowNum(0, '721585602980');
    addIdRow(); idRowType(1, 'PAN');     idRowNum(1, 'JXBPK7550J');
    addIdRow(); idRowType(2, 'Voter Card'); idRowNum(2, 'UP1234567');
    toastMsg = ''; await saveLoan();
    const s = loans.find(l => l.acno === 'MID-1');
    const T1 = { count: (s && s.ids || []).length, idproof: s && s.idproof, idtype: s && s.idtype, pan: s && s.pan,
      voter: s && (s.ids || []).some(x => x.t === 'Voter Card' && x.n === 'UP1234567'),
      noError: toastMsg.indexOf('should look like') < 0 };

    // ---- T2: PAN row with a bad value is caught as PAN (not Aadhaar); good pair saves clean ----
    loans.splice(0, loans.length);
    openLoan(null); fillCore('MID-2', 'Bad Pan');
    addIdRow(); idRowType(0, 'Aadhaar'); idRowNum(0, '721585602980');
    addIdRow(); idRowType(1, 'PAN');     idRowNum(1, '12345');           // invalid PAN
    toastMsg = ''; await saveLoan();
    const blockedBadPan = /PAN should look like/.test(toastMsg) && !loans.some(l => l.acno === 'MID-2');
    // fix the PAN and confirm it now saves with NO cross-validation error (the original bug)
    idRowNum(1, 'JXBPK7550J'); toastMsg = ''; await saveLoan();
    const savesAfterFix = !/should look like/.test(toastMsg) && loans.some(l => l.acno === 'MID-2');
    const T2 = { blockedBadPan, savesAfterFix };

    // ---- T3: a legacy record (idtype/idproof + pan, no ids) migrates into the list ----
    loans.splice(0, loans.length, { id: 'LEG1', name: 'Legacy', acno: 'LEG-1', phone: '9838100000',
      idtype: 'Aadhaar', idproof: '7215 8560 2980', pan: 'JXBPK7550J', principal: 50000, rate: 2, tenure: 12,
      tpay: 62000, emi: 5167, disb: '2026-01-01', payments: [] });
    openLoan('LEG1');
    const rows = document.querySelectorAll('#m_idlist .id-row').length;
    const migrated = _collectIds();
    const T3 = { rows, count: migrated.ids.length,
      hasAadhaar: migrated.ids.some(x => x.t === 'Aadhaar' && x.n === '7215 8560 2980'),
      hasPan: migrated.ids.some(x => x.t === 'PAN' && x.n === 'JXBPK7550J') };
    closeLoan();

    // ---- T4: customer record labels each ID by its type, not a generic "ID" ----
    loans.splice(0, loans.length);
    openLoan(null); fillCore();
    addIdRow(); idRowType(0, 'Aadhaar'); idRowNum(0, '721585602980');
    addIdRow(); idRowType(1, 'PAN');     idRowNum(1, 'JXBPK7550J');
    await saveLoan();
    const cust = buildCustomers().find(c => c.name === 'Multi Id');
    // render the profile and inspect the labels
    let html = '';
    try { openCustomer(encodeURIComponent(cust.key)); html = ($('custProfile') || {}).innerHTML || document.body.innerHTML; } catch (e) {}
    const T4 = { custHasIds: !!(cust && cust.ids && cust.ids.length === 2),
      labelsByType: html.indexOf('>Aadhaar<') >= 0 && html.indexOf('>PAN<') >= 0,
      noGenericId: html.indexOf('>ID</label>') < 0 };

    return { T1, T2, T3, T4 };
  });

  const checks = {
    'three IDs saved with mirrors':        out.T1.count === 3 && out.T1.idproof === '721585602980' && out.T1.pan === 'JXBPK7550J' && out.T1.idtype === 'Aadhaar' && out.T1.voter,
    'valid Aadhaar+PAN save w/o error':    out.T1.noError === true,
    'bad PAN caught as PAN (not Aadhaar)':  out.T2.blockedBadPan === true,
    'saves once PAN fixed (bug gone)':      out.T2.savesAfterFix === true,
    'legacy record migrates to list':       out.T3.rows === 2 && out.T3.count === 2 && out.T3.hasAadhaar && out.T3.hasPan,
    'customer record labels by type':       out.T4.custHasIds && out.T4.labelsByType && out.T4.noGenericId,
    'no page errors':                       errs.length === 0
  };
  console.log('\n===== UNLIMITED IDs =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ IDs: MULTIPLE, VALIDATED PER TYPE, MIGRATED, LABELLED' : '❌ ' + bad + ' PROBLEM(S)') + '\n');
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
