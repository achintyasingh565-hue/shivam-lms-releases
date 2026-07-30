// DEEP EXERCISER — drives every major screen/workflow with realistic values and
// records any thrown error, console error, or broken outcome. This is the behavioural
// pass that catches "wired-wrong" bugs (like the ID validation one) that static review
// and unit tests miss.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  p.on('pageerror', e => pageErrors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(600);

  const R = await p.evaluate(async () => {
    const $ = id => document.getElementById(id);
    const set = (id, v) => { const e = $(id); if (e) { e.value = v; return true; } return false; };
    window.print = () => {}; window.confirm = () => true; window.alert = () => {};
    window.prompt = () => '500';
    let toastMsg = ''; const _t = window.toast; window.toast = m => { toastMsg += ' | ' + m; };
    const areas = {};
    const run = (name, fn) => { try { const d = fn(); areas[name] = { ok: true, detail: d || '' }; } catch (e) { areas[name] = { ok: false, detail: String(e && e.stack || e) }; } };
    const runA = async (name, fn) => { try { const d = await fn(); areas[name] = { ok: true, detail: d || '' }; } catch (e) { areas[name] = { ok: false, detail: String(e && e.stack || e) }; } };

    // ---------- 1. Navigate to EVERY section ----------
    run('nav-all', () => {
      const secs = ['dash', 'loans', 'pay', 'messages', 'cert', 'defaults', 'proposal', 'hpfile', 'reports', 'backup'];
      const bad = [];
      secs.forEach(s => { try { go(s); } catch (e) { bad.push(s + ':' + e); } });
      if (bad.length) throw new Error('nav failed: ' + bad.join(', '));
      return secs.length + ' sections';
    });

    // ---------- 2. Create a full loan via the form ----------
    await runA('loan-create', async () => {
      loans.splice(0, loans.length);
      openLoan(null);
      set('m_name', 'Ravi Verma'); set('m_acno', 'SE-9001'); set('m_reltype', 'son of'); set('m_relname', 'Mohan Verma');
      set('m_phone', '9839125800'); set('m_addr', 'D-1191 Indira Nagar, Lucknow');
      addIdRow(); idRowType(0, 'Aadhaar'); idRowNum(0, '721585602980');
      addIdRow(); idRowType(1, 'PAN'); idRowNum(1, 'ABCDE1234F');
      addIdRow(); idRowType(2, 'Driving Licence'); idRowNum(2, 'UP32 20200012345');
      set('m_type', 'Business'); set('m_principal', '200000'); set('m_rate', '2.5'); set('m_tenure', '18');
      set('m_disb', '2026-01-10'); set('m_deductions', '5000');
      set('m_age', '39'); set('m_occupation', 'Shopkeeper');
      set('m_propdesc', 'Shop No 4'); set('m_propaddr', 'Bhoothnath Market'); set('m_propvalue', '1500000');
      set('m_gname', 'Sunil Verma'); set('m_gphone', '9838111222');
      set('m_coname', 'Meena Verma'); set('m_cophone', '9838333444');
      recalc();
      await saveLoan();
      const l = loans.find(x => x.acno === 'SE-9001');
      if (!l) throw new Error('loan not saved');
      // flat interest: tint = 200000*2.5/100*18 = 90000 ; tpay = 290000 ; emi = round(290000/18)=16111
      if (l.tint !== 90000 || l.tpay !== 290000) throw new Error('interest wrong: tint=' + l.tint + ' tpay=' + l.tpay);
      if ((l.ids || []).length !== 3) throw new Error('ids not stored: ' + JSON.stringify(l.ids));
      if (l.idproof !== '721585602980' || l.pan !== 'ABCDE1234F') throw new Error('id mirrors wrong');
      if (l.propvalue !== 1500000) throw new Error('property not saved');
      if (l.deductions !== 5000) throw new Error('deductions not saved');
      return 'SE-9001 tint=' + l.tint + ' emi=' + l.emi;
    });

    // ---------- 3. Edit loan: due follows disbursement ----------
    await runA('loan-edit-due', async () => {
      const l = loans.find(x => x.acno === 'SE-9001'); if (!l) throw new Error('no loan');
      openLoan(l.id);
      set('m_disb', '2026-03-01'); recalc();
      const due1 = $('m_due').value;                 // expect 2026-04-01
      set('m_tenure', '24'); recalc();
      await saveLoan();
      const l2 = loans.find(x => x.acno === 'SE-9001');
      if (due1 !== '2026-04-01') throw new Error('due did not follow disb: ' + due1);
      if (l2.tenure !== 24) throw new Error('tenure not saved');
      return 'due=' + due1;
    });

    // ---------- 4. Payments: cash, cheque(pending->clear), online, overpay, bounce ----------
    await runA('payments', async () => {
      go('pay');
      const l = loans.find(x => x.acno === 'SE-9001');
      if (typeof refreshPayLoanDropdown === 'function') refreshPayLoanDropdown();
      const rec = (mode, amt, extra) => { set('payb_loan', l.id); set('payb_amt', String(amt)); set('payb_mode', mode); set('payb_date', '2026-04-05');
        if (mode === 'Cheque') { set('payb_cheqno', (extra && extra.chq) || '100200'); set('payb_bank', 'SBI'); set('payb_status', (extra && extra.st) || 'Cleared'); }
        if (mode === 'Online') { set('payb_ref', 'UTR99887766'); }
        if (typeof payTabModeUI === 'function') payTabModeUI();
        recordPayTab(); if (recordPayTab._busy) recordPayTab._busy = false; };
      rec('Cash', 16111);
      rec('Cheque', 16111, { chq: '100201', st: 'Cleared' });
      rec('Online', 16111);
      const after3 = loans.find(x => x.acno === 'SE-9001');
      const paid3 = after3.paid;
      const tpayBefore = after3.tpay;               // whatever the contract is right now
      // overpay far beyond outstanding — must be capped, contract (tpay) unchanged
      rec('Cash', 9999999);
      const afterOver = loans.find(x => x.acno === 'SE-9001');
      if (afterOver.tpay !== tpayBefore) throw new Error('overpay rewrote contract tpay ' + tpayBefore + '->' + afterOver.tpay);
      if (afterOver.outstanding < 0) throw new Error('negative outstanding');
      // bounce a cheque via the loan modal
      openLoan(after3.id);
      const chqIdx = (modalPayments || []).findIndex(x => x.mode === 'Cheque');
      if (chqIdx >= 0 && typeof markPayBounced === 'function') { markPayBounced(chqIdx); }
      await saveLoan();
      const afterBounce = loans.find(x => x.acno === 'SE-9001');
      const hasBounceCharge = (afterBounce.charges || []).some(c => c.type === 'Cheque bounce');
      return 'paid3=' + paid3 + ' out=' + afterBounce.outstanding + ' bounceCharge=' + hasBounceCharge;
    });

    // ---------- 5. Restructure / prepay ----------
    await runA('restructure', async () => {
      const l = loans.find(x => x.acno === 'SE-9001'); if (!l) throw new Error('no loan');
      if (typeof openRestructure !== 'function') return 'no restructure fn';
      openRestructure(l.id);
      set('rs_amt', '20000');
      if (typeof calcRestructure === 'function') calcRestructure();
      if (typeof applyRestructure === 'function') applyRestructure();
      const l2 = loans.find(x => x.acno === 'SE-9001');
      if (l2.tpay0 == null && !(l2.restructures && l2.restructures.length)) throw new Error('restructure not recorded');
      return 'restructures=' + ((l2.restructures || []).length);
    });

    // ---------- 6. Certificate ----------
    run('certificate', () => {
      const l = loans.find(x => x.acno === 'SE-9001'); if (!l) throw new Error('no loan');
      if (typeof certFromLoan === 'function') certFromLoan(l.id);
      else { go('cert'); if (typeof refreshLoanDropdown === 'function') refreshLoanDropdown(); set('loadLoan', l.id); if (typeof loadFromLoan === 'function') loadFromLoan(); }
      const nm = ($('f_name') || {}).value || '';
      if (nm.indexOf('Ravi') < 0) throw new Error('cert name not filled: ' + nm);
      if (typeof printCert === 'function') printCert();
      return 'cert for ' + nm;
    });

    // ---------- 7. Loan documents: fill + assemble full file ----------
    run('loan-documents', () => {
      const l = loans.find(x => x.acno === 'SE-9001'); if (!l) throw new Error('no loan');
      go('hpfile');
      if (typeof loadFile === 'function') loadFile(l.id);
      const cvName = (($('cv_name') || {}).textContent) || '';
      const hName = (($('h_name') || {}).value) || '';
      if (cvName.indexOf('Ravi') < 0 && hName.indexOf('Ravi') < 0) throw new Error('docs not filled');
      if (typeof printHPAll === 'function') printHPAll();
      const host = $('fullFilePrint');
      const pages = host ? host.querySelectorAll('.ff-page').length : -1;
      if (host && pages < 3) throw new Error('full-file assembled only ' + pages + ' pages');
      return 'assembled ' + pages + ' pages';
    });

    // ---------- 8. Proposal fill ----------
    run('proposal', () => {
      const l = loans.find(x => x.acno === 'SE-9001'); if (!l) throw new Error('no loan');
      go('proposal');
      if (typeof loadFile === 'function') loadFile(l.id);
      const pn = ($('p_name') || {}).value || '';
      if (pn.indexOf('Ravi') < 0) throw new Error('proposal not filled: ' + pn);
      return 'proposal for ' + pn;
    });

    // ---------- 9. Default / demand notice ----------
    run('default-notice', () => {
      const l = loans.find(x => x.acno === 'SE-9001'); if (!l) throw new Error('no loan');
      go('defaults');
      if (typeof defPickBorrower === 'function') defPickBorrower(l.id);
      if (typeof setDnType === 'function') setDnType('final');
      if (typeof setDnLang === 'function') setDnLang('hi');
      if (typeof defPreview === 'function') defPreview();
      const html = ($('defBody') || {}).innerHTML || '';
      if (html.indexOf('Ravi') < 0) throw new Error('notice not built');
      setDnLang('en'); setDnType('demand');
      return 'notice ok';
    });

    // ---------- 10. Reminders / messages ----------
    run('reminders', () => {
      go('messages');
      if (typeof autoRemScan === 'function') autoRemScan();
      ['reminders', 'greetings', 'history'].forEach(v => { if (typeof setMsgView === 'function') setMsgView(v); });
      return 'msg views ok';
    });

    // ---------- 11. Reports: every view ----------
    run('reports-all', () => {
      go('reports');
      const views = ['collection', 'cashbook', 'cheque', 'online', 'status', 'overdue', 'schedule', 'statement', 'interest', 'efficiency', 'pnl'];
      const bad = [];
      views.forEach(v => { try { if (typeof setReportView === 'function') setReportView(v); const body = ($('repBody') || {}).innerHTML || ''; if (!body) bad.push(v + ':empty'); } catch (e) { bad.push(v + ':' + e); } });
      if (bad.length) throw new Error(bad.join(', '));
      return views.length + ' report views';
    });

    // ---------- 12. Dashboard ----------
    run('dashboard', () => { if (typeof renderDash === 'function') renderDash(); return 'dash ok'; });

    // ---------- 13. Customers + profile ----------
    run('customers', () => {
      go('loans');
      const cs = buildCustomers();
      if (!cs.length) throw new Error('no customers');
      openCustomer(encodeURIComponent(cs[0].key));
      const html = ($('custDetail') || {}).innerHTML || document.body.innerHTML;
      if (html.indexOf('Aadhaar') < 0) throw new Error('profile missing Aadhaar label');
      return cs.length + ' customers';
    });

    // ---------- 14. Backup payload round-trip ----------
    run('backup-payload', () => {
      if (typeof makeBackupPayload !== 'function') return 'no backup fn';
      const payload = makeBackupPayload();
      const parsed = JSON.parse(payload);
      if (!parsed.loans || !parsed.loans.length) throw new Error('backup has no loans');
      const l = parsed.loans.find(x => x.acno === 'SE-9001');
      if (!l || !l.ids || l.ids.length !== 3) throw new Error('ids not in backup');
      if (parsed.sum != null && typeof _backupChecksum === 'function' && parsed.sum !== _backupChecksum(parsed.loans)) throw new Error('checksum mismatch');
      return 'backup ' + parsed.loans.length + ' loans';
    });

    // ---------- 15. Global search ----------
    run('search', () => {
      set('globalSearch', 'Ravi');
      if (typeof topSearchLive === 'function') topSearchLive();
      return 'search ok';
    });

    // ---------- 16. Invalid inputs must be blocked ----------
    await runA('validation-guards', async () => {
      const results = {};
      // duplicate acno
      openLoan(null); set('m_name', 'Dup'); set('m_acno', 'SE-9001'); set('m_phone', '9839125800'); set('m_principal', '10000'); set('m_rate', '2'); set('m_tenure', '6'); recalc();
      toastMsg = ''; await saveLoan(); results.dupAcno = /already belongs/.test(toastMsg);
      // negative principal
      openLoan(null); set('m_name', 'Neg'); set('m_acno', 'SE-NEG'); set('m_phone', '9839125800'); set('m_principal', '-5000'); set('m_rate', '2'); set('m_tenure', '6'); recalc();
      toastMsg = ''; await saveLoan(); results.negPrincipal = /greater than zero|loan amount/i.test(toastMsg);
      // bad phone
      openLoan(null); set('m_name', 'Ph'); set('m_acno', 'SE-PH'); set('m_phone', '12345'); set('m_principal', '10000'); set('m_rate', '2'); set('m_tenure', '6'); recalc();
      toastMsg = ''; await saveLoan(); results.badPhone = /Phone number should be/.test(toastMsg);
      // bad Aadhaar in an ID row
      openLoan(null); set('m_name', 'Aad'); set('m_acno', 'SE-AAD'); set('m_phone', '9839125800'); set('m_principal', '10000'); set('m_rate', '2'); set('m_tenure', '6'); recalc();
      addIdRow(); idRowType(0, 'Aadhaar'); idRowNum(0, '111');
      toastMsg = ''; await saveLoan(); results.badAadhaar = /Aadhaar should be 12 digits/.test(toastMsg);
      const fails = Object.keys(results).filter(k => !results[k]);
      if (fails.length) throw new Error('guards not firing: ' + fails.join(', ') + ' :: ' + JSON.stringify(results));
      return JSON.stringify(results);
    });

    return { areas };
  });

  // ---- report ----
  console.log('\n===== DEEP EXERCISER =====');
  let bad = 0;
  Object.keys(R.areas).forEach(k => {
    const a = R.areas[k];
    if (!a.ok) bad++;
    console.log('  ' + (a.ok ? 'PASS' : 'FAIL') + '  ' + k + (a.detail ? ('   — ' + String(a.detail).slice(0, 200)) : ''));
  });
  if (pageErrors.length) { bad += pageErrors.length; console.log('\n  PAGE ERRORS (' + pageErrors.length + '):'); pageErrors.slice(0, 12).forEach(e => console.log('    • ' + e.slice(0, 200))); }
  if (consoleErrors.length) { console.log('\n  CONSOLE ERRORS (' + consoleErrors.length + '):'); consoleErrors.slice(0, 12).forEach(e => console.log('    • ' + e.slice(0, 200))); }
  console.log('\n  ' + (bad === 0 ? '✅ EVERY WORKFLOW RAN CLEAN' : '❌ ' + bad + ' PROBLEM AREA(S)') + '\n');
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
