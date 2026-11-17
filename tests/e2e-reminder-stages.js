// Reported: "all the reminders are missing" — the All Reminders panel read
// "You're all caught up" with overdue accounts on the book — and "in custom it
// doesn't show EMI reminder but a reminder for full outstanding amount".
//
// Three causes, all pinned here against the REAL functions:
//
//  1. The scan fired only when the day count was EXACTLY 7, 3 or 1 before an
//     EMI, or exactly 1, 7, 15 or 30 after. Miss the day and the reminder never
//     existed; pass day 30 and the account was never mentioned again.
//  2. Wording was chosen on status alone. An account flagged Overdue whose
//     instalment date was still ahead got "was due on 20-11-26 and is now
//     overdue. Your outstanding amount is Rs 4,90,000" four days BEFORE the
//     date — and, falling between the two branches, no automatic reminder.
//  3. A charge the borrower had already PAID still counted as arrears, which
//     is one way a brand-new account came to be flagged Overdue at all.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const OVD = R('src/app/04-overdue.js');
const HLP = R('src/app/02-helpers-nav.js');
const REM = R('src/app/11-reminders.js');
const UI = R('src/app/05-ui-shell.js');

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

function makeApp(today, loans, store) {
  store = store || {};
  const ctx = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    loans,
    todayISO: () => today,
    autoStatus: (l) => {
      const out = Number(l.outstanding) || 0;
      if (out <= 0) return 'Closed';
      if ((Number(l.arrears) || 0) > 0) return 'Overdue';
      return 'Active';
    },
    // like the app's own: one canonical form whatever the spacing or +91 prefix
    intlPhone: (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 10 ? '91' + d.slice(-10) : ''; },
    loadWaHist: () => { try { return JSON.parse(store.hist || '[]'); } catch (e) { return []; } },
    autoMkItem: (l, cat, reason, key) => ({ id: 'q' + Math.random().toString(36).slice(2), key, name: l.name, phone: l.phone || '', acno: l.acno || '', cat, reason, createdAt: Date.now() }),
    JSON, String, Number, Array, Object, Date, Math, console, isFinite,
  };
  vm.createContext(ctx);
  const names = ['autoRemDefaults', 'autoRemCfg', 'autoRemSaveCfg', 'autoQueueLoad', 'autoQueueSave',
    'autoSeenLoad', 'autoSeenSave', 'autoSeenHas', 'autoSeenAdd', 'autoSeenRemove', 'autoSeenClearAll',
    'autoQueueAdd', 'autoEmiStage', 'autoOdStage', 'autoSentSince', 'autoRemScan'];
  const code = [
    "var AUTOREM_STORE='shivam_autorem_cfg_v1', AUTOQ_STORE='shivam_autoqueue_v1', AUTOSEEN_STORE='shivam_autorem_seen_v1';",
    extract(HLP, 'repPad'), extract(HLP, 'repDaysBetween'), extract(HLP, 'addDaysISO'),
  ].concat(names.map((n) => extract(OVD, n))).join('\n') +
    '\nthis.scan=autoRemScan; this.queue=autoQueueLoad; this.saveQ=autoQueueSave; this.emiStage=autoEmiStage; this.odStage=autoOdStage;';
  vm.runInContext(code, ctx);
  // only the two date-driven kinds are under test here
  store.shivam_autorem_cfg_v1 = JSON.stringify({ enabled: true, emi: true, overdue: true, payment: false, approval: false, birthday: false });
  ctx._store = store;
  return ctx;
}
const cats = (app) => app.queue().map((x) => x.cat + ' | ' + x.reason);

// ---------------------------------------------------------------------------
console.log('--- stages are windows, not single days ---');
{
  const app = makeApp('2026-11-16', []);
  const E = [7, 3, 1], O = [1, 7, 15, 30];
  chk('8 days before: nothing yet', app.emiStage(8, E), null);
  chk('7 days before: the 7-day stage', app.emiStage(7, E), 7);
  chk('4 days before (app not opened on day 7): still the 7-day stage', app.emiStage(4, E), 7);
  chk('3 days before: the 3-day stage', app.emiStage(3, E), 3);
  chk('2 days before: still the 3-day stage', app.emiStage(2, E), 3);
  chk('due today: the last stage', app.emiStage(0, E), 1);
  chk('already past: not an EMI reminder', app.emiStage(-1, E), null);

  chk('due today is not overdue', app.odStage(0, O), null);
  chk('1 day late', app.odStage(1, O), 1);
  chk('5 days late (opened late): the 1-day stage', app.odStage(5, O), 1);
  chk('10 days late: the 7-day stage', app.odStage(10, O), 7);
  chk('30 days late', app.odStage(30, O), 30);
  chk('59 days late: still the 30-day stage', app.odStage(59, O), 30);
  chk('68 days late: it comes back at 60', app.odStage(68, O), 60);
  chk('95 days late: and again at 90', app.odStage(95, O), 90);
}

