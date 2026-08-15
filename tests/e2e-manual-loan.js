// Proves manual control over loan records:
//  - a loan can be SAVED with the tenure left blank (unknown), and still records
//    outstanding = total payable so the ledger isn't zeroed;
//  - a hand-typed Monthly EMI / Total Payable is kept (recalc won't overwrite it);
//  - clearing the EMI box hands control back to the auto-calculator.
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
    loans.splice(0, loans.length);
    window.confirm = () => true;                 // auto-accept the "no phone" style prompts

    // ---- 1) Save a loan with NO tenure and a hand-set EMI ----
    openLoan();                                   // new loan (auto A/C no.)
    $('m_name').value = 'Unknown Tenure Cust';
    $('m_phone').value = '9838100001';
    $('m_principal').value = '50000';
    $('m_rate').value = '';                        // rate unknown
    $('m_tenure').value = '';                      // tenure unknown -> used to be blocked
    $('m_emi').value = '5000'; loanFigEdited('emi');   // hand-set EMI
    const acno = $('m_acno').value;
    await saveLoan();
    const saved = loans.find(l => l.acno === acno);
    const savedOk = !!saved;
    const tenureBlankSaved = saved && (Number(saved.tenure) === 0);
    const emiKeptOnSave = saved && Number(saved.emi) === 5000;
    const outstandingNotZero = saved && Number(saved.outstanding) === 50000;   // = total payable (principal, no interest)

    // ---- 2) Manual EMI survives a recalc trigger; clearing it returns to auto ----
    openLoan();
    $('m_principal').value = '100000'; $('m_rate').value = '2'; $('m_tenure').value = '10';
    recalc();
    const autoEmi = Number($('m_emi').value);             // formula EMI
    $('m_emi').value = '9999'; loanFigEdited('emi');        // override
    $('m_principal').value = '120000'; recalc();            // change a driver -> must NOT overwrite EMI
    const emiStayedManual = Number($('m_emi').value) === 9999;
    $('m_emi').value = ''; loanFigEdited('emi');            // clear -> back to auto
    recalc();
    const emiBackToAuto = Number($('m_emi').value) > 0 && Number($('m_emi').value) !== 9999;

    // ---- 2b) A hand-set EMI (no interest rate) drives Total Payable & Outstanding ----
    openLoan();
    $('m_name').value = 'Manual EMI Cust'; $('m_phone').value = '9838100002';
    $('m_principal').value = '800000'; $('m_rate').value = ''; $('m_tenure').value = '60';
    $('m_emi').value = '19500'; loanFigEdited('emi');           // hand-set EMI, no rate
    const tpayFromEmi = Number($('m_tpay').value);              // 19500 * 60 = 1,170,000
    const acno2 = $('m_acno').value;
    await saveLoan();
    const savedEmi = loans.find(l => l.acno === acno2);
    const outFromEmi = savedEmi ? Number(savedEmi.outstanding) : -1;   // = total payable, nothing paid

    // ---- 3) Down payment is subtracted from the net amount disbursed ----
    openLoan();
    $('m_principal').value = '1000000'; $('m_deductions').value = '40000'; $('m_downpay').value = '317000';
    recalc();
    const netDisbursed = Number($('m_remaining').value);        // 1000000 - 40000 - 317000
    // ...but the customer still owes the full loan amount (EMI/outstanding unaffected)
    $('m_rate').value = '2'; $('m_tenure').value = '10'; recalc();
    const owesFull = Number($('m_tpay').value) === 1200000;     // 1000000 + (1000000*2%*10)

    return { savedOk, tenureBlankSaved, emiKeptOnSave, outstandingNotZero, autoEmi, emiStayedManual, emiBackToAuto, netDisbursed, owesFull, tpayFromEmi, outFromEmi };
  });

  const checks = {
    'loan saves with a blank tenure':          out.savedOk === true && out.tenureBlankSaved === true,
    'hand-set EMI is kept on save':            out.emiKeptOnSave === true,
    'outstanding is not zeroed (=principal)':  out.outstandingNotZero === true,
    'formula EMI computed when automatic':     out.autoEmi > 0,
    'manual EMI survives a recalc':            out.emiStayedManual === true,
    'hand-set EMI drives Total Payable':       out.tpayFromEmi === 1170000,
    'hand-set EMI drives Outstanding':         out.outFromEmi === 1170000,
    'clearing EMI returns to auto-calc':       out.emiBackToAuto === true,
    'down payment cuts net disbursed (643000)': out.netDisbursed === 643000,
    'but customer still owes full amount':     out.owesFull === true,
    'no page errors':                          errs.length === 0
  };

  console.log('\n===== MANUAL LOAN CONTROL (tenure optional + EMI override) =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ TENURE OPTIONAL & EMI IS MANUALLY CONTROLLABLE' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
