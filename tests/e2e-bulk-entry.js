// Bulk entry — "catch up old payments".
//
// Two reported bugs, both of which record WRONG money rather than just looking
// wrong, which is why they matter:
//   * switching borrower kept the previous borrower's amount, so opening Ajeet
//     (EMI 2,000) then Akash (EMI 2,500) laid Akash's months out at 2,000;
//   * ticking "interest only" left the full EMI in the box instead of the
//     month's interest.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '29-bulk-entry.js'), 'utf8');
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

const AJEET = { id: 'L1', name: 'Ajeet', acno: '16272', emi: 2000, tenure: 12, tint: 12000, tpay: 36000, disb: '2025-09-08', due: '2025-10-08' };
const AKASH = { id: 'L2', name: 'Akash', acno: '17877', emi: 2500, tenure: 12, tint: 6000, tpay: 36000, disb: '2025-09-01', due: '2025-10-01' };

function sheet() {
  const fields = { bulk_from: { value: '' }, bulk_to: { value: '' }, bulk_amt: { value: '' }, bulk_dayrule: { value: '' }, bulk_loan: { value: '' } };
  const ctx = {
    _$: id => fields[id] || null,
    loans: [AJEET, AKASH],
    BR: [],
    emiDueDate: (l, i) => { const d = new Date(l.due); d.setMonth(d.getMonth() + (i - 1)); return d.toISOString().slice(0, 10); },
    monthlyInterestOf: l => Math.round((Number(l.tint) || 0) / (Number(l.tenure) || 1)),
    bulkRender: () => { ctx._rendered = (ctx._rendered || 0) + 1; },
    bulkSummary: () => {},
    Date, Math, Number, String, JSON, console,
  };
  ctx.window = ctx;
  ctx._fields = fields;
  vm.createContext(ctx);
  vm.runInContext(
    'function _loan(){ var v=_$("bulk_loan").value; return loans.find(function(x){return x.id===v;})||null; }\n' +
    'function _ym(d){ return String(d||"").slice(0,7); }\n' +
    'function _ymAdd(ym,n){ var p=String(ym||"").split("-"); var d=new Date(Number(p[0]),Number(p[1])-1+n,1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }\n' +
    'function _todayYM(){ return "2026-10"; }\n' +
    slice('var _bulkLastLoanId = null;').split('\n')[0] + '\n' +
    slice('function bulkDefaults()') + '\n' +
    slice('window.bulkEdit = function(i, field, val, quiet)') + '\n', ctx);
  return ctx;
}

// 1. THE BUG: switch borrower, the amount must follow the new loan's EMI
const c = sheet();
c._fields.bulk_loan.value = 'L1';
vm.runInContext('bulkDefaults()', c);
chk('Ajeet lays out at his EMI', c._fields.bulk_amt.value, 2000);

c._fields.bulk_loan.value = 'L2';
vm.runInContext('bulkDefaults()', c);
chk('switching to Akash uses HIS EMI, not Ajeet\'s', c._fields.bulk_amt.value, 2500);

// 2. staying on the same borrower must not wipe an amount the user typed
c._fields.bulk_amt.value = 1800;             // user overrides by hand
vm.runInContext('bulkDefaults()', c);
chk('a typed amount survives a rebuild', c._fields.bulk_amt.value, 1800);

// 3. but switching away and back resets to that loan's EMI
c._fields.bulk_loan.value = 'L1';
vm.runInContext('bulkDefaults()', c);
chk('switching back resets to the new loan EMI', c._fields.bulk_amt.value, 2000);

// 4. the month range follows the borrower too
chk('from-month follows the borrower', c._fields.bulk_from.value, '2025-10');

// 5. interest-only fills the month's interest (12,000 / 12 = 1,000)
const c2 = sheet();
c2._fields.bulk_loan.value = 'L1';
vm.runInContext('bulkDefaults()', c2);
vm.runInContext('BR = [{ ym:"2025-10", date:"2025-10-08", amount:2000, use:true, intOnly:false }]', c2);
vm.runInContext('bulkEdit(0, "intOnly", true)', c2);
chk('ticking interest-only fills the interest', vm.runInContext('BR[0].amount', c2), 1000);
chk('  and the flag is set', vm.runInContext('BR[0].intOnly', c2), true);

// 6. unticking restores the EMI
vm.runInContext('bulkEdit(0, "intOnly", false)', c2);
chk('unticking restores the EMI', vm.runInContext('BR[0].amount', c2), 2000);

// 7. an amount the user typed himself is NOT overwritten by the tick
vm.runInContext('BR = [{ ym:"2025-11", date:"2025-11-08", amount:1234, use:true, intOnly:false }]', c2);
vm.runInContext('bulkEdit(0, "intOnly", true)', c2);
chk('a hand-typed amount is left alone', vm.runInContext('BR[0].amount', c2), 1234);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL BULK-ENTRY CHECKS PASS');
process.exitCode = fails ? 1 : 0;