// ---------------------------------------------------------------------------
console.log('\n--- the two accounts from the report, on 16 Nov ---');
{
  // A/C 16289: unpaid since 09-09-26 -> 68 days. Old rule: 68 is not 1/7/15/30, so nothing.
  const old = { id: 'L1', name: 'Borrower 16289', phone: '9000000001', acno: '16289', outstanding: 25000, arrears: 25000, due: '2026-09-09' };
  // Mrs. Shalu: flagged Overdue, first EMI dated 20-11-26 -> 4 days ahead. Old rule: not Active, so no
  // EMI reminder; date not past, so no overdue one either.
  const shalu = { id: 'L2', name: 'Mrs. Shalu', phone: '6394215712', acno: 'SE-2627-0002', outstanding: 490000, arrears: 10208, due: '2026-11-20', emi: 10208 };
  const app = makeApp('2026-11-16', [old, shalu]);
  const r = app.scan();
  chk('both are now raised', r.added, 2);
  chk('  16289 gets the overdue reminder, 68 days', cats(app).includes('Overdue Reminder | Overdue by 68 days'), true);
  chk('  Mrs. Shalu gets the EMI reminder — not a demand', cats(app).includes('EMI Reminder | EMI due in 4 days'), true);
  chk('  and no overdue demand is raised against a date still ahead',
    app.queue().filter((x) => x.acno === 'SE-2627-0002' && x.cat === 'Overdue Reminder').length, 0);

  chk('a second scan the same day adds nothing', app.scan().added, 0);
  chk('  the queue still holds one each', app.queue().length, 2);
}

// ---------------------------------------------------------------------------
console.log('\n--- each stage once; the next stage in its turn ---');
{
  const store = {};
  const l = { id: 'L3', name: 'N', phone: '9000000003', acno: 'A3', outstanding: 50000, arrears: 0, due: '2026-11-20' };
  let app = makeApp('2026-11-14', [l], store);            // 6 days out
  chk('6 days out: the 7-day stage is raised', app.scan().added, 1);
  app = makeApp('2026-11-15', [l], store);
  chk('next day: nothing new', app.scan().added, 0);
  app = makeApp('2026-11-17', [l], store);                 // 3 days out
  chk('3 days out: the 3-day stage', app.scan().added, 1);
  app = makeApp('2026-11-20', [l], store);
  chk('on the day: the last stage, worded "due today"', app.scan().added, 1);
  chk('  wording', app.queue().some((x) => x.reason === 'EMI due today'), true);
  chk('never more than the three configured reminders', app.queue().length, 3);
}

