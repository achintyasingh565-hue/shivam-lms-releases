const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + require('path').resolve(process.cwd(), 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const $ = id => document.getElementById(id);
    window.print = () => {}; window.confirm = () => true; window.alert = () => {};
    const today = todayISO();
    // 12 EMIs of 3100 (tpay 37200), disbursed ~8 months ago; 3 EMIs paid.
    const d = new Date(today); d.setMonth(d.getMonth() - 8); const disb = d.toISOString().slice(0,10);
    const mk = () => ({ id: 'LP', name: 'Sunil Shah', acno: 'SE-16277', phone: '9839661338', type: 'Personal',
      principal: 30000, rate: 2, tenure: 12, tint: 7200, tpay: 37200, emi: 3100, disb, due: '',
      payments: [
        { pid:'a', date: '2026-01-03', mode:'Cash', amount:3100, status:'Cleared' },
        { pid:'b', date: '2026-02-03', mode:'Cash', amount:3100, status:'Cleared' },
        { pid:'c', date: '2026-03-03', mode:'Cash', amount:3100, status:'Cleared' } ], charges: [] });
    loans.splice(0, loans.length, mk());
    recomputeAll();
    const before = { arrears: loans[0].arrears, outstanding: loans[0].outstanding, status: loans[0].status };

    // messages (reminders) as-shown
    const remOut = (type) => { $('remFilter').value='all'; $('remLang').value='en'; renderReminders(); const it=(window._remList||[]).find(x=>x.acno==='SE-16277'); return it?it.amt:null; };
    const beforeRem = remOut();
    $('grType').value='demandnotice'; $('grWho').value='all'; $('grOccasion').value=''; $('grDate').value=''; renderGreetings();
    const beforeDN = (window._grList||[]).find(x=>x.acno==='SE-16277');

    // ---- record a LATE payment (EMI #4) via the real pay-tab flow ----
    if (typeof refreshPayLoanDropdown==='function') refreshPayLoanDropdown();
    $('payb_loan').value='LP'; $('payb_amt').value='3100'; $('payb_mode').value='Cash'; $('payb_date').value=today;
    recordPayTab(); if (recordPayTab._busy) recordPayTab._busy=false;
    const afterRec = { arrears: loans[0].arrears, outstanding: loans[0].outstanding, paid: loans[0].paid };

    // now re-render messages WITHOUT navigating (simulate staying/side-tab switch)
    const afterRem_noNav = remOut();
    renderGreetings();
    const afterDN_noNav = (window._grList||[]).find(x=>x.acno==='SE-16277');

    // and WITH navigation (go recomputes)
    go('messages');
    const afterRem_nav = remOut();
    $('grType').value='demandnotice'; renderGreetings();
    const afterDN_nav = (window._grList||[]).find(x=>x.acno==='SE-16277');

    return { today, disb, before, beforeRem, beforeDN_arrears: beforeDN&&beforeDN.vars.arrears, beforeDN_out: beforeDN&&beforeDN.vars.outstanding,
      afterRec, afterRem_noNav, afterDN_noNav_arrears: afterDN_noNav&&afterDN_noNav.vars.arrears, afterDN_noNav_out: afterDN_noNav&&afterDN_noNav.vars.outstanding,
      afterRem_nav, afterDN_nav_arrears: afterDN_nav&&afterDN_nav.vars.arrears, afterDN_nav_out: afterDN_nav&&afterDN_nav.vars.outstanding };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
