// The 15 rules the business runs on, re-asserted against the real engines
// after every change, whatever the change was about.
//
// calcLoanTotals(principal, monthlyRatePct, months) does the arithmetic;
// recomputeLoan(l) runs the ledger over a loan whose tpay/emi are already set.
const { makeSandbox } = require('./harness');
let bad = 0;
const ok = (l, g, w) => { const p = JSON.stringify(g) === JSON.stringify(w); if (!p) bad++;
  console.log('  ' + (p ? 'OK  ' : 'BAD ') + l + (p ? '' : '   got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w))); };
const S = makeSandbox('2026-06-01');

/* ---- the arithmetic: flat, never reducing-balance ---- */
{ const r = S.calcLoanTotals(100000, 2, 10);
  ok('flat interest = P x r x n', r.tint, 20000);
  ok('total payable  = principal + interest', r.tpay, 120000);
  ok('EMI            = total / tenure', r.emi, 12000);
  const r2 = S.calcLoanTotals(100000, 2, 20);
  ok('doubling tenure doubles interest (flat, not amortising)', r2.tint, 40000); }

/* ---- the 4% processing deduction changes the cash handed over, nothing else ---- */
{ const plain = S.calcLoanTotals(200000, 2.5, 12);
  const l = { id:'D', principal:200000, rate:2.5, tenure:12, deductions:8000,
              tpay:plain.tpay, emi:plain.emi, disb:'2026-01-01', charges:[], payments:[] };
  S.recomputeLoan(l);
  ok('4% deduction: loan amount unchanged',    l.principal, 200000);
  ok('4% deduction: EMI unchanged',            l.emi, plain.emi);
  ok('4% deduction: total payable unchanged',  l.tpay, plain.tpay);
  ok('4% deduction: outstanding unchanged',    l.outstanding, plain.tpay); }

/* ---- byaj: the principal never amortises ---- */
{ const l = { id:'B', interestOnly:true, principal:100000, rate:2, tenure:0,
              tpay:100000, emi:2000, disb:'2026-01-01', charges:[],
              payments:[2,3,4,5,6].map(m=>({date:'2026-0'+m+'-01', amount:2000, status:'Cleared'})) };
  S.recomputeLoan(l);
  ok('byaj: principal untouched by interest receipts', l.outstanding, 100000);
  ok('byaj: the monthly due IS the interest',          l.emi, 2000);
  ok('byaj: no notional interest added to the debt',   l.tint || 0, 0);
  ok('byaj: a principal return is what closes it',     (function(){
       const c = JSON.parse(JSON.stringify(l));
       c.payments.push({date:'2026-06-01', amount:100000, status:'Cleared', kind:'principal'});
       S.recomputeLoan(c); return c.outstanding; })(), 0); }

/* ---- flat: an interest-tagged receipt is income, not repayment ---- */
{ const t = S.calcLoanTotals(100000, 2, 10);
  const l = { id:'FI', principal:100000, rate:2, tenure:10, tpay:t.tpay, emi:t.emi,
              disb:'2026-01-01', charges:[],
              payments:[{date:'2026-02-01', amount:2000, status:'Cleared', intOnly:true}] };
  S.recomputeLoan(l);
  ok('flat: an interest payment does not reduce the balance', l.outstanding, 120000);
  ok('flat: and is not counted as principal repaid',          l.paid, 0); }

/* ---- an ordinary loan still reconciles ---- */
{ const t = S.calcLoanTotals(120000, 1.5, 12);
  const l = { id:'A', principal:120000, rate:1.5, tenure:12, tpay:t.tpay, emi:t.emi,
              disb:'2026-01-01', charges:[],
              payments:[2,3,4].map(m=>({date:'2026-0'+m+'-01', amount:t.emi, status:'Cleared'})) };
  S.recomputeLoan(l);
  ok('ordinary: paid is the three cleared EMIs', l.paid, t.emi*3);
  ok('ordinary: outstanding = total payable - paid', l.outstanding, t.tpay - t.emi*3); }

console.log(bad ? '\n' + bad + ' CORE RULE(S) BROKEN' : '\nALL CORE RULES INTACT');
process.exitCode = bad ? 1 : 0;
