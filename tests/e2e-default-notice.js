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
    loans.splice(0, loans.length,
      { id: 'DN1', name: 'Ramesh Kumar', reltype: 'son of', relname: 'Suresh Kumar', addr: '12 Test Rd, Lucknow',
        phone: '9838100001', acno: 'SE-0009', principal: 100000, tpay: 124000, paid: 0, outstanding: 124000,
        arrears: 24000, due: '2026-06-01', status: 'Overdue' });

    const typeBtns = document.querySelectorAll('#defTypeSeg button').length;

    renderDefaults();
    defPickBorrower('DN1');
    const formName = $('dnName').value;
    const formArr = $('dnArr').value;
    const formAcno = $('dnAcno').value;

    setDnType('demand'); defPreview();
    const html = $('defBody').innerHTML;
    const hasName = html.indexOf('Ramesh Kumar') >= 0;
    const hasAcno = html.indexOf('SE-0009') >= 0;
    const hasArrears = /24,000/.test(html);

    setDnType('final'); defPreview();
    const hasFinal = /FINAL DEMAND NOTICE/.test($('defBody').innerHTML);

    // save custom wording for Demand/English and confirm it's used
    $('dnTplText').value = 'CUSTOM: {name} owes {arrears}. {amounts_table}';
    window._dnType = 'demand'; window._dnLang = 'en'; saveDnTpl();
    setDnType('demand'); defPreview();
    const htmlCustom = $('defBody').innerHTML;
    const usesCustom = htmlCustom.indexOf('CUSTOM: Ramesh Kumar owes') >= 0;

    return { typeBtns, formName, formArr, formAcno, hasName, hasAcno, hasArrears, hasFinal, usesCustom };
  });

  const checks = {
    'only two notice types (Demand + Final)': out.typeBtns === 2,
    'auto-fill loads name from loan':          out.formName === 'Ramesh Kumar',
    'auto-fill loads arrears + A/c':           out.formArr === '24000' && out.formAcno === 'SE-0009',
    'notice reflects synced values':           out.hasName && out.hasAcno && out.hasArrears,
    'Final Demand renders its title':          out.hasFinal === true,
    'saved custom wording is used':            out.usesCustom === true,
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
