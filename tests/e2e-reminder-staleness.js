// Reported: "Dinesh Chandra Mishra's loan is Active but he is listed under
// Overdue Reminder."
//
// The Action Centre queue is a snapshot. autoMkItem() freezes the wording, the
// outstanding and the due date at scan time, and the item then sits in
// localStorage until it is sent, dismissed, or its loan is deleted. Nothing
// re-read the ledger. So a borrower scanned as "overdue by 7 days" in August
// was still sitting in the queue in late October, quoting August's figures,
// while his loan record correctly said Active -- and Review & send would have
// sent him a demand for money he had already paid.
//
// These checks run the real autoQueueRevalidate() out of the source.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '04-overdue.js'), 'utf8');
function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}

const TODAY = '2026-10-29';

function makeApp(queue, loansArr) {
  const store = { shivam_autoqueue_v1: JSON.stringify(queue) };
  const ctx = {
    AUTOQ_STORE: 'shivam_autoqueue_v1',
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    },
    loans: loansArr,
    todayISO: () => TODAY,
    // same rule as the app: outstanding<=0 Closed, arrears>0 Overdue, else Active
    autoStatus: (l) => {
      const out = Number(l.outstanding) || 0;
      if (out <= 0) return 'Closed';
      if ((Number(l.arrears) || 0) > 0) return 'Overdue';
      return 'Active';
    },
    repDaysBetween: (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000),
    // stand-in for the real message builder: proves the item is REBUILT from the
    // live loan rather than kept as frozen text
    autoMkItem: (l, cat) => ({
      msg: cat + ' for ' + l.name + ': outstanding ' + (Number(l.outstanding) || 0) +
           ', due ' + (l.due || ''),
      vars: { outstanding: String(Number(l.outstanding) || 0), due_date: l.due || '' },
    }),
    JSON, String, Number, Array, Object, Date, Math, console,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext([extract('autoQueueLoad'), extract('autoQueueSave'),
                   extract('autoQueueRevalidate')].join('\n'), ctx);
  return ctx;
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

const item = (over) => Object.assign({
  id: 'aq1', name: 'Mr. Dinesh Chandra Mishra', phone: '8545090700', acno: '16287',
  cat: 'Overdue Reminder', reason: 'Overdue by 7 days',
  msg: 'frozen August text: outstanding 462000, due 2026-08-09',
  vars: { outstanding: '462000', due_date: '2026-08-09' },
  key: 'od:L287:2026-08-09:7', createdAt: 1,
}, over || {});

const loan = (over) => Object.assign({
  id: 'L287', name: 'Mr. Dinesh Chandra Mishra', phone: '8545090700', acno: '16287',
  principal: 500000, outstanding: 462000, arrears: 0, due: '2026-11-09',
}, over || {});

// --- 1. the reported case: he has paid, so the loan is Active again
let app = makeApp([item()], [loan()]);
let out = app.autoQueueRevalidate();
chk('a borrower who has paid is dropped from the overdue queue', out.length, 0);
chk('  and the drop is persisted, not just returned',
  JSON.parse(app.localStorage.getItem('shivam_autoqueue_v1')).length, 0);

// --- 2. a borrower who really IS still overdue must NOT be dropped
app = makeApp([item()], [loan({ arrears: 48000, due: '2026-10-09' })]);
out = app.autoQueueRevalidate();
chk('a genuinely overdue borrower is kept', out.length, 1);
chk('  the message is rebuilt from the ledger, not the frozen text',
  /outstanding 462000, due 2026-10-09/.test(out[0].msg), true);
chk('  the frozen August wording is gone', /frozen August text/.test(out[0].msg), false);
chk('  and the reason states the real age of the arrears',
  out[0].reason, 'Overdue by 20 days');

// --- 3. a loan that has since been closed
app = makeApp([item()], [loan({ outstanding: 0, arrears: 0 })]);
chk('a settled loan is dropped', app.autoQueueRevalidate().length, 0);

// --- 4. a loan deleted from the book entirely
app = makeApp([item()], []);
chk('a deleted loan is dropped', app.autoQueueRevalidate().length, 0);

// --- 5. matched by account number when the loan id has changed
app = makeApp([item()], [loan({ id: 'DIFFERENT', arrears: 48000, due: '2026-10-09' })]);
chk('falls back to the account number', app.autoQueueRevalidate().length, 1);

// --- 6. EMI reminders: only valid while current AND still ahead of today
const emiItem = (over) => Object.assign({
  id: 'aq2', name: 'X', phone: '9', acno: '16291', cat: 'EMI Reminder',
  reason: 'EMI due in 3 days', msg: 'frozen', vars: {},
  key: 'emi:L291:2026-11-01:3', createdAt: 1,
}, over || {});
const emiLoan = (over) => Object.assign({
  id: 'L291', name: 'X', phone: '9', acno: '16291',
  principal: 100000, outstanding: 80000, arrears: 0, due: '2026-11-01',
}, over || {});

app = makeApp([emiItem()], [emiLoan()]);
out = app.autoQueueRevalidate();
chk('an upcoming EMI reminder survives', out.length, 1);
chk('  with the days-to-go restated', out[0].reason, 'EMI due in 3 days');

app = makeApp([emiItem()], [emiLoan({ arrears: 5000 })]);
chk('an EMI reminder for a now-overdue loan is dropped (the wording would be wrong)',
  app.autoQueueRevalidate().length, 0);

app = makeApp([emiItem()], [emiLoan({ due: '2026-10-01' })]);
chk('an EMI reminder whose date has passed is dropped', app.autoQueueRevalidate().length, 0);

app = makeApp([emiItem()], [emiLoan({ outstanding: 0 })]);
chk('an EMI reminder for a closed loan is dropped', app.autoQueueRevalidate().length, 0);

// --- 7. event records must be left completely alone
const events = [
  { id: 'e1', cat: 'Payment Confirmation', key: 'pay:L287:2026-09-01:0:7400', msg: 'thanks', reason: 'Payment received' },
  { id: 'e2', cat: 'Loan Approval', key: 'appr:L287', msg: 'approved', reason: 'Loan sanctioned' },
  { id: 'e3', cat: 'Birthday Greeting', key: 'bday:L287:2026', msg: 'happy birthday', reason: 'Birthday today' },
];
app = makeApp(events, [loan()]);
out = app.autoQueueRevalidate();
chk('payment/approval/birthday records are untouched', out.length, 3);
chk('  and their wording is not rewritten', out.map(x => x.msg), ['thanks', 'approved', 'happy birthday']);

// --- 8. safety: must not wipe the queue before the book has loaded
app = makeApp([item()], []);
app.loans = undefined;
chk('an unloaded book changes nothing', app.autoQueueRevalidate().length, 1);

// --- 9. a mixed queue: only the invalid overdue item goes
app = makeApp([item(), item({ id: 'aq9', acno: '16291', key: 'od:L291:2026-10-09:7' }), events[0]],
              [loan(), emiLoan({ id: 'L291', arrears: 48000, due: '2026-10-09' })]);
out = app.autoQueueRevalidate();
chk('mixed queue keeps exactly the right items', out.map(x => x.id), ['aq9', 'e1']);

// --- 10. One account, one reminder per category.
// Reported: "why are the same customer names repeated". Each time an
// instalment date moved, a fresh item was queued under a new key and the old
// one was left behind, so Varun Chowdhary stood in the list three times with
// the same account, amount and due date.
const dupLoan = { id: 'L290', name: 'Mr. Varun Chowdhary', phone: '9628887776', acno: '16290',
                  principal: 100000, outstanding: 80000, arrears: 0, due: '2026-11-13' };
const dupItem = (id, keyDue, at) => ({
  id: id, name: 'Mr. Varun Chowdhary', phone: '9628887776', acno: '16290',
  cat: 'EMI Reminder', reason: 'EMI due in 7 days', msg: 'frozen', vars: {},
  key: 'emi:L290:' + keyDue + ':7', createdAt: at,
});
app = makeApp([dupItem('a', '2026-09-13', 1), dupItem('b', '2026-10-13', 2), dupItem('c', '2026-11-13', 3)], [dupLoan]);
out = app.autoQueueRevalidate();
chk('three entries for one account collapse to one', out.length, 1);
chk('  and it is the most recent', out[0].id, 'c');

// duplicate LOAN records for the same account collapse too
app = makeApp([dupItem('a', '2026-11-13', 1), dupItem('b', '2026-11-13', 2)],
              [dupLoan, Object.assign({}, dupLoan, { id: 'L290-copy' })]);
chk('duplicate records of one account still yield one reminder',
  app.autoQueueRevalidate().length, 1);

// two DIFFERENT accounts must both survive
const other = { id: 'L276', name: 'M/S M.A. Enterprises', phone: '9839755204', acno: '16276',
                principal: 90000, outstanding: 70000, arrears: 0, due: '2026-11-01' };
app = makeApp([dupItem('a', '2026-11-13', 1),
               Object.assign(dupItem('b', '2026-11-01', 2), { id: 'b', acno: '16276', name: 'M/S M.A. Enterprises', phone: '9839755204', key: 'emi:L276:2026-11-01:3' })],
              [dupLoan, other]);
out = app.autoQueueRevalidate();
chk('two different accounts are both kept', out.length, 2);

// an overdue and an EMI item for the SAME account are different categories
app = makeApp([dupItem('a', '2026-11-13', 1),
               { id: 'z', name: 'Mr. Varun Chowdhary', phone: '9628887776', acno: '16290',
                 cat: 'Overdue Reminder', reason: 'Overdue by 7 days', msg: 'f', vars: {},
                 key: 'od:L290:2026-11-13:7', createdAt: 2 }],
              [Object.assign({}, dupLoan, { arrears: 5000 })]);
out = app.autoQueueRevalidate();
chk('an overdue account keeps its overdue notice only',
  out.map(x => x.cat), ['Overdue Reminder']);

// two payment confirmations are two real events -- never collapsed
app = makeApp([
  { id: 'p1', cat: 'Payment Confirmation', key: 'pay:L290:2026-09-01:0:7400', msg: 'a', reason: 'r' },
  { id: 'p2', cat: 'Payment Confirmation', key: 'pay:L290:2026-10-01:1:7400', msg: 'b', reason: 'r' },
], [dupLoan]);
chk('two separate payments stay two confirmations', app.autoQueueRevalidate().length, 2);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL REMINDER-STALENESS CHECKS PASS');
process.exitCode = fails ? 1 : 0;
