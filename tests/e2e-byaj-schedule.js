// The EMI schedule and the byaj ledger must classify payments the same way.
//
// recomputeLoan's byaj engine counts a payment against the PRINCIPAL only when
// it carries kind:'principal'; everything else is interest. The schedule looked
// only at intOnly / type==='Interest', so an ordinary monthly interest payment
// entered without the tick was treated as principal there: the ledger held the
// principal at 1,00,000 while the printed schedule showed it falling to 98,000.
//
// Also covers a regular payment landing in a post-tenure interest-only month,
// which the extension loop used to skip entirely.

const { makeSandbox } = require('./harness');
const S = makeSandbox('2026-10-01');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
const close = (l) => { const r = S.repScheduleData(l).rows; return r[r.length - 1].bal; };
const pay = (d, a, x) => Object.assign({ id: 'p' + d + a, date: d, amount: a, status: 'Cleared' }, x || {});

function byaj(payments, charges) {
  const l = { id: 'B', name: 'T', acno: '1', interestOnly: true, principal: 100000, rate: 2,
              tenure: 0, disb: '2026-01-01', due: '2026-02-01',
              charges: charges || [], payments: payments };
  S.recomputeLoan(l);
  return l;
}

// --- the reported case: an untagged monthly interest payment
let l = byaj([pay('2026-02-01', 2000)]);
chk('ledger keeps the principal', l.outstanding, 100000);
chk('schedule agrees with the ledger', close(l), l.outstanding);

// --- explicitly tagged interest behaves the same
l = byaj([pay('2026-02-01', 2000, { intOnly: true, type: 'Interest' })]);
chk('a tagged interest payment also leaves the principal', close(l), l.outstanding);

// --- only kind:'principal' moves it
l = byaj([pay('2026-02-01', 2000), pay('2026-03-01', 40000, { kind: 'principal' })]);
chk('a principal return reduces the ledger', l.outstanding, 60000);
chk('  and the schedule follows', close(l), l.outstanding);

// --- several months of interest never erode the principal
const many = [];
for (let m = 2; m <= 9; m++) many.push(pay('2026-' + String(m).padStart(2, '0') + '-01', 2000));
l = byaj(many);
chk('eight untagged interest months leave the principal intact', l.outstanding, 100000);
chk('  schedule agrees', close(l), l.outstanding);

// --- charges ride on top on both sides
l = byaj([pay('2026-02-01', 2000)], [{ id: 'c1', type: 'Late fee', amount: 500, date: '2026-02-05' }]);
chk('a charge is added to the ledger', l.outstanding, 100500);
chk('  and to the schedule', close(l), l.outstanding);

// --- a pending payment counts on neither side
l = byaj([Object.assign(pay('2026-02-01', 40000, { kind: 'principal' }), { status: 'Pending' })]);
chk('an uncleared principal return does not move the ledger', l.outstanding, 100000);
chk('  nor the schedule', close(l), l.outstanding);

// --- post-tenure month holding BOTH an interest and a regular payment
const t = S.calcLoanTotals(1000, 0, 1);
const ext = { id: 'X', name: 'T', acno: '2', principal: 1000, rate: 0, tenure: 1,
  tint: t.tint, tpay: t.tpay, emi: t.emi, disb: '2026-01-01', due: '2026-02-01', charges: [],
  payments: [pay('2026-05-01', 100, { intOnly: true, type: 'Interest' }), pay('2026-05-15', 100)] };
S.recomputeLoan(ext);
chk('a regular payment after tenure still reaches the ledger', ext.outstanding, 900);
chk('  and the schedule closes at the same figure', close(ext), ext.outstanding);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL BYAJ-SCHEDULE CHECKS PASS');
process.exitCode = fails ? 1 : 0;
