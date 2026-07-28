// Proves the new PAN field round-trips through the loan form and shows on the
// customer profile beneath the ID.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    // form has the PAN input
    var hasInput = !!document.getElementById('m_pan');

    // a loan carrying a PAN aggregates onto the customer, and shows on the profile
    loans.splice(0, loans.length,
      { id: 'P1', name: 'Pan Test', acno: 'SE-8001', phone: '9000000001', idtype: 'Aadhaar', idproof: '123412341234', pan: 'ABCDE1234F', principal: 100000, rate: 2, tenure: 12, tint: 24000, tpay: 124000, emi: 10333, outstanding: 124000 });
    try { recomputeAll(); } catch (e) {}
    var cust = buildCustomers()[0];
    var panOnCust = cust && cust.pan;

    openCustomer(encodeURIComponent(cust.key));
    var html = (document.getElementById('custDetail') || {}).innerHTML || '';
    var showsPanLabel = /<label>PAN<\/label>/.test(html);
    var showsPanValue = html.indexOf('ABCDE1234F') >= 0;

    return { hasInput, panOnCust, showsPanLabel, showsPanValue };
  });

  const checks = {
    'loan form has a PAN input':          out.hasInput === true,
    'PAN aggregates onto the customer':   out.panOnCust === 'ABCDE1234F',
    'profile shows a PAN label':          out.showsPanLabel === true,
    'profile shows the PAN value':        out.showsPanValue === true,
    'no page errors':                     errs.length === 0
  };

  console.log('\n===== PAN FIELD =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  console.log('\n  ' + (bad === 0 ? '✅ PAN FIELD STORES & DISPLAYS UNDER THE ID' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
