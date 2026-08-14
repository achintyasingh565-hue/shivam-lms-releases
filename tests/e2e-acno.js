// Proves new-loan account numbers are auto-assigned and never clash: the next
// number always continues AFTER the highest existing one, works when the book is
// empty, ignores deleted gaps, and a brand-new loan form is pre-filled with it.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    // Mixed real-world numbering: a high number plus low ones (like the owner's data).
    loans.splice(0, loans.length,
      { id: 'a', acno: 'SE-16258', name: 'A' },
      { id: 'b', acno: 'SE-0009', name: 'B' },
      { id: 'c', acno: 'SE-0055', name: 'C' });
    const afterHighest = nextLoanAcno();                 // -> SE-16259
    const notClashing = !loans.some(l => l.acno === afterHighest);

    // Empty book -> starts at SE-0001
    loans.splice(0, loans.length);
    const firstEver = nextLoanAcno();

    // Deleted-gap safety: highest wins even if lower numbers are missing
    loans.splice(0, loans.length, { id: 'x', acno: 'SE-0002' }, { id: 'y', acno: 'SE-0007' });
    const afterGap = nextLoanAcno();                     // -> SE-0008 (never reuses 0003..0006)

    // A brand-new loan form is pre-filled with the next number; editing an existing
    // loan keeps that loan's own number.
    let newFormAcno = '', editFormAcno = '';
    try {
      loans.splice(0, loans.length, { id: 'z', acno: 'SE-0100', name: 'Z', principal: 1000, rate: 2, tenure: 12 });
      openLoan();                       // NEW loan
      newFormAcno = document.getElementById('m_acno').value;
      openLoan('z');                    // EDIT existing
      editFormAcno = document.getElementById('m_acno').value;
    } catch (e) { newFormAcno = 'ERR:' + e; }

    return { afterHighest, notClashing, firstEver, afterGap, newFormAcno, editFormAcno };
  });

  const checks = {
    'continues after the highest (SE-16259)': out.afterHighest === 'SE-16259',
    'never clashes with an existing number':  out.notClashing === true,
    'empty book starts at SE-0001':           out.firstEver === 'SE-0001',
    'ignores deleted gaps (SE-0008)':         out.afterGap === 'SE-0008',
    'new loan form is pre-filled (SE-0101)':  out.newFormAcno === 'SE-0101',
    'editing keeps the loan\'s own number':   out.editFormAcno === 'SE-0100',
    'no page errors':                         errs.length === 0
  };

  console.log('\n===== LOAN ACCOUNT NUMBER ASSIGNMENT =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ A/C NUMBERS AUTO-ASSIGN AND NEVER CLASH' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
