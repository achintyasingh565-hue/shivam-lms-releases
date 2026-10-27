// The Payments screen de-clutter: one Apply / one Remove with a scope picker,
// replacing six buttons. The scope selector must map to exactly the same three
// paths the six buttons used, or a click would quietly do the wrong thing.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '08-certificate.js'), 'utf8');

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

function ctxFor(scope, loanId) {
  const F = { chgScope: { value: scope }, chg_loan: { value: loanId === undefined ? 'L1' : loanId }, chg_amt: { value: '' },
              payb_loan: { value: '', options: [{ value: 'L1' }, { value: 'L2' }] } };
  F.chg_loan.options = [{ value: 'L1' }, { value: 'L2' }];
  const ctx = {
    $: id => F[id] || null,
    applyLateFees: (id, only) => { ctx._called = ['apply', id, only]; },
    waiveLateFees: (id, only) => { ctx._called = ['waive', id, only]; },
    chgUpdateHint: () => {},
    inr: n => '₹' + n, fmtDate: d => d,
    getLateFeeRate: () => 500, getManualOvdInt: () => 0,
    getLateGraceDays: () => 7, getOvdFrom: () => '',
    String, Number, console,
  };
  ctx.window = ctx; ctx._F = F;
  vm.createContext(ctx);
  vm.runInContext(
    slice('function _chgScope()') + '\n' +
    slice('window.applyOverdueScoped=function()') + '\n' +
    slice('window.removeOverdueScoped=function()') + '\n' +
    slice('function _mirrorLoanPick(fromId, toId)') + '\n' +
    slice('window.chgLoanChange=function(fromUser)') + '\n' +
    slice('window.payLoanPicked=function()') + '\n', ctx);
  return ctx;
}

// --- the scope picker maps to the right path
let c = ctxFor('both'); vm.runInContext('applyOverdueScoped()', c);
chk('Apply + "both" applies both', c._called, ['apply', 'L1', undefined]);
c = ctxFor('fee'); vm.runInContext('applyOverdueScoped()', c);
chk('Apply + "late fees only"', c._called, ['apply', 'L1', 'fee']);
c = ctxFor('int'); vm.runInContext('applyOverdueScoped()', c);
chk('Apply + "overdue interest only"', c._called, ['apply', 'L1', 'int']);

c = ctxFor('both'); vm.runInContext('removeOverdueScoped()', c);
chk('Remove + "both"', c._called, ['waive', 'L1', undefined]);
c = ctxFor('fee'); vm.runInContext('removeOverdueScoped()', c);
chk('Remove + "late fees only"', c._called, ['waive', 'L1', 'fee']);
c = ctxFor('int'); vm.runInContext('removeOverdueScoped()', c);
chk('Remove + "overdue interest only"', c._called, ['waive', 'L1', 'int']);

// a junk/missing scope must fall back to "both", never to a narrower action
c = ctxFor('nonsense'); vm.runInContext('applyOverdueScoped()', c);
chk('unknown scope falls back to both', c._called, ['apply', 'L1', undefined]);

// --- the two borrower pickers mirror each other
c = ctxFor('both');
c._F.payb_loan.value = 'L2';
vm.runInContext('payLoanPicked()', c);
chk('choosing in Record a Payment sets the Charges picker', c._F.chg_loan.value, 'L2');

c = ctxFor('both');
c._F.chg_loan.value = 'L2';
vm.runInContext('chgLoanChange(true)', c);
chk('choosing in Charges sets the Payment picker', c._F.payb_loan.value, 'L2');

// a programmatic change (Action Centre sets chg_loan directly) must NOT mirror
c = ctxFor('both');
c._F.chg_loan.value = 'L2';
vm.runInContext('chgLoanChange()', c);
chk('programmatic change does not mirror', c._F.payb_loan.value, '');

// mirroring must not invent a selection the other list cannot offer
c = ctxFor('both');
c._F.payb_loan.value = 'L9';          // not in the charges dropdown
vm.runInContext('payLoanPicked()', c);
chk('a borrower the other list lacks is not mirrored', c._F.chg_loan.value, 'L1');

// --- the collapsed settings summary
c = ctxFor('both');
c._F.chgFeeSummary = { textContent: '' };
vm.runInContext(slice('window.chgFeeSummary=function()') + '; chgFeeSummary();', c);
chk('settings summary shows the policy',
  c._F.chgFeeSummary.textContent, '— ₹500/month late fee · interest auto · 7 grace days');

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHARGE-SCOPE CHECKS PASS');
process.exitCode = fails ? 1 : 0;
