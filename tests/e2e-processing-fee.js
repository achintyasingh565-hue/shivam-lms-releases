// Processing / deductions auto-calculated from the loan amount.
//
// A flat percentage (4% by default) is withheld at disbursement. It is NOT the
// interest rate — the two must never be confused — and it does not reduce what
// the borrower owes, only the cash handed over.
//
// The two risks worth testing: silently overwriting a figure the owner typed,
// and silently adding a fee to an EXISTING loan that deliberately had none.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '07-loans-crud.js'), 'utf8');

function slice(decl) {
  const i = src.indexOf(decl);
  if (i < 0) throw new Error('not found: ' + decl);
  let b = src.indexOf('{', i + decl.length - 1), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced: ' + decl);
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// Re-create just the deduction block from recalc(), with the real source text.
const blockStart = src.indexOf('    var _dedBox=');
const blockEnd = src.indexOf("    const ded=", blockStart);
const DED_BLOCK = src.slice(blockStart, blockEnd);

function run({ principal, deductions, downpay, editing, pct, autoval }) {
  const F = {
    m_deductions: { value: deductions === undefined ? '' : String(deductions), readOnly: false, dataset: autoval ? { autoval: String(autoval) } : {} },
    m_downpay: { value: downpay === undefined ? '' : String(downpay) },
    m_dedHint: { textContent: '' },
    m_remaining: { value: '' },
  };
  const store = {};
  if (pct !== undefined) store['shivam_proc_fee_pct_v1'] = String(pct);
  const ctx = {
    $: id => F[id] || null,
    editId: editing ? 'L1' : null,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    inr: n => '₹' + Number(n).toLocaleString('en-IN'),
    toast: () => {}, recalc: () => {},
    isFinite, Number, String, Math, console,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    "var PROC_FEE_KEY='shivam_proc_fee_pct_v1';\n" +
    slice('function procFeePct()') + '\n' +
    'var p = ' + principal + ';\n' +
    DED_BLOCK + '\n' +
    "var ded=Number($('m_deductions').value)||0, dp=Number($('m_downpay').value)||0;\n" +
    "$('m_remaining').value=Math.max(0,p-ded-dp);\n", ctx);
  return F;
}

// 1. the core behaviour: 4% of the loan amount, net disbursed follows
let F = run({ principal: 120000 });
chk('4% of 1,20,000 withheld', F.m_deductions.value, 4800);
chk('net disbursed = amount - processing', Number(F.m_remaining.value), 115200);
chk('hint explains the figure', F.m_dedHint.textContent, '4% of the loan amount');

// 2. a down payment is taken off as well
F = run({ principal: 120000, downpay: 10000 });
chk('down payment also deducted', Number(F.m_remaining.value), 105200);

// 3. A HAND-TYPED FIGURE IS NEVER OVERWRITTEN
F = run({ principal: 120000, deductions: 2500 });
chk('a typed deduction survives', Number(F.m_deductions.value), 2500);
chk('net disbursed uses the typed figure', Number(F.m_remaining.value), 117500);
chk('hint says it was entered by hand', /entered by hand/.test(F.m_dedHint.textContent), true);

// 4. but a figure this code filled earlier IS updated when the amount changes
F = run({ principal: 200000, deductions: 4800, autoval: 4800 });
chk('an auto figure follows the new amount', Number(F.m_deductions.value), 8000);

// 5. the fee is standard, so an EXISTING loan with a blank box gets it too
F = run({ principal: 120000, editing: true });
chk('an existing loan with no deduction gets the 4%', F.m_deductions.value, 4800);
chk('  net disbursed follows', Number(F.m_remaining.value), 115200);
// but an existing loan that already records a different figure keeps it
F = run({ principal: 120000, deductions: 3000, editing: true });
chk('an existing loan with its own figure is untouched', Number(F.m_deductions.value), 3000);

// 6. the rate is configurable, and 0 disables it
chk('a different rate is honoured', Number(run({ principal: 100000, pct: 2.5 }).m_deductions.value), 2500);
chk('zero percent withholds nothing', run({ principal: 100000, pct: 0 }).m_deductions.value, '');

// 7. edge cases must not produce nonsense
chk('no amount yet -> no deduction', run({ principal: 0 }).m_deductions.value, '');
chk('net disbursed never goes negative',
  Number(run({ principal: 10000, deductions: 9000, downpay: 9000 }).m_remaining.value), 0);
chk('rounds to whole rupees', Number(run({ principal: 33333, pct: 4 }).m_deductions.value), 1333);


// ---------------------------------------------------------------------------
// The processing fee must NOT touch the EMI. Instalments are worked out on the
// loan amount, not on the net disbursed — the borrower repays the full loan.
// If this ever changed, every schedule in the book would be wrong, so it is
// worth asserting rather than assuming.
const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-10-28');

chk('totals are a function of (amount, rate, months) only',
  S.calcLoanTotals(120000, 2, 24), { tint: 57600, tpay: 177600, emi: 7400 });

const mkLoan = (ded, dp) => {
  const l = { id: 'L', name: 'X', acno: '1', principal: 120000, deductions: ded, downpay: dp || 0,
              rate: 2, tenure: 24, payments: [], charges: [], disb: '2026-02-01', due: '2026-03-01' };
  Object.assign(l, S.calcLoanTotals(l.principal, l.rate, l.tenure));
  S.recomputeLoan(l);
  return l;
};
const plain = mkLoan(0), fee = mkLoan(4800), feeAndDp = mkLoan(4800, 10000);

chk('EMI unchanged by the processing fee', [plain.emi, fee.emi, feeAndDp.emi], [7400, 7400, 7400]);
chk('total payable unchanged', [plain.tpay, fee.tpay, feeAndDp.tpay], [177600, 177600, 177600]);
chk('total interest unchanged', [plain.tint, fee.tint, feeAndDp.tint], [57600, 57600, 57600]);
chk('what the borrower owes is unchanged',
  [plain.outstanding, fee.outstanding, feeAndDp.outstanding], [177600, 177600, 177600]);

// and the fee is not the interest rate — changing one must not move the other
chk('the interest rate is untouched', [plain.rate, fee.rate], [2, 2]);


// ---------------------------------------------------------------------------
// The Adjustment field (previous dues carried over, formerly "Down Payment")
// must behave the same way: it reduces the cash handed over and nothing else.
// It appears in no money calculation at all — asserted directly against the
// source so a future edit that wires it into the maths fails here.
const crudSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '07-loans-crud.js'), 'utf8');
const certSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '08-certificate.js'), 'utf8');
const schedSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '03-emi-schedule.js'), 'utf8');

