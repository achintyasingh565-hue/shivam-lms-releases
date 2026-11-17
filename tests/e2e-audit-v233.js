// The v2.33.0 whole-app audit, as named cases.
//
// fuzz-consistency.js proves no two views disagree over thousands of random
// loans. These are the specific, human-readable versions of what it found —
// each one a loan that could sit in the book — plus the figures on the
// dashboard that called a whole balance "overdue".

const fs = require('fs');
const path = require('path');
const { makeSandbox } = require('./harness');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
const pay = (d, a, extra) => Object.assign({ date: d, amount: a, status: 'Cleared' }, extra || {});
const eight = () => ({ id: 'E', principal: 60000, rate: 2, tenure: 8, tint: 9600, tpay: 69600, emi: 8700, disb: '2026-01-09', charges: [], payments: [] });

// ---------------------------------------------------------------------------
console.log('--- a closed loan must not show money "remaining" ---');
{
  // every EMI paid, a Rs 500 late fee charged in June and handed over with the last EMI
  const S = makeSandbox('2026-10-01');
  const l = eight();
  l.charges = [{ type: 'Late fee', amount: 500, date: '2026-06-09', emiIdx: 5 }];
  l.payments = ['02', '03', '04', '05', '06', '07', '08'].map((m) => pay('2026-' + m + '-09', 8700)).concat([pay('2026-09-09', 9200)]);
  S.recomputeLoan(l);
  chk('the ledger has it closed', [l.outstanding, l.status], [0, 'Closed']);
  chk('the modal schedule / Welcome Letter says nothing remains (was Rs 500)', S.build(l).remaining, 0);
  const D = S.repScheduleData(l);
  chk('the report schedule closes at nil too', D.rows[D.rows.length - 1].bal, 0);
}

// ---------------------------------------------------------------------------
console.log('\n--- an interest-only month on an EMI loan ---');
{
  // 20,000 at 2.5% for 4 months, EMI 5,500. January serviced by interest only.
  const S = makeSandbox('2026-06-20');
  const l = { id: 'F', principal: 20000, rate: 2.5, tenure: 4, tint: 2000, tpay: 22000, emi: 5500, disb: '2026-01-05', charges: [],
    payments: [pay('2026-01-28', 5500, { intOnly: true }), pay('2026-02-17', 1775), pay('2026-04-06', 5500), pay('2026-04-30', 2750), pay('2026-05-29', 5500)] };
  S.recomputeLoan(l);
  const D = S.repScheduleData(l), T = S.dueToDate(l);
  const paidCol = D.rows.reduce((a, r) => a + (Number(r.paid) || 0), 0);
  chk('the Paid column adds up to everything received (Rs 1,775 was missing)', paidCol + (D.advance || 0), 15525 + 5500);
  chk('the schedule still closes on the ledger', D.rows[D.rows.length - 1].bal, l.outstanding);
  chk('the closing advisory agrees with the ledger on what is overdue', Math.min(l.outstanding, T.outstanding), l.arrears);

  // the advisory used to count one instalment too many for each interest month
  const g = { id: 'G', principal: 60000, rate: 2, tenure: 17, tint: 20400, tpay: 80400, emi: 4729, disb: '2026-04-03', charges: [],
    payments: [pay('2026-05-16', 4729, { intOnly: true })] };
  const S2 = makeSandbox('2026-06-20'); S2.recomputeLoan(g);
  chk('one interest month, one EMI then missed: the ledger says one EMI overdue', g.arrears, 4729);
  chk('  and so does the closing advisory (it said two)', S2.dueToDate(g).outstanding, 4729);
}

// ---------------------------------------------------------------------------
console.log('\n--- money held as an "advance" while an instalment is still short ---');
{
  // 3 x 10,000. Rs 5,000 against EMI 1, then a lump of Rs 30,000 the next month.
  const S = makeSandbox('2026-03-20');
  const l = { id: 'A', principal: 28500, rate: 1.754386, tenure: 3, tint: 1500, tpay: 30000, emi: 10000, disb: '2026-01-10', charges: [],
    payments: [pay('2026-02-10', 5000), pay('2026-03-10', 30000)] };
  S.recomputeLoan(l);
  const D = S.repScheduleData(l);
  chk('overpaid in total: the ledger has it closed', [l.outstanding, l.status], [0, 'Closed']);
  chk('the schedule closes at nil (it showed Rs 5,000 still owed)', D.rows[D.rows.length - 1].bal, 0);
}

