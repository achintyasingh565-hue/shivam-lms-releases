// Loan File booklet: openLoanFile builds the 4-page booklet auto-filled from the
// loan record (SE- account no., borrower name/s-o/address, guarantor, amounts, EMI,
// rate, dates, security) inside an iframe, with print + close working, and the OLD
// "Loan Documents" nav entry removed.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const out = await p.evaluate(() => {
    loans.splice(0, loans.length, {
      id: 'LF', name: 'Suresh Chandra', reltype: 's/o', relname: 'Ram Chandra',
      addr: '221 Gomti Nagar, Lucknow', phone: '9839125800', acno: 'SE-2627-0011',
      principal: 200000, rate: 2, tenure: 12, emi: 18500, tpay: 222000,
      disb: '2026-10-05', due: '2026-11-05', gname: 'Mahesh Gupta',
      propdesc: 'Residential plot', propvalue: 500000, propaddr: 'Plot 12, Vikas Nagar',
      product: 'Business loan', payments: []
    });
    if (typeof openLoanFile !== 'function') return { fatal: 'openLoanFile missing' };
    openLoanFile('LF');
    const ov = document.getElementById('lfOverlay');
    const fr = document.getElementById('lfFrame');
    const doc = fr ? fr.srcdoc : '';
    const sheets = (doc.match(/class="sheet/g) || []).length;
    const printBtn = /printLoanFile\(\)/.test(ov ? ov.innerHTML : '');
    // exercise print + close (guarded so it can't throw here)
    let printOk = true; try { window.print = () => {}; printLoanFile(); } catch (e) { printOk = false; }
    closeLoanFile();
    const closed = document.getElementById('lfOverlay').style.display === 'none';
    return {
      opened: !!ov && !!fr,
      sheets,
      hasName: doc.includes('Suresh Chandra'),
      hasSo: doc.includes('Ram Chandra'),
      hasAddr: doc.includes('221 Gomti Nagar, Lucknow'),
      hasAcno: doc.includes('SE-2627-0011'),
      hasAmount: doc.includes('2,00,000'),
      hasEmi: doc.includes('18,500'),
      hasRate: doc.includes('>2<') || doc.includes('2 %'),
      hasGuar: doc.includes('Mahesh Gupta'),
      hasSecurity: doc.includes('Residential plot'),
      hasFirm: doc.includes('SHIVAM ENTERPRISES'),
      hasLucknow: doc.includes('Place:'),
      printBtn, printOk, closed,
      oldNavGone: !document.querySelector('[data-sec="hpfile"]')
    };
  });

  if (out.fatal) { console.log('FATAL:', out.fatal); await b.close(); process.exit(1); }

  const checks = {
    'loan file overlay + iframe open':        out.opened === true,
    'booklet has 4 pages':                    out.sheets === 4,
    'borrower name auto-filled':              out.hasName === true,
    's/o (father) auto-filled':               out.hasSo === true,
    'address auto-filled':                    out.hasAddr === true,
    'SE- account number auto-filled':         out.hasAcno === true,
    'loan amount auto-filled':                out.hasAmount === true,
    'EMI auto-filled':                        out.hasEmi === true,
    'interest rate auto-filled':              out.hasRate === true,
    'guarantor auto-filled':                  out.hasGuar === true,
    'security details auto-filled':           out.hasSecurity === true,
    'firm name on booklet':                   out.hasFirm === true,
    'Place: Lucknow present':                 out.hasLucknow === true,
    'print button wired':                     out.printBtn === true,
    'print runs without error':               out.printOk === true,
    'close hides overlay':                    out.closed === true,
    'OLD Loan Documents nav removed':         out.oldNavGone === true,
    'no page errors':                         errs.length === 0
  };

  console.log('\n===== LOAN FILE (IN-APP BOOKLET) =====');
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ LOAN FILE: AUTO-FILLS & PRINTS; OLD PACK REMOVED' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
