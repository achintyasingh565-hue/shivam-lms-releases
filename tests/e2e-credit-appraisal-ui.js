// Credit appraisal in the real app: New Loan -> Check eligibility -> fill the
// papers -> "Use ₹…" sets the loan amount -> Save keeps the appraisal on the loan;
// reopening shows it; the memo prints; nothing else on the loan changes.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);
  let fails = 0;
  const chk = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want))); };

  const r = await p.evaluate(async () => {
    window.confirm = () => true; window.print = () => {};
    try { if (typeof currentUser !== 'undefined' && !currentUser) currentUser = { user: 'admin', name: 'Achintya', role: 'admin' }; } catch (e) {}
    loans.splice(0, loans.length);
    openLoan();
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); };
    set('m_name', 'Ram Lal Verma'); set('m_phone', '9000000001'); set('m_rate', '1.5'); set('m_tenure', '24'); set('m_disb', '2026-11-28');
    document.getElementById('m_secured').value = 'yes'; set('m_propvalue', '1800000');
    const out = { btn: !!document.querySelector('#ltab-terms button[onclick="apprOpen()"]') };
    apprOpen();
    const ov = document.getElementById('apprOverlay');
    out.open = !!(ov && ov.classList.contains('show'));
    out.pvPrefilled = document.getElementById('ap_pv').value;
    const f = { ap_sal: 32000, ap_itr1: 410000, ap_itr2: 365000, ap_vin: 6, ap_cr: 38500, ap_abb: 14000, ap_emis: 4500, ap_bnc: 1, ap_score: 760 };
    Object.keys(f).forEach((k) => set(k, String(f[k])));
    document.getElementById('ap_title').checked = true; apprRecalc();
    out.tiles = [...document.querySelectorAll('.ap-tile .v')].map((e) => e.textContent);
    out.grade = document.querySelector('.ap-gl').textContent;
    out.applyLabel = document.getElementById('ap_apply').textContent;
    apprPrint();
    const memo = document.getElementById('apprMemoFrame').srcdoc;
    out.memo = /Credit appraisal memo/.test(memo) && /₹1,45,000/.test(memo) && !/undefined|NaN/.test(memo);
    apprMemoClose();
    apprKeep(true);
    out.closed = !ov.classList.contains('show');
    out.principal = document.getElementById('m_principal').value;
    out.hint = document.getElementById('m_apprHint').textContent;
    set('m_acno', 'SE-2627-0099');
    await saveLoan();
    const l = loans.find((x) => x.acno === 'SE-2627-0099');
    out.saved = !!l; out.appr = l && l.appraisal ? [l.appraisal.grade, l.appraisal.min, l.appraisal.avg, l.appraisal.max, l.appraisal.recommended] : null;
    out.loanPrincipal = l && l.principal;
    out.persisted = /"appraisal"/.test(localStorage.getItem('shivam_loans_v1') || '');
    // reopen: hint comes back; a fresh new-loan form does not inherit it
    openLoan(l.id); out.hintAgain = document.getElementById('m_apprHint').textContent;
    closeLoan(); openLoan(); out.freshHint = document.getElementById('m_apprHint').textContent; out.freshDraft = window._apprDraft;
    closeLoan();
    // editing a loan without a new appraisal keeps the old one
    openLoan(l.id); await saveLoan(); out.keptOnEdit = !!(loans.find((x) => x.id === l.id) || {}).appraisal;
    localStorage.setItem('shivam_appraisal_v1', JSON.stringify({ foir: [35, 45, 55], ltv: [40, 50, 60] }));
    out.settingTravels = typeof collectSettings === 'function' && 'shivam_appraisal_v1' in collectSettings();
    return out;
  });
  chk('Check eligibility button sits by the loan amount', r.btn, true);
  chk('appraisal opens', r.open, true);
  chk('property value comes from the loan form', r.pvPrefilled, '1800000');
  chk('minimum / average / maximum', r.tiles, ['₹1,10,000', '₹1,45,000', '₹2,20,000']);
  chk('grade', r.grade, 'A');
  chk('button offers the recommended amount', r.applyLabel, 'Use ₹1,45,000');
  chk('memo prints cleanly', r.memo, true);
  chk('"Use" closes the appraisal', r.closed, true);
  chk('  and sets the loan amount', r.principal, '145000');
  chk('  and shows the result under it', /grade A/.test(r.hint) && /₹1,45,000/.test(r.hint), true);
  chk('loan saves', r.saved, true);
  chk('  with the appraisal on it', r.appr, ['A', 110000, 145000, 220000, 145000]);
  chk('  principal as chosen', r.loanPrincipal, 145000);
  chk('  stored on disk', r.persisted, true);
  chk('reopening the loan shows the appraisal', /grade A/.test(r.hintAgain), true);
  chk('a new loan starts with no appraisal', [r.freshHint, r.freshDraft], ['', null]);
  chk('editing without re-appraising keeps the old appraisal', r.keptOnEdit, true);
  chk('lending limits travel with backups and cloud', r.settingTravels, true);
  chk('no page errors', errs, []);
  await b.close();
  console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL APPRAISAL-UI CHECKS PASS');
  process.exitCode = fails ? 1 : 0;
})();