// ---------------------------------------------------------------------------
console.log('\n--- byaj: a charge can now be paid ---');
{
  const S = makeSandbox('2026-06-01');
  const mk = () => ({ id: 'B', interestOnly: true, principal: 100000, rate: 2, tenure: 0, disb: '2026-01-01',
    charges: [{ type: 'Late fee', amount: 500, date: '2026-03-10' }],
    payments: ['02', '03', '04', '05', '06'].map((m) => pay('2026-' + m + '-01', 2000)) });

  let l = mk(); S.recomputeLoan(l);
  chk('fee unpaid: principal + 500, and the 500 is due now', [l.outstanding, l.arrears], [100500, 500]);

  l = mk(); l.payments.push(pay('2026-03-15', 500)); S.recomputeLoan(l);
  chk('fee paid by an ordinary receipt: back to the principal alone', [l.outstanding, l.arrears, l.status], [100000, 0, 'Active']);
  chk('  the principal itself is untouched', l.outstanding, 100000);
  chk('  the report schedule closes there too', (() => { const D = S.repScheduleData(l); const w = D.rows.filter((r) => r.bal != null); return w[w.length - 1].bal; })(), 100000);
  chk('  and says why', S.repScheduleData(l).rows.some((r) => r.st === 'Charges settled'), true);
  chk('  the modal schedule agrees', S.build(l).remaining, 100000);
  chk('  the closing advisory agrees', S.dueToDate(l).outstanding, 0);

  l = mk(); l.payments.push(pay('2026-03-15', 500)); l.payments.push(pay('2026-06-01', 100000, { kind: 'principal' })); S.recomputeLoan(l);
  chk('then the principal is returned: the loan CLOSES (it stayed Overdue for Rs 500)', [l.outstanding, l.status], [0, 'Closed']);

  // interest that was merely paid on time is not "surplus"
  l = mk(); l.charges = []; S.recomputeLoan(l);
  chk('no charges: nothing about a byaj loan moves', [l.outstanding, l.arrears, l.emi], [100000, 0, 2000]);

  // an interest SHORTFALL is not hidden by any of this
  l = mk(); l.payments = l.payments.slice(0, 3); S.recomputeLoan(l);
  chk('two months unserviced plus the fee: both still owed', l.arrears, 4000 + 500);
}

// ---------------------------------------------------------------------------
console.log('\n--- byaj: interest owed after the principal comes back shows on the schedule ---');
{
  const S = makeSandbox('2026-08-01');
  const l = { id: 'R', interestOnly: true, principal: 50000, rate: 2, tenure: 0, disb: '2026-01-01', charges: [],
    payments: [pay('2026-02-01', 1000), pay('2026-06-01', 50000, { kind: 'principal' })] };
  S.recomputeLoan(l);
  chk('five months fell due, one was serviced: Rs 4,000 still owed', [l.outstanding, l.status], [4000, 'Overdue']);
  const D = S.repScheduleData(l); const w = D.rows.filter((r) => r.bal != null);
  chk('the report schedule closes on Rs 4,000 (it closed at nil)', w[w.length - 1].bal, 4000);
  chk('  on a line that names it', D.rows.some((r) => r.st === 'Interest unpaid' && r.charge === 4000), true);
  chk('the modal schedule agrees', S.build(l).remaining, 4000);
}

// ---------------------------------------------------------------------------
console.log('\n--- "overdue" on the dashboard means the amount overdue ---');
{
  const DASH = R('src/app/06-dashboard.js'), AC = R('src/app/35-action-centre.js');
  chk('the Overdue Amount tile totals arrears', /kpi\('Overdue Amount', inr\(arrearsAmt\)/.test(DASH), true);
  chk('  not the whole balance of each overdue account', /kpi\('Overdue Amount', inr\(overdueAmt\)/.test(DASH), false);
  chk('  Portfolio at Risk keeps the whole balance — that is what it measures', /kpiGauge\('Portfolio at Risk'[^\n]*inr\(overdueAmt\)\} at risk/.test(DASH), true);
  chk('the bell shows arrears for an overdue account and the EMI for one due soon',
    /it\.t==='overdue' \? \(Number\(it\.l\.arrears\)\|\|Number\(it\.l\.outstanding\)\|\|0\) : \(Number\(it\.l\.emi\)/.test(DASH), true);
  chk('the Action Centre "Overdue" box totals arrears', /amt:\(arr>0\?Math\.min\(arr,out\):out\)/.test(AC), true);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