// A bare "does the word appear" check is too crude: 08-certificate.js mentions
// deductions in a comment stating this very rule, in a pass-through on import,
// and in demo fixture data. What must never happen is ARITHMETIC on them inside
// the money engines — so look for that specifically, ignoring comments.
function codeOnly(src) {
  return src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
const MATHS = /[-+*/]\s*\(?\s*Number\(\s*\w+\.(deductions|downpay)|\.(deductions|downpay)\s*\|\|\s*0\s*\)?\s*[-+*/]/;
chk('no arithmetic on adjustment/deductions in the totals engine', MATHS.test(codeOnly(certSrc)), false);
chk('no arithmetic on adjustment/deductions in the schedule', MATHS.test(codeOnly(schedSrc)), false);
chk('totals engine takes only principal, rate and months',
  /function calcLoanTotals\(principal, ratePctPerMonth, months\)/.test(certSrc), true);

// in the form, both may only feed the Net Disbursed box
const netLine = crudSrc.split('\n').filter(l => /m_remaining/.test(l) && /downpay|dp\b/.test(l));
chk('the form uses them only for Net Disbursed', netLine.length > 0, true);

// a large adjustment still leaves the EMI alone
const bigAdj = mkLoan(4800, 50000);
chk('a big adjustment does not change the EMI', bigAdj.emi, 7400);
chk('  nor what is owed', bigAdj.outstanding, 177600);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL PROCESSING-FEE CHECKS PASS');
process.exitCode = fails ? 1 : 0;
