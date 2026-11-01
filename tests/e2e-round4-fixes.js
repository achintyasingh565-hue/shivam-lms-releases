// Round 4: findings from two independent reviews of v2.16.0.
//
// The worst one: a No Dues Certificate could be printed for a loan on which
// the borrower still owed the entire balance. The guard asked "is he behind on
// instalments due SO FAR" — on a new loan with the first instalment still in
// the future the answer is no, so a document stating that nothing is owed
// would print against a full balance.

const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-03-01');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
const P = (d, a, x) => Object.assign({ id: 'p' + d + a, date: d, amount: a, status: 'Cleared' }, x || {});

// --- the No Dues guard now consults the FULL balance -------------------------
console.log('--- No Dues guard ---');
{
  const t = S.calcLoanTotals(120000, 2, 12);
  const fresh = { id: 'A', principal: 120000, rate: 2, tenure: 12, tint: t.tint, tpay: t.tpay,
    emi: t.emi, disb: '2026-03-01', due: '2026-04-01', charges: [], payments: [] };
  S.recomputeLoan(fresh);
  chk('a brand-new loan owes the whole balance', fresh.outstanding, 148800);
  chk('  nothing has fallen due yet', S.dueToDate(fresh).elapsed, 0);
  // printCert refuses on l.outstanding, which dueToDate alone would not catch
  chk('  so the dues-to-date figure is zero (the old guard passed)',
    S.dueToDate(fresh).outstanding, 0);
  chk('  but the balance is positive, which is what printCert now checks',
    fresh.outstanding > 0, true);
}

// --- rounding must not block a genuinely settled loan ------------------------
console.log('\n--- settled loan, EMI rounding ---');
{
  const t = S.calcLoanTotals(100000, 2.7, 7);
  chk('n*emi overshoots tpay by rounding', t.emi * 7 - t.tpay, 2);
  const paid = { id: 'B', principal: 100000, rate: 2.7, tenure: 7, tint: t.tint, tpay: t.tpay,
    emi: t.emi, disb: '2025-01-01', due: '2025-02-01', charges: [], payments: [P('2025-02-01', t.tpay)] };
  S.recomputeLoan(paid);
  chk('the loan is settled', paid.outstanding, 0);
  chk('  and the guard no longer invents a ₹2 debt', S.dueToDate(paid).outstanding, 0);
}

// --- byaj loans are visible to the guard -------------------------------------
console.log('\n--- byaj loans reach the guard ---');
{
  const b = { id: 'C', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
    disb: '2026-01-01', due: '2026-02-01', charges: [], payments: [] };
  S.recomputeLoan(b);
  chk('a byaj loan with unpaid interest reports arrears', b.arrears > 0, true);
  chk('  and dueToDate no longer returns zero for it', S.dueToDate(b).outstanding, b.arrears);
}

// --- interest already due survives the principal return ----------------------
console.log('\n--- byaj principal return ---');
{
  const S2 = makeSandbox('2026-06-01');
  const mk = (pays) => { const l = { id: 'D', interestOnly: true, principal: 100000, rate: 2,
    tenure: 0, disb: '2026-01-01', due: '2026-02-01', charges: [], payments: pays };
    S2.recomputeLoan(l); return l; };
  const unpaid = mk([P('2026-05-20', 100000, { kind: 'principal' })]);
  chk('principal back, interest never serviced -> still open', unpaid.status, 'Overdue');
  /* Four instalments fell due (1 Feb - 1 May) before the principal came back on
     20 May; the 1 June one never did. 10,000 here assumed accrual ran to today
     instead of to the day the money was returned. */
  chk('  the accrued interest is still owed', unpaid.outstanding, 8000);
  const serviced = mk([P('2026-02-01', 2000), P('2026-03-01', 2000), P('2026-04-01', 2000),
                       P('2026-05-01', 2000), P('2026-06-01', 2000), P('2026-06-01', 100000, { kind: 'principal' })]);
  chk('interest serviced and principal back -> Closed', serviced.status, 'Closed');
  chk('  nothing outstanding', serviced.outstanding, 0);
}

// --- restructure reads a product-aware balance -------------------------------
console.log('\n--- outstandingOf is product-aware ---');
{
  const fs = require('fs'), vm = require('vm'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '18-docgen.js'), 'utf8');
  const i = src.indexOf('function outstandingOf(');
  let b = src.indexOf('{', i), d = 0, e = i;
  for (let j = b; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) { e = j + 1; break; } }
  const ctx = { Math, Number, Array, isFinite }; vm.createContext(ctx);
  vm.runInContext(src.slice(i, e) + '\nthis.f = outstandingOf;', ctx);
  chk('byaj: an interest receipt does not look like principal repaid',
    ctx.f({ interestOnly: true, principal: 100000, tpay: 100000, paid: 2000,
            payments: [{ status: 'Cleared', amount: 2000 }], charges: [] }), 100000);
  chk('byaj: a principal return does reduce it',
    ctx.f({ interestOnly: true, principal: 100000, tpay: 100000, paid: 40000,
            payments: [{ status: 'Cleared', amount: 40000, kind: 'principal' }], charges: [] }), 60000);
  chk('flat: charges are included', ctx.f({ tpay: 124000, paid: 10000, charges: [{ amount: 500 }] }), 114500);
  chk('the live ledger figure is preferred when present',
    ctx.f({ interestOnly: true, principal: 100000, outstanding: 100000, paid: 2000, tpay: 100000 }), 100000);
}

// --- foreclosure and statement no longer miscount ----------------------------
console.log('\n--- source guards ---');
{
  const fs = require('fs'), path = require('path');
  const cert = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '08-certificate.js'), 'utf8');
  const i = cert.indexOf('function _foreclosePreview(');
  chk('foreclosure excludes interest-only payments from cleared0',
    /_isIntF\(p\)/.test(cert.slice(i, i + 900)), true);
  const nav = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '02-helpers-nav.js'), 'utf8');
  chk('the statement counts only Cleared money',
    (nav.match(/if\(p\.status==='Cleared'\)\{ run\+=amt; \}/g) || []).length, 3);
  chk('  no Pending-based running total remains',
    /if\(p\.status!=='Pending'\)\{ run\+=amt; \}/.test(nav), false);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL ROUND-4 CHECKS PASS');
process.exitCode = fails ? 1 : 0;
