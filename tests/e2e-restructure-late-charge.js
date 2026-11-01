// A restructured loan's schedule must still reconcile with the ledger.
//
// The paidBase>0 branch renders exactly the fixed instalment rows and returns.
// Charges are attached to the instalment they belong to, so a fee dated AFTER
// the final instalment matched no row, never reached cumChg, and the schedule
// closed below l.outstanding — the borrower's printed schedule understated what
// was owed.

const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-12-01');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
const close = (l) => { const r = S.repScheduleData(l).rows; return r[r.length - 1].bal; };

function restructured(charges) {
  const l = { id: 'R', name: 'T', acno: '1', principal: 2000, rate: 0, tenure: 2,
    tint: 0, tpay: 2000, baseOut: 2000, emi: 1000, paidBase: 100,
    disb: '2026-01-01', due: '2026-02-01', charges: charges || [], payments: [] };
  S.recomputeLoan(l);
  return l;
}

// --- the reported case: a fee dated after the last instalment
let l = restructured([{ id: 'c1', type: 'Late fee', amount: 500, date: '2026-09-01' }]);
chk('ledger includes the late charge', l.outstanding, 2500);
chk('schedule now reconciles with it', close(l), l.outstanding);

// --- no charges: unchanged behaviour
l = restructured([]);
chk('with no charges the schedule is unchanged', close(l), l.outstanding);

// --- a charge inside the instalment window is counted once, not twice
l = restructured([{ id: 'c2', type: 'Late fee', amount: 300, date: '2026-02-05' }]);
chk('an in-window charge is counted once', close(l), l.outstanding);
chk('  (ledger figure)', l.outstanding, 2300);

// --- both: one in-window, one after
l = restructured([{ id: 'c3', type: 'Late fee', amount: 300, date: '2026-02-05' },
                  { id: 'c4', type: 'Bounce fee', amount: 500, date: '2026-09-01' }]);
chk('an in-window and a late charge together reconcile', close(l), l.outstanding);
chk('  (ledger figure)', l.outstanding, 2800);

// --- an undated charge still lands
l = restructured([{ id: 'c5', type: 'Late fee', amount: 250 }]);
chk('an undated charge reconciles too', close(l), l.outstanding);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL RESTRUCTURE-LATE-CHARGE CHECKS PASS');
process.exitCode = fails ? 1 : 0;
