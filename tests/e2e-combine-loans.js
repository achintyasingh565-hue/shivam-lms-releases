// Payments: borrower list is A→Z and the search box filters it.
// Restructure: combining a customer's loans carries only remaining PRINCIPAL into one
//   new loan (original principal − principal repaid), old loans are closed.
// Recording a payment no longer fires an automatic WhatsApp receipt prompt.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const out = await p.evaluate(() => {
    window.confirm = () => true; window.print = () => {}; window.open = () => null;

    // --- sort + search ---
    loans.splice(0, loans.length,
      { id: 'Z', name: 'Zara Khan', acno: 'SE-2627-0003', principal: 10000, tpay: 12000, emi: 1000, paid: 0, outstanding: 12000, rate: 2, tenure: 12, status: 'Active', payments: [] },
      { id: 'A', name: 'Aarav Gupta', acno: 'SE-2627-0001', principal: 10000, tpay: 12000, emi: 1000, paid: 0, outstanding: 12000, rate: 2, tenure: 12, status: 'Active', payments: [] },
      { id: 'M', name: 'Mohan Lal', acno: 'SE-2627-0002', principal: 10000, tpay: 12000, emi: 1000, paid: 0, outstanding: 12000, rate: 2, tenure: 12, status: 'Active', payments: [] }
    );
    refreshPayLoanDropdown();
    var opts = [].slice.call(document.getElementById('payb_loan').options).slice(1).map(o => o.textContent);
    var sorted = opts.length === 3 && /Aarav/.test(opts[0]) && /Mohan/.test(opts[1]) && /Zara/.test(opts[2]);
    document.getElementById('payb_search').value = 'mohan'; filterPayLoans();
    var filtered = [].slice.call(document.getElementById('payb_loan').options).slice(1);
    var searchWorks = filtered.length === 1 && /Mohan/.test(filtered[0].textContent);
    var autoPicked = document.getElementById('payb_loan').value === 'M';
    document.getElementById('payb_search').value = ''; filterPayLoans();

    // --- receipt offer removed ---
    var offerCalls = 0; window.offerPaymentReceiptWA = function () { offerCalls++; };
    document.getElementById('payb_loan').value = 'A';
    document.getElementById('payb_amt').value = '1000';
    document.getElementById('payb_mode').value = 'Cash';
    document.getElementById('payb_date').value = '2026-09-16';
    recordPayTab();
    var noReceiptPrompt = offerCalls === 0;

    // --- combine loans ---
    loans.splice(0, loans.length,
      { id: 'L1', name: 'Ramesh Kumar', acno: 'SE-2627-0011', reltype: 's/o', relname: 'Shyam', phone: '9839125800', addr: 'Lucknow',
        principal: 100000, rate: 2, tenure: 10, tint: 20000, tpay: 120000, emi: 12000, paid: 60000, outstanding: 60000, disb: '2026-01-05', status: 'Active', payments: [{ pid: 'x1', date: '2026-06-05', mode: 'Cash', amount: 60000, status: 'Cleared' }] },
      { id: 'L2', name: 'Ramesh Kumar', acno: 'SE-2627-0012', reltype: 's/o', relname: 'Shyam', phone: '9839125800', addr: 'Lucknow',
        principal: 50000, rate: 2, tenure: 10, tint: 10000, tpay: 60000, emi: 6000, paid: 30000, outstanding: 30000, disb: '2026-02-05', status: 'Active', payments: [{ pid: 'x2', date: '2026-06-05', mode: 'Cash', amount: 30000, status: 'Cleared' }] },
      { id: 'L3', name: 'Someone Else', acno: 'SE-2627-0013', principal: 20000, tpay: 24000, emi: 2000, paid: 0, outstanding: 24000, rate: 2, tenure: 12, status: 'Active', payments: [] }
    );
    openRestructure('L1');
    var siblingShown = !!document.querySelector('#rsCombineList input[data-id="L2"]');
    var noStranger = !document.querySelector('#rsCombineList input[data-id="L3"]');
    document.getElementById('rsCombineOn').checked = true;
    document.querySelector('#rsCombineList input[data-id="L2"]').checked = true;
    document.getElementById('rs_rate').value = '';           // no fresh interest → pure principal merge
    document.querySelector('input[name="rsMode"][value="manual"]').checked = true;
    document.getElementById('rs_mmonths').value = '10';
    calcRestructure();
    applyRestructure();

    var merged = loans.find(l => Array.isArray(l.combinedFrom));
    var l1 = loans.find(l => l.id === 'L1'), l2 = loans.find(l => l.id === 'L2'), l3 = loans.find(l => l.id === 'L3');
    return {
      sorted, searchWorks, autoPicked, noReceiptPrompt, siblingShown, noStranger,
      newExists: !!merged,
      newPrincipal: merged ? merged.principal : null,        // expect 50000 + 25000 = 75000
      newEmi: merged ? merged.emi : null,                    // 75000 / 10 = 7500
      newMonths: merged ? merged.tenure : null,
      oldL1Closed: !!(l1 && l1.status === 'Closed' && l1.mergedInto === (merged && merged.acno)),
      oldL2Closed: !!(l2 && l2.status === 'Closed' && l2.mergedInto === (merged && merged.acno)),
      strangerUntouched: !!(l3 && l3.status === 'Active')
    };
  });

  const checks = {
    'payments list is A→Z':                 out.sorted === true,
    'search filters borrowers':             out.searchWorks === true,
    'single match auto-selects':            out.autoPicked === true,
    'no auto receipt prompt on record':     out.noReceiptPrompt === true,
    'same-borrower loan offered to combine':out.siblingShown === true,
    'other borrowers not offered':          out.noStranger === true,
    'combined loan created':                out.newExists === true,
    'principal = sum of remaining principals (75,000)': out.newPrincipal === 75000,
    'new EMI spreads combined principal (7,500)':       out.newEmi === 7500,
    'new tenure honoured (10)':             out.newMonths === 10,
    'source loan 1 closed & tagged':        out.oldL1Closed === true,
    'source loan 2 closed & tagged':        out.oldL2Closed === true,
    'unrelated borrower untouched':         out.strangerUntouched === true,
    'no page errors':                       errs.length === 0
  };

  console.log('\n===== COMBINE LOANS + PAYMENTS SORT/SEARCH =====');
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ COMBINE + SORT/SEARCH WORK' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
