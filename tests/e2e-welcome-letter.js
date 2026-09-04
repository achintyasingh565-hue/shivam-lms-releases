// Verifies the auto-filled Welcome Letter (per loan) and the automatic NEW badge
// for loans issued on/after 1 Oct 2026.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    // NEW badge cutoff checks (1 Oct 2026)
    const newOct = isNewLoan({ disb: '2026-10-05' });
    const oldSep = isNewLoan({ disb: '2026-09-30' });
    const badgeHtml = newBadge({ disb: '2026-10-05' });

    // A normal amortising loan, disbursed after go-live
    loans.splice(0, loans.length, {
      id: 'WL', name: 'Ramesh Kumar', reltype: 's/o', relname: 'Suresh Kumar',
      addr: 'Indira Nagar, Lucknow', acno: 'SE-9001', type: 'Personal Loan',
      secured: false, principal: 100000, rate: 2, tenure: 10,
      tint: 20000, tpay: 120000, emi: 12000, disb: '2026-10-05', due: '2026-11-05',
      status: 'Active', payments: []
    });
    openWelcomeLetter('WL');
    const ov = document.getElementById('wlOverlay');
    const html = ov ? ov.innerHTML : '';
    const shown = ov && ov.style.display !== 'none';

    const norm = {
      hasAcno: html.includes('SE-9001'),
      hasEmi: html.includes('Monthly EMI') && html.includes('12,000'),
      hasRate: html.includes('2% per month'),
      hasTenure: html.includes('10 month'),
      hasTotalPayable: html.includes('Total Amount Payable') && html.includes('1,20,000'),
      hasSchedule: html.includes('Repayment Schedule'),
      hasFirstDue: html.includes('First EMI Due Date'),
      hasName: html.includes('Ramesh Kumar')
    };

    const combined = {
      hasDetailBand: html.includes('Loan Account Detail'),
      hasInstallmentBand: html.includes('Installment Schedule Detail'),
      hasCols: html.includes('Opening Balance') && html.includes('Principal') && html.includes('Interest'),
      hasCoApplicant: html.includes('Co-Applicant Name'),
      hasNetOrSanction: html.includes('Sanctioned Amount') || html.includes('Sanctioned / Loan Amount')
    };

    // Interest-only variant
    loans.splice(0, loans.length, {
      id: 'WL2', name: 'Byaj Cust', acno: 'SE-9002', interestOnly: true,
      principal: 200000, rate: 2, tenure: 0, emi: 4000, tpay: 200000,
      disb: '2026-10-10', due: '2026-11-10', status: 'Active', payments: []
    });
    openWelcomeLetter('WL2');
    const html2 = document.getElementById('wlOverlay').innerHTML;
    const io = {
      hasMonthlyInterest: html2.includes('Monthly Interest Payable') && html2.includes('4,000'),
      noSchedule: !html2.includes('Repayment Schedule'),
      mentionsPrincipalOnDemand: html2.includes('repayable on demand')
    };

    // Auto WhatsApp payment receipt
    let waUrl = '';
    window.open = (u) => { waUrl = String(u); return null; };
    window.confirm = () => true;
    offerPaymentReceiptWA({ name: 'Ramesh Kumar', phone: '9839125800', acno: 'SE-2627-0001', outstanding: 88000, principal: 100000, emi: 12000 }, { amount: 12000 });
    const dec = decodeURIComponent(waUrl);
    const receipt = {
      opensWa: dec.includes('wa.me/919839125800'),
      hasAmount: dec.includes('12,000'),
      hasBalance: dec.includes('88,000')
    };

    return { newOct, oldSep, badgeHtml, shown, norm, combined, io, receipt };
  });

  const checks = {
    'NEW: loan dated 05-Oct-2026 is new':        out.newOct === true,
    'NEW: loan dated 30-Sep-2026 is NOT new':    out.oldSep === false,
    'NEW badge renders the NEW pill':            /NEW/.test(out.badgeHtml),
    'Welcome Letter modal opens':                out.shown === true,
    'letter shows account number':               out.norm.hasAcno,
    'letter shows monthly EMI':                  out.norm.hasEmi,
    'letter shows interest rate':                out.norm.hasRate,
    'letter shows tenure':                       out.norm.hasTenure,
    'letter shows total payable':                out.norm.hasTotalPayable,
    'letter includes repayment schedule':        out.norm.hasSchedule,
    'letter shows first EMI due date':           out.norm.hasFirstDue,
    'letter greets the customer by name':        out.norm.hasName,
    'has Loan Account Detail block':             out.combined.hasDetailBand,
    'has Installment Schedule Detail block':     out.combined.hasInstallmentBand,
    'schedule has Opening/Principal/Interest':   out.combined.hasCols,
    'shows Co-Applicant field':                  out.combined.hasCoApplicant,
    'shows Sanctioned amount':                   out.combined.hasNetOrSanction,
    'interest-only shows monthly interest':      out.io.hasMonthlyInterest,
    'interest-only omits the EMI schedule':      out.io.noSchedule,
    'interest-only notes principal on demand':   out.io.mentionsPrincipalOnDemand,
    'payment receipt opens WhatsApp':            out.receipt.opensWa,
    'receipt shows payment amount':              out.receipt.hasAmount,
    'receipt shows remaining balance':           out.receipt.hasBalance,
    'no page errors':                            errs.length === 0
  };

  console.log('\n===== WELCOME LETTER + NEW BADGE =====');
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ WELCOME LETTER AUTO-FILLS; NEW BADGE BY DATE WORKS' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
