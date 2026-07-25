// Proves the greetings/reminders list shows a "✓ Sent" tick for borrowers who
// already received that message type, and NOT for those who haven't.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(() => {
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    loans.splice(0, loans.length,
      { id: 'S1', name: 'Sent One',   acno: 'SE-S001', phone: '9444400001', principal: 100000, rate: 2, tenure: 12, tint: 24000, tpay: 124000, emi: 10333, outstanding: 124000, disb: '2025-06-01', due: '2025-07-01' },
      { id: 'S2', name: 'Unsent Two', acno: 'SE-S002', phone: '9444400002', principal: 50000,  rate: 2, tenure: 10, tint: 10000, tpay: 60000,  emi: 6000,  outstanding: 60000,  disb: '2025-06-01', due: '2025-07-01' });
    save();

    // greeting already sent to S1 only, today
    localStorage.setItem('shivam_wamsg_v1', JSON.stringify([
      { id: 'h1', name: 'Sent One', phone: '9444400001', acno: 'SE-S001', category: 'Greeting / Notice', content: 'x', at: Date.now(), by: 'test' }
    ]));

    setV('grType', 'greeting'); setV('grWho', 'all'); setV('grLang', 'en'); setV('grOccasion', 'Diwali'); setV('grDate', '');
    renderGreetings();
    const html = (document.getElementById('grWrap') || {}).innerHTML || '';

    // helper direct checks
    const badgeSent   = (typeof waSentBadge === 'function') ? waSentBadge('9444400001', 'Greeting / Notice') : 'NO_FN';
    const badgeUnsent = (typeof waSentBadge === 'function') ? waSentBadge('9444400002', 'Greeting / Notice') : 'NO_FN';

    // count ticks in the rendered table
    const tickCount = (html.match(/✓ Sent/g) || []).length;

    return { tickCount, badgeSentHas: /✓ Sent/.test(badgeSent), badgeUnsentEmpty: badgeUnsent === '' };
  });

  const checks = {
    'exactly one row shows the tick':      out.tickCount === 1,
    'sent borrower gets a tick':           out.badgeSentHas === true,
    'un-sent borrower gets no tick':       out.badgeUnsentEmpty === true,
    'no page errors':                      errs.length === 0
  };

  console.log('\n===== SENT INDICATOR =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  console.log('\n  ' + (bad === 0 ? '✅ SENT TICK SHOWS ONLY FOR ALREADY-MESSAGED BORROWERS' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
