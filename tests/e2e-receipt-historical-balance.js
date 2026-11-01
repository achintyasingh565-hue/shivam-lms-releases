// Reprinting an old receipt must show the balance as it was THEN.
//
// balanceAtPayment added every charge currently on the loan, with no regard to
// when it was raised. Reprint a January receipt after a February fee and the
// reprint disagreed with the copy the borrower was handed.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '08-certificate.js'), 'utf8');
function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}
const ctx = { Math, Number, String, Array, Object };
vm.createContext(ctx);
vm.runInContext(extract('balanceAtPayment') + '\nthis.bal = balanceAtPayment;', ctx);
const bal = ctx.bal;

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
const P = (d, a, x) => Object.assign({ date: d, amount: a, status: 'Cleared' }, x || {});

// the reported case
const l = { tpay: 124000,
  charges: [{ id: 'c1', type: 'Late fee', amount: 500, date: '2026-02-10' }],
  payments: [P('2026-01-05', 2000), P('2026-03-01', 10000)] };
chk('January receipt excludes a February fee', bal(l, 0), 122000);
chk('March receipt includes it', bal(l, 1), 112500);

// a charge on the SAME day as the payment counts
const sameDay = { tpay: 100000,
  charges: [{ id: 'c2', amount: 400, date: '2026-01-05' }],
  payments: [P('2026-01-05', 1000)] };
chk('a charge raised the same day counts', bal(sameDay, 0), 99400);

// undated charges keep their old behaviour (treated as already levied)
const undated = { tpay: 100000, charges: [{ id: 'c3', amount: 300 }], payments: [P('2026-01-05', 1000)] };
chk('an undated charge still counts', bal(undated, 0), 99300);

// a payment with no date must not hide charges
const noDate = { tpay: 100000, charges: [{ id: 'c4', amount: 200, date: '2026-05-01' }],
                 payments: [{ amount: 1000, status: 'Cleared' }] };
chk('an undated payment counts every charge', bal(noDate, 0), 99200);

// byaj: the date rule applies on that path too
const byaj = { interestOnly: true, principal: 50000,
  charges: [{ id: 'c5', amount: 700, date: '2026-06-01' }],
  payments: [P('2026-02-01', 1000), P('2026-07-01', 1000)] };
chk('byaj February receipt excludes a June fee', bal(byaj, 0), 50000);
chk('byaj July receipt includes it', bal(byaj, 1), 50700);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL RECEIPT-HISTORY CHECKS PASS');
process.exitCode = fails ? 1 : 0;
