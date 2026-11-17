// EMI day.
//
// The schedule was counted from the disbursement date and nothing else: a loan
// disbursed on the 14th had every EMI on the 14th. A borrower paid on the 20th
// could only be accommodated by typing a Next Due Date by hand — which changed
// the label on screen and none of the arithmetic behind it.
//
// A typed date that sits within a month of the schedule date is now the
// borrower's EMI day: that instalment and every later one move to it, and
// because the change lives in emiDueDate() itself, arrears, late fees, the
// schedule, the documents and the reminders all move together.
//
// What must NOT move: the money (EMI, interest, total payable, outstanding),
// and the dates of instalments already behind us.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const CERT = R('src/app/08-certificate.js');
const HLP = R('src/app/02-helpers-nav.js');
const CRUD = R('src/app/07-loans-crud.js');
const CORE = R('src/app/01-core-store.js');

function extract(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

function world(today) {
  const ls = {};
  const ctx = {
    todayISO: () => today, console, Math, Number, Array, Date, JSON, String, isNaN, isFinite, Object,
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
  };
  vm.createContext(ctx);
  const code = [extract(HLP, 'repPad'), extract(HLP, 'repAddMonths'), extract(HLP, 'repDaysBetween')]
    .concat(['emiDueDate', 'firstUnpaidIdx', 'emiDayDecide', 'emiDayApply', 'emiDayClear', 'emiDayOf', 'loanFirstDue', 'loanLastDue',
      'calcLoanTotals', '_recomputeInterestOnly', 'recomputeLoan', 'getLateGraceDays', '_lfAddDays', '_ymKey', 'emiPaidByIndex', 'overdueEmiIdxs']
      .map((n) => extract(CERT, n)))
    .join('\n') +
    '\nthis.due=emiDueDate; this.decide=emiDayDecide; this.apply=emiDayApply; this.clear=emiDayClear; this.dayOf=emiDayOf;' +
    'this.first=loanFirstDue; this.last=loanLastDue; this.re=recomputeLoan; this.k=firstUnpaidIdx; this.od=overdueEmiIdxs;';
  vm.runInContext(code, ctx);
  return ctx;
}
// Mrs. Shalu's shape: 2,50,000 at 2% for 48 months, disbursed 14 Oct
const shalu = () => ({ id: 'S', principal: 250000, rate: 2, tenure: 48, tint: 240000, tpay: 490000, emi: 10208, charges: [], payments: [], disb: '2026-10-14' });
const pay = (d, a) => ({ date: d, amount: a || 10208, status: 'Cleared' });

// ---------------------------------------------------------------------------
console.log('--- what a typed date means ---');
{
  const W = world('2026-11-16');
  chk('20 Nov on a loan whose schedule says 14 Nov: an EMI day', W.decide(shalu(), '2026-11-20'), { mode: 'day', idx: 1, date: '2026-11-20' });
  chk('5 Nov — sooner than the schedule, after disbursement: an EMI day', W.decide(shalu(), '2026-11-05').mode, 'day');
  chk('the day of disbursement itself: not an instalment date', W.decide(shalu(), '2026-10-14').mode, 'oneoff');
  chk('20 Dec — past the NEXT instalment: a one-off, not a day', W.decide(shalu(), '2026-12-20').mode, 'oneoff');
  chk('not a date at all', W.decide(shalu(), '').mode, 'none');
  chk('rubbish', W.decide(shalu(), '20-11-2026').mode, 'none');

  // one instalment per calendar month, consecutive months — everything files payments by month
  const d28 = shalu(); d28.disb = '2026-10-28';
  chk('FIRST instalment may land in the next month (disbursed 28 Oct, EMI day the 5th)', W.decide(d28, '2026-12-05'), { mode: 'day', idx: 1, date: '2026-12-05' });
  const two = shalu(); two.payments = [pay('2026-11-14'), pay('2026-12-14')];
  chk('a LATER instalment may only change its day inside its own month', W.decide(two, '2027-01-25').mode, 'day');
  chk('  not jump into the next month (that would leave January with no instalment)', W.decide(two, '2027-02-05').mode, 'oneoff');
  chk('  nor back into the previous one (two instalments in December)', W.decide(two, '2026-12-28').mode, 'oneoff');

  // three behind, and the owner types a promise date
  const behind = shalu(); behind.disb = '2026-08-14';
  chk('three EMIs behind, promise date 30 Nov: one-off — the arrears must not vanish', W.decide(behind, '2026-11-30').mode, 'oneoff');

  const byaj = shalu(); byaj.interestOnly = true;
  chk('a byaj loan does not take an EMI day', W.decide(byaj, '2026-11-20').mode, 'oneoff');
  const noEmi = shalu(); noEmi.emi = 0;
  chk('a loan with no EMI does not either', W.decide(noEmi, '2026-11-20').mode, 'oneoff');
  const shifted = shalu(); shifted.payments = [{ date: '2026-11-10', amount: 5000, status: 'Cleared', intOnly: true }];
  chk('interest-only months already moving the schedule: left as a one-off', W.decide(shifted, '2026-12-20').mode, 'oneoff');

  // mid-tenure: two paid, the third instalment is the one being moved
  const mid = shalu(); mid.payments = [pay('2026-11-14'), pay('2026-12-14')];
  chk('mid-tenure it attaches to the first UNPAID instalment', W.decide(mid, '2027-01-20'), { mode: 'day', idx: 3, date: '2027-01-20' });
}

// ---------------------------------------------------------------------------
console.log('\n--- the dates ---');
{
  const W = world('2026-11-16');
  const l = shalu();
  chk('before: EMI 1 on the 14th', [W.due(l, 1), W.due(l, 2)], ['2026-11-14', '2026-12-14']);
  W.apply(l, W.decide(l, '2026-11-20'));
  chk('after: EMI 1 on the 20th', W.due(l, 1), '2026-11-20');
  chk('  and every later one follows it', [W.due(l, 2), W.due(l, 3), W.due(l, 48)], ['2026-12-20', '2027-01-20', '2030-10-20']);
  chk('  the hand-set flag is not used for this', l.dueManual, false);
  chk('  the day is readable back', W.dayOf(l), 20);

  // 31st: clamps to the month end and comes back, anchored to the original day
  const m = shalu(); m.disb = '2026-12-20'; W.apply(m, { mode: 'day', idx: 1, date: '2027-01-31' });
  chk('an EMI day of the 31st: 28 Feb, then back to 31 Mar', [W.due(m, 2), W.due(m, 3), W.due(m, 4)], ['2027-02-28', '2027-03-31', '2027-04-30']);

  // instalments already behind us keep their dates
  const mid = shalu(); mid.payments = [pay('2026-11-14'), pay('2026-12-14')];
  W.apply(mid, W.decide(mid, '2027-01-20'));
  chk('mid-tenure: EMIs 1 and 2 keep the 14th', [W.due(mid, 1), W.due(mid, 2)], ['2026-11-14', '2026-12-14']);
  chk('  EMI 3 onward move to the 20th', [W.due(mid, 3), W.due(mid, 4)], ['2027-01-20', '2027-02-20']);

  // a second change later keeps the first one's history
  mid.payments.push(pay('2027-01-20'));
  W.apply(mid, W.decide(mid, '2027-02-25'));
  chk('a later change: 1-2 on the 14th, 3 on the 20th, 4 onward on the 25th',
    [W.due(mid, 2), W.due(mid, 3), W.due(mid, 4), W.due(mid, 5)], ['2026-12-14', '2027-01-20', '2027-02-25', '2027-03-25']);

  // back to the disbursement day
  const c = shalu(); W.apply(c, W.decide(c, '2026-11-20')); W.clear(c);
  chk('"use schedule" on an unpaid loan removes it entirely', [c.emiAnchors, W.due(c, 1)], [undefined, '2026-11-14']);
  W.clear(mid);
  chk('"use schedule" mid-tenure: history kept, the rest back on the 14th',
    [W.due(mid, 3), W.due(mid, 4), W.due(mid, 5)], ['2027-01-20', '2027-02-14', '2027-03-14']);

  // "use schedule" after the FIRST instalment was moved into another month must keep months consecutive
  const sh = shalu(); sh.disb = '2026-10-28'; W.apply(sh, { mode: 'day', idx: 1, date: '2026-12-05' });
  sh.payments = [pay('2026-12-05')]; W.clear(sh);
  chk('back to the disbursement day, months still consecutive: 5 Dec, 28 Jan, 28 Feb',
    [W.due(sh, 1), W.due(sh, 2), W.due(sh, 3)], ['2026-12-05', '2027-01-28', '2027-02-28']);

  // a restructure starts a new plan
  const r = shalu(); W.apply(r, W.decide(r, '2026-11-20')); r.baseDate = '2027-03-01';
  chk('an EMI day set BEFORE a restructure is ignored after it', W.due(r, 1), '2027-04-01');
  const b = shalu(); b.interestOnly = true; b.emiAnchors = [{ idx: 1, date: '2026-11-20' }];
  chk('a byaj loan ignores anchors even if one is present', W.due(b, 1), '2026-11-14');
}

// ---------------------------------------------------------------------------
console.log('\n--- arrears, status and next due follow the EMI day ---');
{
  const mk = () => { const l = shalu(); world('2026-11-16').apply(l, { mode: 'day', idx: 1, date: '2026-11-20' }); return l; };
  const at = (day, l) => { world(day).re(l); return [l.arrears, l.status, l.due]; };

  chk('16 Nov: nothing due yet', at('2026-11-16', mk()), [0, 'Active', '2026-11-20']);
  chk('20 Nov: the EMI is due', at('2026-11-20', mk()), [10208, 'Overdue', '2026-11-20']);

  let l = mk(); l.payments = [pay('2026-11-20')];
  chk('paid on the 20th: next due is 20 Dec — not 14 Dec', at('2026-11-21', l), [0, 'Active', '2026-12-20']);
  chk('16 Dec: the 14th has passed and nothing is overdue', at('2026-12-16', l), [0, 'Active', '2026-12-20']);
  chk('21 Dec, unpaid: overdue since the 20th', at('2026-12-21', l), [10208, 'Overdue', '2026-12-20']);

  // the money is untouched
  const plain = shalu(); world('2026-11-16').re(plain);
  const day = mk(); world('2026-11-16').re(day);
  chk('outstanding, EMI, total payable and interest are identical with and without',
    [day.outstanding, day.emi, day.tpay, day.tint], [plain.outstanding, plain.emi, plain.tpay, plain.tint]);
}

// ---------------------------------------------------------------------------
console.log('\n--- late-fee detection follows it too ---');
{
  // grace is 7 days. Disbursement-day schedule: EMI 1 due 14 Nov -> late after 21 Nov.
  // EMI day 20: due 20 Nov -> late after 27 Nov.
  const plain = shalu(), day = shalu();
  world('2026-11-25').apply(day, { mode: 'day', idx: 1, date: '2026-11-20' });
  chk('25 Nov, no EMI day: EMI 1 is past its grace', world('2026-11-25').od(plain).map((o) => o.i), [1]);
  chk('25 Nov, EMI day 20: still inside the grace period — no late fee', world('2026-11-25').od(day).map((o) => o.i), []);
  chk('28 Nov, EMI day 20: now it is late', world('2026-11-28').od(day).map((o) => [o.i, o.due]), [[1, '2026-11-20']]);
}

// ---------------------------------------------------------------------------
console.log('\n--- the printed documents ---');
{
  const W = world('2026-11-16');
  const l = shalu();
  chk('first instalment date, plain loan', W.first(l), '2026-11-14');
  chk('last instalment date, plain loan', W.last(l), '2030-10-14');
  W.apply(l, { mode: 'day', idx: 1, date: '2026-11-20' });
  chk('with the EMI day: first', W.first(l), '2026-11-20');
  chk('  and last', W.last(l), '2030-10-20');
  const rs = shalu(); rs.baseDate = '2027-03-01';
  chk('a restructured loan still prints its ORIGINAL first date', W.first(rs), '2026-11-14');

  chk('agreement fields use it', (R('src/app/10-loan-documents.js').match(/loanFirstDue\(l\)/g) || []).length, 2);
  chk('the Loan File uses it', /loanFirstDue\(l\)/.test(R('src/app/31-loan-file.js')), true);
  chk('the Welcome Letter uses it', /loanFirstDue\(l\)/.test(R('src/app/26-welcome-letter.js')), true);
  chk('  and its instalment rows ask the engine', /emiDueDate\(l, i\) : _addM\(start, i\)/.test(R('src/app/26-welcome-letter.js')), true);
  chk('the modal schedule asks the engine', /emiDueDate\(l, i\) : ''/.test(R('src/app/17-restructure.js')), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- the modal schedule and the welcome-letter rows ---');
{
  const { makeSandbox } = require('./harness');
  const S = makeSandbox('2026-11-16');
  const plain = shalu(); const a = S.build(plain);
  const day = shalu(); day.emiAnchors = [{ idx: 1, date: '2026-11-20' }]; const b = S.build(day);
  const rowsOf = (x) => (x && x.rows) || x;
  chk('plain loan: rows on the 14th', [rowsOf(a)[0].due, rowsOf(a)[1].due], ['14 Nov 2026', '14 Dec 2026']);
  chk('EMI day 20: rows on the 20th', [rowsOf(b)[0].due, rowsOf(b)[1].due], ['20 Nov 2026', '20 Dec 2026']);
  chk('  same number of rows, same instalment', [rowsOf(b).length, rowsOf(b)[0].emi], [rowsOf(a).length, rowsOf(a)[0].emi]);
}

// ---------------------------------------------------------------------------
console.log('\n--- wiring ---');
{
  const T = R('src/index.template.html');
  chk('a hint line sits under the Next Due Date field', /id="m_due"[^>]*><div id="m_dueHint"/.test(T), true);
  chk('"use schedule" — long promised by the safety note — is now on screen', /onclick="dueUseSchedule\(\)"/.test(CRUD), true);
  chk('the preview and Save decide through the same function', (CRUD.match(/_applyDueChoice\((temp|rec)\)/g) || []).length, 2);
  chk('nothing is converted unless the date was typed in this sitting', /if\(window\._dueTyped\)\{/.test(CRUD), true);
  chk('  opening a record resets that', /window\._dueTyped=false; window\._dueCleared=false;/.test(CRUD), true);
  chk('a restructure drops the EMI day', /delete L\.emiAnchors;/.test(R('src/app/18-docgen.js')), true);

  // malformed anchors from outside are scrubbed on the way in
  const ctx = { logAudit() {}, Array, Number, String, isNaN, Object };
  vm.createContext(ctx);
  vm.runInContext(extract(CORE, 'normalizeLoans') + '\n' + extract(CORE, '_normDate') + '\nthis.n=normalizeLoans;', ctx);
  chk('a good anchor list survives loading', ctx.n([{ id: 'A', emiAnchors: [{ idx: 1, date: '2026-11-20' }] }])[0].emiAnchors, [{ idx: 1, date: '2026-11-20' }]);
  chk('rubbish in the list is dropped', ctx.n([{ id: 'B', emiAnchors: [null, { idx: 0, date: 'x' }, { idx: 2, date: '2026-12-20' }] }])[0].emiAnchors, [{ idx: 2, date: '2026-12-20' }]);
  chk('a non-list is removed', 'emiAnchors' in ctx.n([{ id: 'C', emiAnchors: 'oops' }])[0], false);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
