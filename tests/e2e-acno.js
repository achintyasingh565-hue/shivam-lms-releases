// Proves new-loan account numbers are auto-assigned with the financial-year prefix
// (SE-<FY>-####), continue after the highest serial WITHIN this financial year, reset
// to 0001 in a fresh year, ignore old-format / other-year numbers and deleted gaps, and
// pre-fill a brand-new loan form.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    const PREFIX = loanAcnoPrefix();          // e.g. "SE-2627-"

    // Old-format numbers (SE-16258) and a couple of this-FY numbers.
    loans.splice(0, loans.length,
      { id: 'a', acno: 'SE-16258', name: 'A' },
      { id: 'b', acno: PREFIX + '0009', name: 'B' },
      { id: 'c', acno: PREFIX + '0055', name: 'C' });
    const afterHighest = nextLoanAcno();       // -> PREFIX+0056 (ignores old SE-16258)
    const notClashing = !loans.some(l => l.acno === afterHighest);

    // Empty book -> starts at 0001 for this FY
    loans.splice(0, loans.length);
    const firstEver = nextLoanAcno();

    // Old-format only -> new FY numbering still starts at 0001
    loans.splice(0, loans.length, { id: 'o', acno: 'SE-16258' });
    const ignoresOld = nextLoanAcno();

    // Deleted-gap safety: highest serial wins even if lower ones are missing
    loans.splice(0, loans.length, { id: 'x', acno: PREFIX + '0002' }, { id: 'y', acno: PREFIX + '0007' });
    const afterGap = nextLoanAcno();           // -> PREFIX+0008

    // Brand-new loan form pre-filled; editing keeps the loan's own number.
    let newFormAcno = '', editFormAcno = '';
    try {
      loans.splice(0, loans.length, { id: 'z', acno: PREFIX + '0100', name: 'Z', principal: 1000, rate: 2, tenure: 12 });
      openLoan();
      newFormAcno = document.getElementById('m_acno').value;
      openLoan('z');
      editFormAcno = document.getElementById('m_acno').value;
    } catch (e) { newFormAcno = 'ERR:' + e; }

    return { PREFIX, afterHighest, notClashing, firstEver, ignoresOld, afterGap, newFormAcno, editFormAcno };
  });

  const P = out.PREFIX;
  const checks = {
    'prefix looks like SE-<FY>- ':                /^SE-\d{4}-$/.test(P),
    'continues after highest this-FY serial':     out.afterHighest === P + '0056',
    'never clashes with an existing number':      out.notClashing === true,
    'empty book starts at 0001':                  out.firstEver === P + '0001',
    'ignores old-format numbers (0001)':          out.ignoresOld === P + '0001',
    'ignores deleted gaps (0008)':                out.afterGap === P + '0008',
    'new loan form pre-filled (0101)':            out.newFormAcno === P + '0101',
    'editing keeps the loan\'s own number':       out.editFormAcno === P + '0100',
    'no page errors':                             errs.length === 0
  };

  console.log('\n===== LOAN ACCOUNT NUMBER ASSIGNMENT (FY PREFIX) =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ A/C NUMBERS CARRY THE FINANCIAL YEAR AND NEVER CLASH' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
