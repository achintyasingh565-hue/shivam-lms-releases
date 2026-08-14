// Proves (1) the WhatsApp connection (incl. token + template mapping) publishes to
// the shared cloud and is adopted by another device so the whole team can send, and
// (2) applied late fees can be removed in one click (bounce charges are kept).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(async () => {
    // ---- WhatsApp connection sync ----
    let published = null;
    window.cloudSetSetting = async (k, d) => { published = { key: k, data: d }; return { ok: true }; };
    window.cloudGetSetting = async (k) => (published && published.key === k ? { data: published.data } : null);

    // Admin device: configure + publish with a token
    saveWaCfg({ pnid: 'PNID123', bnumber: '9999', apiVersion: 'v20.0' });
    const pubOk = await publishWaConnection('TESTTOKEN');
    const pubShape = !!(published && published.key === 'wa_connection' &&
      published.data.token === 'TESTTOKEN' && published.data.pnid === 'PNID123' &&
      published.data.templates && published.data.templates['Loan Closed']);

    // Template-only save must PRESERVE the already-published token
    const pub2 = await publishWaConnection('');
    const tokenPreserved = published.data.token === 'TESTTOKEN';

    // Other device: wipe local WA config, then adopt from cloud
    localStorage.removeItem('shivam_wacfg_v1'); localStorage.removeItem('shivam_watpl_v1');
    const pullOk = await pullWaConnection();
    const cfg = loadWaCfg();
    const gotPnid = cfg.pnid === 'PNID123';
    const gotToken = waHasToken(cfg);                 // token adopted -> device can use the API
    const tpl = loadWaTpl();
    const gotTpl = !!(tpl['Loan Closed'] && tpl['Loan Closed'].name === 'loan_closed_notice');

    // ---- Late-fee removal ----
    window.confirm = () => true;
    loans.splice(0, loans.length, {
      id: 'LF', name: 'Mr Hawaldar', acno: 'SE-1', principal: 30000, rate: 2, tenure: 12,
      disb: '2025-06-05', tpay: 37200, emi: 3100, paid: 0, payments: [],
      charges: [
        { id: 'c1', type: 'Late fee', amount: 500, emiIdx: 1 },
        { id: 'c2', type: 'Late fee', amount: 500, emiIdx: 2 },
        { id: 'c3', type: 'Cheque bounce', amount: 250 }
      ]
    });
    waiveLateFees('LF');
    const l = loans[0];
    const lateGone = !(l.charges || []).some(c => c.type === 'Late fee');
    const bounceKept = (l.charges || []).some(c => c.type === 'Cheque bounce');

    return { pubOk, pubShape, pub2, tokenPreserved, pullOk, gotPnid, gotToken, gotTpl, lateGone, bounceKept };
  });

  const checks = {
    'connection publishes to cloud':            out.pubOk === true && out.pubShape === true,
    'template-only save keeps the token':       out.pub2 === true && out.tokenPreserved === true,
    'another device adopts the connection':     out.pullOk === true && out.gotPnid === true,
    'adopted device has the token (API-ready)': out.gotToken === true,
    'template mapping syncs too':               out.gotTpl === true,
    'late fees removed in one click':           out.lateGone === true,
    'other charges (bounce) are kept':          out.bounceKept === true,
    'no page errors':                           errs.length === 0
  };

  console.log('\n===== TEAM WHATSAPP SYNC + LATE-FEE REMOVAL =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ TEAM CAN SEND (SYNCED CONNECTION) & LATE FEES ARE REMOVABLE' : '❌ ' + bad + ' PROBLEM(S)') + '\n');

  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
