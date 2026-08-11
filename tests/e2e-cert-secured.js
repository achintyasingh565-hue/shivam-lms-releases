// Proves: (1) the No Dues certificate & receipt show the loan amount and the
// Secured/Unsecured status, (2) a secured loan adds the "property/mortgage papers
// handed back" line on both, in English and Hindi, and (3) the loan-closing
// WhatsApp message shows the disbursed amount (principal - deductions) with the A/C no.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    const $ = id => document.getElementById(id);

    // A secured loan of Rs 30,000 with Rs 1,200 deductions -> Rs 28,800 disbursed.
    const secured = { id: 'S1', name: 'Savitri Devi', acno: 'SE-9001', phone: '9838100001',
      reltype: 'wife of', relname: 'Virendra Kumar Singh',
      type: 'Mortgage', secured: true, principal: 30000, deductions: 1200, rate: 2, tenure: 12,
      tint: 7200, tpay: 37200, emi: 3100, disb: '2026-01-05', paid: 0, payments: [] };
    loans.splice(0, loans.length, secured);

    // ---- Certificate / receipt, English ----
    refreshLoanDropdown();
    $('loadLoan').value = 'S1';
    loadFromLoan();                 // fills the cert form from the loan
    const formAmount = $('f_amount').value;
    const formSecured = $('f_secured').value;
    const certAmount = $('c_t_amount').textContent;
    const certSecured = $('c_t_secured').textContent;
    const rcptAmount = $('r_t_amount').textContent;
    const rcptSecured = $('r_t_secured').textContent;
    const certNoteShown = $('c_secnote').style.display !== 'none';
    const rcptNoteShown = $('r_secnote').style.display !== 'none';
    const certNoteText = $('c_secnote').textContent;
    const certRel = $('c_rel').textContent;               // relation now shown on the certificate
    const rcptRel = $('r_rel').textContent;               // and on the receipt

    // ---- Hindi: labels + note translate ----
    setCertLang('hi');
    const certSecuredHi = $('c_t_secured').textContent;
    const noteHiOk = /संपत्ति|बंधक/.test($('c_secnote').textContent) && $('c_secnote').style.display !== 'none';
    setCertLang('en');

    // ---- Unsecured hides the handover note ----
    $('f_secured').value = 'no'; updateCert();
    const noteHiddenWhenUnsecured = $('c_secnote').style.display === 'none' && $('r_secnote').style.display === 'none';
    const unsecuredLabel = $('c_t_secured').textContent;

    // ---- Loan-closing WhatsApp message shows disbursed amount + A/C no ----
    loans.splice(0, loans.length, Object.assign({}, secured, { outstanding: 0, status: 'Closed',
      payments: [{ amount: 37200, mode: 'Cash', status: 'Cleared', date: '2026-06-05' }] }));
    $('grType').value = 'closed'; $('grLang').value = 'en'; $('grWho').value = 'active';
    renderGreetings();
    const gl = (window._grList || [])[0] || {};
    const closedMsg = gl.msg || '';
    // Meta template variable list for Loan Closed must be 3 params (name, acno,
    // disbursed) so the Cloud API send matches a 3-placeholder approved template.
    const waClosed = (typeof loadWaTpl === 'function') ? (loadWaTpl()['Loan Closed'] || {}) : {};
    const waClosedVars = waClosed.vars || '';
    // the 3rd variable resolves to a real value (the loan amount)
    const closedVarVals = (gl.vars || {});

    return {
      certRel, rcptRel,
      waClosedVars, closedDisbursedVal: closedVarVals.disbursed || '',
      formAmount, formSecured, certAmount, certSecured, rcptAmount, rcptSecured,
      certNoteShown, rcptNoteShown, certNoteText, certSecuredHi, noteHiOk,
      noteHiddenWhenUnsecured, unsecuredLabel, closedMsg
    };
  });

  const checks = {
    'cert form auto-fills amount + secured':      out.formAmount === '30000' && out.formSecured === 'yes',
    'certificate shows the relation (wife of X)': /wife of Virendra Kumar Singh/.test(out.certRel),
    'receipt shows the relation (wife of X)':     /wife of Virendra Kumar Singh/.test(out.rcptRel),
    'certificate shows Rs 30,000 + Secured':      /30,000/.test(out.certAmount) && /Secured/.test(out.certSecured),
    'receipt shows Rs 30,000 + Secured':          /30,000/.test(out.rcptAmount) && /Secured/.test(out.rcptSecured),
    'secured handover note shown on both':        out.certNoteShown === true && out.rcptNoteShown === true,
    'handover note mentions property papers':     /property\s*\/\s*mortgage papers/i.test(out.certNoteText),
    'Hindi translates status + note':             /सुरक्षित|बंधक/.test(out.certSecuredHi) && out.noteHiOk === true,
    'unsecured hides the handover note':          out.noteHiddenWhenUnsecured === true && /Unsecured/.test(out.unsecuredLabel),
    'closing msg shows full amount 30,000 + A/C': /30,000/.test(out.closedMsg) && !/28,800/.test(out.closedMsg) && /SE-9001/.test(out.closedMsg),
    'closing msg has no leftover placeholder':    out.closedMsg.indexOf('{disbursed}') < 0,
    'Meta Loan Closed sends 3 vars (name,acno,disbursed)': out.waClosedVars === 'name,acno,disbursed',
    'the disbursed Meta var carries the amount':   /30,000/.test(out.closedDisbursedVal),
    'no page errors':                             errs.length === 0
  };

  console.log('\n===== NO-DUES SECURED + LOAN AMOUNT + CLOSING DISBURSED =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ SECURED STATUS, AMOUNT & DISBURSED ALL SHOW CORRECTLY' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
