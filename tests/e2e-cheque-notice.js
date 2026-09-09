// Cheque presentation notice: the modal fills cheque no / bank / amount / date, supports
// English + Hindi, and sends on WhatsApp to the borrower's number.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const out = await p.evaluate(() => {
    loans.splice(0, loans.length, {
      id: 'L', name: 'Ramesh Kumar', acno: 'SE-2627-0007', phone: '9839125800',
      principal: 100000, rate: 2, tenure: 12, emi: 9250, tpay: 111000,
      payments: [{ pid: 'p1', date: '2026-09-20', mode: 'Cheque', amount: 9250, cheque: '100231', bank: 'HDFC Bank', status: 'Pending' }]
    });
    let waUrl = ''; window.open = (u) => { waUrl = String(u); return null; };
    chequeNotice('L', 0);
    const opened = !!document.getElementById('cnOverlay') && !!document.getElementById('cnPrev');
    document.getElementById('cnDate').value = '2026-09-25'; cnPreview();
    const en = document.getElementById('cnPrev').value;
    document.getElementById('cnLang').value = 'hi'; cnPreview();
    const hi = document.getElementById('cnPrev').value;
    cnSend();
    const dec = decodeURIComponent(waUrl);
    return {
      opened,
      hasCheque: en.includes('100231'),
      hasBank: en.includes('HDFC Bank'),
      hasAmount: en.includes('9,250'),
      hasDate: en.includes('25'),
      hindi: /चेक/.test(hi),
      waPhone: dec.includes('wa.me/919839125800'),
      waHindi: /चेक/.test(dec)
    };
  });

  // Second scenario: the notice is reachable from Greetings & Notices as its own
  // message type, and can be opened standalone on a loan with NO cheque recorded.
  const out2 = await p.evaluate(() => {
    loans.splice(0, loans.length,
      { id: 'A', name: 'Ramesh Kumar', acno: 'SE-2627-0007', phone: '9839125800', emi: 9250, principal: 100000, rate: 2, tenure: 12, tpay: 111000, disb: '2026-09-01', due: '2026-10-01', payments: [{ pid: 'p1', date: '2026-10-05', mode: 'Cheque', amount: 9250, cheque: '100231', bank: 'HDFC Bank', status: 'Pending' }] },
      { id: 'B', name: 'No Cheque Guy', acno: 'SE-2627-0008', phone: '9000000000', emi: 5000, principal: 50000, rate: 2, tenure: 12, tpay: 60000, disb: '2026-09-01', due: '2026-10-01', payments: [] }
    );
    go('messages');
    try { document.querySelector('[data-m=greetings]').click(); } catch (e) {}
    const sel = document.getElementById('grType');
    const hasOption = !!(sel && [].slice.call(sel.options).some(o => o.value === 'chequepresent'));
    if (sel) { sel.value = 'chequepresent'; renderGreetings(); }
    const list = window._grList || [];
    // standalone open on a loan with no cheque payment
    let waUrl = ''; window.open = (u) => { waUrl = String(u); return null; };
    chequeNotice('B');
    const editable = !!document.getElementById('cnCheque');
    if (editable) { document.getElementById('cnCheque').value = '55555'; document.getElementById('cnBank').value = 'SBI'; document.getElementById('cnAmount').value = '5000'; cnPreview(); }
    const prev = (document.getElementById('cnPrev') || {}).value || '';
    cnSend();
    return {
      hasOption,
      listOnlyPending: list.length === 1 && list[0].acno === 'SE-2627-0007',
      listMsgHasCheque: /100231/.test((list[0] || {}).msg || ''),
      listCat: (list[0] || {}).cat === 'Cheque Presentation',
      editable,
      standalonePreview: /55555/.test(prev) && /SBI/.test(prev),
      standaloneSends: waUrl.includes('wa.me/919000000000')
    };
  });

  const checks = {
    'notice modal opens with preview':      out.opened === true,
    'appears as a Greetings & Notices type': out2.hasOption === true,
    'greetings list targets pending cheques': out2.listOnlyPending === true,
    'greetings message auto-fills cheque':  out2.listMsgHasCheque === true,
    'logged under "Cheque Presentation"':   out2.listCat === true,
    'opens standalone (no payment needed)': out2.editable === true,
    'editable fields drive the preview':    out2.standalonePreview === true,
    'standalone send hits WhatsApp':        out2.standaloneSends === true,
    'preview shows cheque number':          out.hasCheque === true,
    'preview shows customer bank':          out.hasBank === true,
    'preview shows cheque amount':          out.hasAmount === true,
    'preview shows presentation date':      out.hasDate === true,
    'Hindi template available':             out.hindi === true,
    'sends to borrower WhatsApp number':    out.waPhone === true,
    'WhatsApp message carries the text':    out.waHindi === true,
    'no page errors':                       errs.length === 0 && out2.hasOption !== undefined
  };

  console.log('\n===== CHEQUE PRESENTATION NOTICE =====');
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ CHEQUE NOTICE: AUTO-FILLS & SENDS (EN + HI)' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
