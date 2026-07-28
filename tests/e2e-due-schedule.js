// Regression tests for the loan-logic audit fixes (v2.0.22):
//   Fix 1  Next Due Date follows the disbursement date (the reported bug).
//   Fix 1b A user-typed due stays a manual override; "use schedule" reverts it.
//   Fix 2  A manual due before the disbursement is flagged (dueManual kept, due kept).
//   Fix 3  Form status matches recomputeLoan (one overdue definition).
//   Fix 4  Form OUTSTANDING preview includes cheque-bounce fees.
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(600);

  const R = await p.evaluate(async () => {
    const out = {};
    window.print = () => {};
    window.confirm = () => true;        // accept "no phone" etc.
    window.alert = () => {};
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    const val = id => { const e = document.getElementById(id); return e ? e.value : null; };

    // ---------- T1: due date follows the disbursement (the reported bug) ----------
    loans.splice(0, loans.length);
    openLoan(null);
    set('m_principal', '100000'); set('m_rate', '2'); set('m_tenure', '12');
    set('m_disb', '2025-06-01');
    recalc();
    const dueAfterFirstDisb = val('m_due');            // expect 2025-07-01
    set('m_disb', '2026-04-05');                       // change disbursement
    recalc();
    const dueAfterChange = val('m_due');               // expect 2026-05-05 (must FOLLOW)
    out.T1 = {
      dueAfterFirstDisb, dueAfterChange,
      PASS: dueAfterFirstDisb === '2025-07-01' && dueAfterChange === '2026-05-05'
    };

    // ---------- T1b: manual override is kept, then revertible ----------
    openLoan(null);
    set('m_principal', '50000'); set('m_rate', '2'); set('m_tenure', '10');
    set('m_disb', '2026-01-01');
    recalc();
    set('m_due', '2027-03-15'); dueEdited();           // user types a custom due
    set('m_disb', '2026-02-01'); recalc();             // change disb — custom due must stay
    const customKept = val('m_due');                   // expect 2027-03-15
    dueUseSchedule();                                  // "use schedule" — revert
    const revertedToSchedule = val('m_due');           // expect 2026-03-01 (disb+1)
    out.T1b = {
      customKept, revertedToSchedule,
      PASS: customKept === '2027-03-15' && revertedToSchedule === '2026-03-01'
    };

    // ---------- T3 + T4: form status == recomputeLoan, save keeps due>=disb ----------
    // A loan disbursed well in the past with no payments -> should read Overdue,
    // and the saved record's due must never precede the disbursement.
    openLoan(null);
    set('m_name', 'Sched Borrower'); set('m_acno', 'SCHED-1'); set('m_phone', '9839125800');
    set('m_principal', '120000'); set('m_rate', '2'); set('m_tenure', '12');
    set('m_disb', '2025-01-01');
    recalc();
    const formStatus = val('m_status');
    // independent recompute for comparison
    const cmp = { tpay: Number(val('m_tpay')), emi: Number(val('m_emi')), tenure: 12, disb: '2025-01-01', payments: [] };
    recomputeLoan(cmp);
    await saveLoan();
    const saved = loans.find(l => l.acno === 'SCHED-1');
    out.T34 = {
      formStatus, recomputeStatus: cmp.status,
      savedDue: saved && saved.due, savedDisb: saved && saved.disb,
      savedDueManual: saved && !!saved.dueManual,
      PASS: !!saved && formStatus === cmp.status && saved.due >= saved.disb && saved.dueManual === false
    };

    // ---------- T2 (Fix 2): a manual due BEFORE disbursement is flagged & kept ----------
    let toastMsg = '';
    const _toast = window.toast; window.toast = m => { toastMsg += ' ' + m; };
    openLoan(null);
    set('m_name', 'Bad Due'); set('m_acno', 'BADDUE-1'); set('m_phone', '9839125800');
    set('m_principal', '80000'); set('m_rate', '2'); set('m_tenure', '10');
    set('m_disb', '2026-04-01');
    recalc();
    set('m_due', '2025-01-01'); dueEdited();            // manual due BEFORE disbursement
    await saveLoan();
    window.toast = _toast;
    const bad = loans.find(l => l.acno === 'BADDUE-1');
    out.T2 = {
      savedDue: bad && bad.due, savedDisb: bad && bad.disb, dueManual: bad && !!bad.dueManual,
      warned: /before the disbursement/i.test(toastMsg),
      PASS: !!bad && bad.due === '2025-01-01' && bad.dueManual === true && /before the disbursement/i.test(toastMsg)
    };

    // ---------- T4b (Fix 4): bounce fees appear in the form OUTSTANDING preview ----------
    loans.splice(0, loans.length);
    loans.push({
      id: 'BF1', name: 'Bounce Fee', acno: 'BF-1', phone: '9839125800', type: 'Personal',
      principal: 100000, rate: 2, tenure: 12, tint: 24000, tpay: 124000, emi: 10333,
      disb: '2025-06-01', due: '2025-07-01', paid: 0, deductions: 0, status: 'Active',
      payments: [], charges: [{ id: 'C1', type: 'Cheque bounce', amount: 750, date: '2025-07-02' }],
      createdAt: '2025-06-01'
    });
    recomputeLoan(loans[0]);
    const recomputedOut = loans[0].outstanding;         // 124000 + 750
    openLoan('BF1');
    recalc();
    const formOut = Number(val('m_out'));
    out.T4b = {
      recomputedOut, formOut,
      PASS: recomputedOut === 124750 && formOut === 124750
    };

    return out;
  });

  console.log(JSON.stringify(R, null, 2));
  console.log('pageerrors:', errs);
  const pass = R.T1.PASS && R.T1b.PASS && R.T34.PASS && R.T2.PASS && R.T4b.PASS && errs.length === 0;
  console.log(pass ? 'ALL DUE-SCHEDULE TESTS PASS' : 'SOME DUE-SCHEDULE TESTS FAILED');
  process.exitCode = pass ? 0 : 1;
  await b.close();
})();
