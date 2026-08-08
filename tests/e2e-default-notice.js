// Proves the redesigned Default Notice: two types only, auto-fill from the loan
// record into the form, the notice reflects those values, and custom saved
// wording is used.
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
    // A realistic loan WITH a schedule (disbursed months ago, nothing paid) so the
    // notice figures come from a live recompute — as they now do in the app.
    loans.splice(0, loans.length,
      { id: 'DN1', name: 'Ramesh Kumar', reltype: 'son of', relname: 'Suresh Kumar', addr: '12 Test Rd, Lucknow',
        phone: '9838100001', acno: 'SE-0009', principal: 100000, rate: 2, tenure: 12,
        tint: 24000, tpay: 124000, emi: 10333, disb: '2026-01-05', paid: 0, payments: [] });

    const typeBtns = document.querySelectorAll('#defTypeSeg button').length;

    renderDefaults();
    defPickBorrower('DN1');            // recomputes loans[0] in place, then fills the form
    const expectedArr = String(Math.round(Number(loans[0].arrears) || 0));
    const expectedArrFmt = (Math.round(Number(loans[0].arrears) || 0)).toLocaleString('en-IN');
    const formName = $('dnName').value;
    const formArr = $('dnArr').value;
    const formAcno = $('dnAcno').value;
    const arrearsIsLive = Number(loans[0].arrears) > 0;   // schedule produced real arrears

    setDnType('demand'); defPreview();
    const html = $('defBody').innerHTML;
    const hasName = html.indexOf('Ramesh Kumar') >= 0;
    const hasAcno = html.indexOf('SE-0009') >= 0;
    const hasArrears = html.indexOf(expectedArrFmt) >= 0;   // the recomputed arrears appears in the notice

    setDnType('final'); defPreview();
    const hasFinal = /FINAL DEMAND NOTICE/.test($('defBody').innerHTML);

    // save custom wording for Demand/English (via the moved Administration editor) and confirm it's used
    initDnTplBox();                       // simulates opening Administration → Notice Wording
    setDnTplType('demand'); setDnTplLang('en');
    $('dnTplText').value = 'CUSTOM: {name} owes {arrears}. {amounts_table}';
    saveDnTpl();
    setDnType('demand'); defPreview();
    const htmlCustom = $('defBody').innerHTML;
    const usesCustom = htmlCustom.indexOf('CUSTOM: Ramesh Kumar owes') >= 0;

    // Printing the notice must not crash (it builds the full letterhead document).
    let printOk = false;
    try { window.print = () => {}; printDefaultDoc(); printOk = true; } catch (e) { printOk = 'ERR:' + e; }

    return { typeBtns, formName, formArr, formAcno, expectedArr, arrearsIsLive, hasName, hasAcno, hasArrears, hasFinal, usesCustom, printOk };
  });

  const checks = {
    'only two notice types (Demand + Final)': out.typeBtns === 2,
    'auto-fill loads name from loan':          out.formName === 'Ramesh Kumar',
    'auto-fill loads recomputed arrears + A/c': out.formArr === out.expectedArr && out.arrearsIsLive && out.formAcno === 'SE-0009',
    'notice reflects synced values':           out.hasName && out.hasAcno && out.hasArrears,
    'Final Demand renders its title':          out.hasFinal === true,
    'saved custom wording is used':            out.usesCustom === true,
    'printing the notice does not crash':      out.printOk === true,
    'no page errors':                          errs.length === 0
  };

  console.log('\n===== DEFAULT / DEMAND NOTICE =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ NOTICE FORM: FILLS, SYNCS, PRINTS, SAVES WORDING' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
