/* ===========================================================================
 * tests/e2e-reconciliation.js
 *
 * The single most important promise this app makes to a borrower:
 *
 *     the last Balance printed on the EMI schedule
 *   = the Outstanding shown everywhere else in the app
 *   = total payable + charges − everything paid
 *
 * One hand-picked example can pass by luck. This is a PROPERTY test: it
 * generates many different loan shapes (amounts, tenures, rates, payment
 * patterns, charges, part-payments, lump sums, interest-only months, gaps)
 * and asserts the identity holds for every one of them.
 *
 * If this ever fails, a customer could be handed a schedule whose bottom line
 * disagrees with the statement — so it is treated as a hard failure.
 * ======================================================================== */
const { chromium } = require('playwright');
const path = require('path');

/* Tiny deterministic PRNG so a failure is always reproducible from its seed. */
function rng(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function buildCases(n) {
  const cases = [];
  const rates = [1.5, 2, 2.5, 3];
  const tenures = [6, 10, 12, 18, 24];
  const principals = [20000, 50000, 75000, 120000, 300000];
  for (let c = 0; c < n; c++) {
    const r = rng(1000 + c * 7919);
    const principal = principals[Math.floor(r() * principals.length)];
    const rate = rates[Math.floor(r() * rates.length)];
    const tenure = tenures[Math.floor(r() * tenures.length)];
    const tint = Math.round(principal * rate / 100 * tenure);
    const tpay = principal + tint;
    const emi = Math.round(tpay / tenure);
    const year = 2023 + Math.floor(r() * 2);
    const month = 1 + Math.floor(r() * 12);
    const day = 1 + Math.floor(r() * 27);
    const disb = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');

    const payments = [];
    const charges = [];
    let m = 0;
    for (let i = 1; i <= tenure; i++) {
      const d = new Date(year, month - 1 + i, day);
      const iso = d.toISOString().slice(0, 10);
      const roll = r();
      if (roll < 0.45) {                                    // paid in full
        payments.push({ date: iso, mode: 'Cash', amount: emi, status: 'Cleared' });
      } else if (roll < 0.60) {                             // part payment
        payments.push({ date: iso, mode: 'Cash', amount: Math.round(emi * 0.5), status: 'Cleared' });
      } else if (roll < 0.72) {                             // interest only
        payments.push({ date: iso, mode: 'Cash', amount: Math.round(tint / tenure), status: 'Cleared', intOnly: true, type: 'Interest' });
      } else if (roll < 0.82) {                             // lump sum covering a few EMIs
        payments.push({ date: iso, mode: 'Online', amount: emi * (2 + Math.floor(r() * 2)), status: 'Cleared' });
      } else if (roll < 0.90) {                             // nothing paid, fees charged
        charges.push({ id: 'C' + c + '_' + i, date: iso, type: 'Late fee', amount: 500, emiIdx: i });
        charges.push({ id: 'I' + c + '_' + i, date: iso, type: 'Overdue interest', amount: Math.round(tint / tenure), emiIdx: i });
      }                                                     // else: simply missed, no charge yet
      m++;
    }
    // a pending (uncleared) cheque must NOT count towards paid
    if (r() < 0.3) payments.push({ date: disb, mode: 'Cheque', amount: emi, status: 'Pending', cheque: '000' + c });
    // a manual charge after the tenure
    if (r() < 0.35) {
      const d = new Date(year, month - 1 + tenure + 2, day);
      charges.push({ id: 'M' + c, date: d.toISOString().slice(0, 10), type: 'Late fee', amount: 500 });
    }
    cases.push({
      id: 'R' + c, name: 'Case ' + c, acno: 'AC' + c, phone: '9000000000',
      principal, rate, tenure, tint, tpay, emi, disb, status: 'Active',
      payments, charges
    });
  }
  return cases;
}

(async () => {
  const cases = buildCases(60);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  const results = await page.evaluate((cases) => {
    try { if (typeof hideLock === 'function') hideLock(); } catch (e) {}
    const cs = document.getElementById('cloudSignIn'); if (cs) cs.style.display = 'none';
    const out = [];
    cases.forEach(function (raw) {
      const l = JSON.parse(JSON.stringify(raw));
      loans.splice(0, loans.length, l);
      try { recomputeLoan(l); } catch (e) { out.push({ id: l.id, err: 'recompute: ' + e.message }); return; }

      let rows;
      try { rows = (repScheduleData(l) || {}).rows; } catch (e) { out.push({ id: l.id, err: 'schedule: ' + e.message }); return; }
      if (!rows || !rows.length) { out.push({ id: l.id, err: 'no schedule rows' }); return; }

      const lastBal = Math.round(Number(rows[rows.length - 1].bal) || 0);
      const outstanding = Math.round(Number(l.outstanding) || 0);

      // Independent arithmetic, from the raw records — not from the schedule.
      // Only CLEARED, principal-bearing money counts: pending cheques have not been received,
      // and an interest-only payment services that month's interest (it is income, it does not
      // reduce what is owed). This mirrors recomputeLoan deliberately, from the other direction.
      const paid = (l.payments || [])
        .filter(function (p) { return p && p.status === 'Cleared' && !(p.intOnly || p.type === 'Interest'); })
        .reduce(function (a, p) { return a + (Number(p.amount) || 0); }, 0);
      const chg = (l.charges || []).reduce(function (a, c) { return a + (Number(c.amount) || 0); }, 0);
      const expected = Math.max(0, Math.round((Number(l.tpay) || 0) + chg - paid));

      // every EMI must be accounted for exactly once (deferred rows carry no number)
      const numbered = rows.filter(function (r) { return r.i !== '' && r.i != null; });
      let counted = 0;
      numbered.forEach(function (r) {
        const s = String(r.i);
        if (s.indexOf('–') > 0) {                       // "4–6" spans several installments
          const parts = s.split('–').map(Number);
          counted += (parts[1] - parts[0] + 1);
        } else if (!isNaN(Number(s))) counted += 1;
      });

      out.push({
        id: l.id, tenure: l.tenure,
        lastBal, outstanding, expected, counted,
        balMatchesOutstanding: Math.abs(lastBal - outstanding) <= 1,
        outstandingMatchesArithmetic: Math.abs(outstanding - expected) <= 1,
        allEmisPlaced: counted === l.tenure,
        noNegativeBalance: rows.every(function (r) { return (Number(r.bal) || 0) >= -1; }),
        balancesMonotonic: (function () {                    // balance may only fall or hold, never rise without a charge
          for (let i = 1; i < rows.length; i++) {
            const prev = Number(rows[i - 1].bal) || 0, now = Number(rows[i].bal) || 0;
            const added = (Number(rows[i].lateFee) || 0) + (Number(rows[i].intFee) || 0) + (Number(rows[i].charge) || 0);
            if (now > prev + added + 1) return false;
          }
          return true;
        })()
      });
    });
    return out;
  }, cases);

  let failed = 0;
  const checks = ['balMatchesOutstanding', 'outstandingMatchesArithmetic', 'allEmisPlaced', 'noNegativeBalance', 'balancesMonotonic'];
  results.forEach(function (r) {
    if (r.err) { console.log('  FAIL ' + r.id + ' — ' + r.err); failed++; return; }
    const bad = checks.filter(function (k) { return !r[k]; });
    if (bad.length) {
      failed++;
      console.log('  FAIL ' + r.id + ' [' + bad.join(', ') + ']  tenure=' + r.tenure +
        ' lastBal=' + r.lastBal + ' outstanding=' + r.outstanding + ' expected=' + r.expected + ' emisPlaced=' + r.counted);
    }
  });

  checks.forEach(function (k) {
    const n = results.filter(function (r) { return !r.err && r[k]; }).length;
    console.log('  ' + (n === results.length ? 'PASS' : 'FAIL') + '  ' + k + ' (' + n + '/' + results.length + ')');
  });
  console.log('  ' + (pageErrors.length ? 'FAIL' : 'PASS') + '  no page errors');

  await browser.close();
  if (failed || pageErrors.length) {
    if (pageErrors.length) console.log('  page errors: ' + pageErrors.join(' | '));
    console.log('\n  ❌ RECONCILIATION BROKEN — ' + failed + ' of ' + results.length + ' loan shapes disagree');
    process.exit(1);
  }
  console.log('\n  ✅ SCHEDULE, OUTSTANDING AND STATEMENT RECONCILE ACROSS ' + results.length + ' LOAN SHAPES');
})();