// ---------------------------------------------------------------------------
console.log('\n--- dismissed stays dismissed; "Run scan now" brings it back ---');
{
  const store = {};
  const l = { id: 'L4', name: 'N', phone: '9000000004', acno: 'A4', outstanding: 9000, arrears: 9000, due: '2026-11-01' };
  const app = makeApp('2026-11-16', [l], store);
  app.scan();
  chk('raised once', app.queue().length, 1);
  app.saveQ([]);                                           // what dismiss / Clear queue now do
  chk('the quiet scan does not put it straight back', app.scan().added, 0);
  chk('"Run scan now" does', app.scan(true).added, 1);

  chk('dismiss no longer forgets the stage', /function autoRemDismiss\(id\)\{[^}]*autoSeenRemove/.test(UI), false);
  chk('  nor does Clear queue', /function autoRemClearAll\(\)\{[^}]*autoSeenClearAll/.test(UI), false);
  chk('the Run-scan button forces', /function autoRemRunNow\(\)\{ var r=\{added:0\}; try\{ r=autoRemScan\(true\)/.test(UI), true);
  chk('the scan that runs when the screen opens does not', /autoRemScan\(\);/.test(REM), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- nobody is queued for a message they were already sent ---');
{
  const l = { id: 'L5', name: 'N', phone: '9000000005', acno: 'A5', outstanding: 9000, arrears: 9000, due: '2026-10-10' };  // 37 days -> stage 30, opened 09 Nov
  const sentAt = new Date(2026, 10, 12, 11, 0).getTime();          // 12 Nov, inside the stage
  let store = { hist: JSON.stringify([{ category: 'Overdue Reminder', phone: '+91 90000 00005', at: sentAt, status: 'Accepted' }]) };
  let app = makeApp('2026-11-16', [l], store);
  chk('sent from the custom blast on 12 Nov: not queued again', app.scan(true).added, 0);

  store = { hist: JSON.stringify([{ category: 'Overdue Reminder', phone: '9000000005', at: new Date(2026, 9, 20).getTime(), status: 'Accepted' }]) };
  app = makeApp('2026-11-16', [l], store);
  chk('a send from BEFORE this stage does not suppress it', app.scan().added, 1);

  store = { hist: JSON.stringify([{ category: 'Overdue Reminder', phone: '9000000005', at: sentAt, status: 'Failed' }]) };
  app = makeApp('2026-11-16', [l], store);
  chk('a FAILED send does not count as sent', app.scan().added, 1);

  store = { hist: JSON.stringify([{ category: 'EMI Reminder', phone: '9000000005', at: sentAt, status: 'Accepted' }]) };
  app = makeApp('2026-11-16', [l], store);
  chk('a different kind of message does not suppress it', app.scan().added, 1);
}

// ---------------------------------------------------------------------------
console.log('\n--- closed and switched-off cases stay quiet ---');
{
  const closed = { id: 'L6', name: 'N', phone: '9', acno: 'A6', outstanding: 0, arrears: 0, due: '2026-11-18' };
  const far = { id: 'L7', name: 'N', phone: '9', acno: 'A7', outstanding: 5000, arrears: 0, due: '2026-12-20' };
  const app = makeApp('2026-11-16', [closed, far]);
  chk('a closed loan and one due in 34 days raise nothing', app.scan().added, 0);
}

// ---------------------------------------------------------------------------
console.log('\n--- custom blast: the wording follows the date ---');
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(extract(REM, '_remIsOverdue') + '; this.f=_remIsOverdue;', ctx);
  const T = '2026-11-16';
  chk('Overdue status, instalment 4 days AHEAD: EMI reminder', ctx.f({ _st: 'Overdue', due: '2026-11-20' }, T), false);
  chk('Overdue status, instalment due TODAY: EMI reminder', ctx.f({ _st: 'Overdue', due: '2026-11-16' }, T), false);
  chk('Overdue status, date behind us: overdue reminder', ctx.f({ _st: 'Overdue', due: '2026-09-09' }, T), true);
  chk('Active account: never the overdue wording', ctx.f({ _st: 'Active', due: '2026-09-09' }, T), false);
  chk('Overdue with no date recorded: overdue wording', ctx.f({ _st: 'Overdue', due: '' }, T), true);

  chk('both the list and the send-list use the same rule', (REM.match(/const over=_remIsOverdue\(l,today\);/g) || []).length, 2);
  chk('  the old status-only choice is gone', /const over=\(l\._st==='Overdue'\);/.test(REM), false);
  // the amount shown for review follows the same choice: EMI for an EMI reminder
  chk('  an EMI reminder carries the EMI amount, not the outstanding',
    /amt:\(over\?Math\.round\(Number\(l\.outstanding\)\|\|0\):Math\.round\(Number\(l\.emi\)\|\|0\)\)/.test(REM), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- a charge that has been PAID is not arrears ---');
{
  const { makeSandbox } = require('./harness');
  const S = makeSandbox('2026-11-16');
  const fresh = () => ({ id: 'S', principal: 250000, rate: 2, tenure: 48, tpay: 490000, emi: 10208, disb: '2026-10-20', charges: [], payments: [] });

  let l = fresh(); S.recomputeLoan(l);
  chk('new loan, first EMI on 20 Nov: no arrears', [l.arrears, l.status, l.due], [0, 'Active', '2026-11-20']);

  l = fresh(); l.charges = [{ type: 'Other', amount: 500, date: '2026-10-20' }];
  l.payments = [{ date: '2026-10-20', amount: 500, status: 'Cleared' }];
  S.recomputeLoan(l);
  chk('a Rs 500 charge paid the same day: still no arrears', l.arrears, 0);
  chk('  and the balance is unchanged by it', l.outstanding, 490000);

  l = fresh(); l.charges = [{ type: 'Other', amount: 500, date: '2026-10-20' }];
  S.recomputeLoan(l);
  chk('the same charge UNPAID is still owed now', l.arrears, 500);
  chk('  and still in the balance', l.outstanding, 490500);

  // the everyday case: late fee charged, then settled with the EMI
  const eight = () => ({ id: 'E', principal: 60000, rate: 2, tenure: 8, tpay: 69600, emi: 8700, disb: '2026-03-09', charges: [], payments: [] });
  l = eight();
  l.payments = ['2026-04-09', '2026-05-09', '2026-06-20', '2026-07-09', '2026-08-09', '2026-09-09', '2026-10-09', '2026-11-09']
    .slice(0, 7).map((d) => ({ date: d, amount: 8700, status: 'Cleared' }));
  l.charges = [{ type: 'Late fee', amount: 500, date: '2026-06-09', emiIdx: 3 }];
  l.payments.push({ date: '2026-06-20', amount: 500, status: 'Cleared' });       // he paid the fee
  const SS = makeSandbox('2026-10-20'); SS.recomputeLoan(l);
  chk('late fee charged AND paid, every EMI up to date: not in arrears', [l.arrears, l.status], [0, 'Active']);

  l = eight();
  l.payments = ['2026-04-09', '2026-05-09'].map((d) => ({ date: d, amount: 8700, status: 'Cleared' }));
  l.charges = [{ type: 'Late fee', amount: 500, date: '2026-06-09', emiIdx: 3 }];
  const S2 = makeSandbox('2026-06-20'); S2.recomputeLoan(l);
  chk('one EMI behind with an unpaid late fee: both are overdue, as before', l.arrears, 8700 + 500);

  l = eight();
  l.payments = ['2026-04-09', '2026-05-09', '2026-06-09'].map((d) => ({ date: d, amount: 8700, status: 'Cleared' }));
  l.payments.push({ date: '2026-06-15', amount: 300, status: 'Cleared' });       // part of the fee
  l.charges = [{ type: 'Late fee', amount: 500, date: '2026-06-09' }];
  S2.recomputeLoan(l);
  chk('a part-paid fee leaves only the unpaid part in arrears', l.arrears, 200);

  // the outstanding itself must be untouched by this change
  l = eight(); l.payments = ['2026-04-30', '2026-05-14', '2026-06-12', '2026-07-28', '2026-08-13'].map((d) => ({ date: d, amount: 8700, status: 'Cleared' }));
  l.payments.push({ date: '2026-10-27', amount: 5000, status: 'Cleared' });
  l.charges = [{ type: 'Late fee', amount: 500 }, { type: 'Late fee', amount: 500 }, { type: 'Cheque bounce', amount: 500 },
               { type: 'Overdue interest', amount: 1200 }, { type: 'Overdue interest', amount: 1200 }];
  S.recomputeLoan(l);
  chk('A/C 16289 shape: 69,600 - 48,500 + 1,500 fees + 2,400 overdue interest', l.outstanding, 25000);
  chk('  without the two overdue-interest lines it is the owner\'s 22,600', l.outstanding - 2400, 22600);
}

// ---------------------------------------------------------------------------
console.log('\n--- a Next Due Date typed by hand ---');
{
  // Disbursed 14 Oct, so the schedule puts EMI 1 on 14 Nov. The owner typed 20 Nov.
  // Old result on 16 Nov: arrears 10,208, Overdue, six days before the date on screen.
  const { makeSandbox } = require('./harness');
  const mk = () => ({ id: 'S', principal: 250000, rate: 2, tenure: 48, tpay: 490000, emi: 10208, charges: [], payments: [],
                      disb: '2026-10-14', due: '2026-11-20', dueManual: true });
  const at = (day, l) => { makeSandbox(day).recomputeLoan(l); return [l.arrears, l.status, l.due]; };

  chk('16 Nov, typed date still ahead: not overdue', at('2026-11-16', mk()), [0, 'Active', '2026-11-20']);
  chk('19 Nov, the day before: still not overdue', at('2026-11-19', mk()), [0, 'Active', '2026-11-20']);
  chk('20 Nov, the typed date: the EMI is due', at('2026-11-20', mk()), [10208, 'Overdue', '2026-11-20']);
  chk('25 Nov, unpaid: overdue, and the typed date is kept', at('2026-11-25', mk()), [10208, 'Overdue', '2026-11-20']);

  let l = mk(); l.dueManual = false; l.due = '';
  chk('the same loan with NO typed date follows the schedule exactly as before', at('2026-11-16', l), [10208, 'Overdue', '2026-11-14']);

  // narrow on purpose: two or more instalments behind is a promise date, not a reprieve
  l = mk(); l.disb = '2026-08-14'; l.due = '2026-11-30';
  chk('three EMIs behind with a promise date typed: still overdue for all three', at('2026-11-16', l), [30624, 'Overdue', '2026-11-30']);

  // the typed date is for ONE instalment; it used to freeze for ever
  l = mk(); l.payments = [{ date: '2026-11-20', amount: 10208, status: 'Cleared' }];
  chk('paid on the typed date: nothing owing', at('2026-11-20', l).slice(0, 2), [0, 'Active']);
  chk('next day the schedule takes over: next due 14 Dec', at('2026-11-21', l), [0, 'Active', '2026-12-14']);
  chk('  and the hand-set flag is released', l.dueManual, false);
  chk('16 Dec, EMI 2 unpaid: overdue since 14 Dec — not since the paid 20 Nov', at('2026-12-16', l), [10208, 'Overdue', '2026-12-14']);

  // money is untouched by any of this
  l = mk(); makeSandbox('2026-11-16').recomputeLoan(l);
  chk('outstanding, EMI and total payable are unchanged', [l.outstanding, l.emi, l.tpay], [490000, 10208, 490000]);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
