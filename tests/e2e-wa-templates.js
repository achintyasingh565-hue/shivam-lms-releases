// Verifies every WhatsApp message type is aligned to the approved Meta templates:
//   (a) the app maps to the correct approved template NAME + variable order, and
//   (b) each generator produces a NON-EMPTY value for every mapped variable
//       (Meta rejects a send if any template variable is blank).
const { chromium } = require('playwright');
const path = require('path');

// expected approved template name + variables, per app category
const EXPECT = {
  'EMI Reminder':            ['emi_due_reminder',     ['name','acno','emi','due_date']],
  'Overdue Reminder':        ['overdue_reminder',     ['name','acno','due_date','outstanding','fine']],
  'Payment Confirmation':    ['payment_received',     ['name','amount','acno','outstanding']],
  'Loan Approval':           ['loan_sanctioned',      ['name','acno','emi']],
  'Final Notice':            ['final_notice',         ['name','outstanding','acno']],
  'Default Notice':          ['default_notice',       ['name','acno','arrears','outstanding']],
  'Cheque Bounce':           ['cheque_bounce_notice', ['name','cheque','acno','amount']],
  'Cheque Cleared':          ['cheque_cleared_notice',['name','cheque','amount','acno']],
  'Loan Closed':             ['loan_closed_notice',   ['name','acno']],
  'Greeting / Notice':       ['festival_greeting',    ['name','occasion']],
  'Office Closure':          ['office_closure',       ['name','occasion','date']],
  'Birthday Greeting':       ['birthday_greeting',    ['name']],
  'Loan Restructured':       ['loan_restructured',    ['name','acno','emi','tenure']],
  'Welcome / Account Opened':['welcome_message',      ['name','acno']],
};
// each app category maps to a body-text key in TPL; the mapped variable count must
// equal the number of {placeholders} in that body (that body is what was uploaded to Meta)
const TPLKEY = { 'EMI Reminder':'reminder','Overdue Reminder':'overdue','Payment Confirmation':'thanks',
  'Loan Approval':'welcome','Final Notice':'finalnotice','Default Notice':'demandnotice',
  'Cheque Bounce':'bounce','Cheque Cleared':'cleared','Loan Closed':'closed','Greeting / Notice':'greeting',
  'Office Closure':'holiday','Birthday Greeting':'birthday','Loan Restructured':'restructure',
  'Welcome / Account Opened':'accwelcome' };
// which greetings dropdown type produces each category (reminders handled separately)
const GTYPE = { 'Payment Confirmation':'thanks','Loan Approval':'welcome','Final Notice':'finalnotice',
  'Default Notice':'demandnotice','Cheque Bounce':'bounce','Cheque Cleared':'cleared','Loan Closed':'closed',
  'Greeting / Notice':'greeting','Office Closure':'holiday','Birthday Greeting':'birthday',
  'Loan Restructured':'restructure','Welcome / Account Opened':'accwelcome' };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const out = await p.evaluate(({ EXPECT, GTYPE, TPLKEY }) => {
    const results = [];
    const ne = v => v != null && String(v).trim() !== '';
    const maps = loadWaTpl();
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

    const base = () => ({ id:'G1', name:'Ramesh Gupta', acno:'SE-101', phone:'8528564196',
      principal:100000, rate:2, tenure:12, tint:24000, tpay:124000, emi:10333, disb:'2025-06-01', due:'2025-07-01',
      payments:[{date:'2025-07-01',amount:10333,status:'Cleared',mode:'Cash',ref:'UTR12345'},
                {date:'2025-08-01',amount:10333,status:'Cleared',mode:'Cheque',cheque:'104503'}],
      charges:[{type:'Cheque bounce',cheque:'104777',amount:500,date:'2025-09-01'}], status:'Overdue' });
    const closed = () => ({ id:'C1', name:'Kavita Yadav', acno:'SE-107', phone:'8528564196',
      principal:50000, rate:2, tenure:10, tint:10000, tpay:60000, emi:6000, disb:'2024-01-01', due:'2024-02-01',
      payments:[{date:'2024-02-01',amount:60000,status:'Cleared',mode:'Cash'}], status:'Closed' });

    function check(cat, vars) {
      const [wantName, wantVars] = EXPECT[cat];
      const m = maps[cat] || {};
      const nameOk = m.name === wantName;
      const varsOk = (m.vars || '') === wantVars.join(',');
      const empties = wantVars.filter(k => !ne(vars[k]));
      var tk = TPLKEY[cat];
      var bodyVars = (tk && typeof TPL !== 'undefined' && TPL[tk]) ? (String(TPL[tk]).match(/\{[a-z_]+\}/g) || []).length : null;
      var countOk = bodyVars == null || bodyVars === wantVars.length;
      results.push({ cat, wantName, gotName: m.name, nameOk, varsOk, empties, bodyVars, mapVars: wantVars.length, countOk, sample: wantVars.map(k => k + '=' + (vars[k] ?? '')).join(' · ') });
    }

    // Reminders (EMI + Overdue share one vars object)
    loans.splice(0, loans.length, base()); try { recomputeLoan(loans[0]); } catch (_) {}
    setV('remFilter', 'all'); setV('remLang', 'en'); renderReminders();
    const rvars = (window._remList && window._remList[0] && window._remList[0].vars) || {};
    check('EMI Reminder', rvars);
    check('Overdue Reminder', rvars);

    // Greetings-driven types
    for (const cat of Object.keys(GTYPE)) {
      const type = GTYPE[cat];
      loans.splice(0, loans.length, type === 'closed' ? closed() : base());
      try { recomputeLoan(loans[0]); } catch (_) {}
      setV('grType', type); setV('grWho', 'all'); setV('grLang', 'en');
      setV('grOccasion', type === 'holiday' ? 'Independence Day' : 'Diwali');
      setV('grDate', '15 August 2026');
      renderGreetings();
      const gv = (window._grList && window._grList[0] && window._grList[0].vars) || {};
      check(cat, gv);
    }
    return results;
  }, { EXPECT, GTYPE, TPLKEY });

  console.log('\n===== WHATSAPP TEMPLATE ALIGNMENT =====');
  let bad = 0;
  for (const r of out) {
    const ok = r.nameOk && r.varsOk && r.empties.length === 0 && r.countOk;
    if (!ok) bad++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.cat.padEnd(24)} -> ${r.gotName}  (${r.mapVars} vars)`);
    if (!r.nameOk) console.log(`        name mismatch: got ${r.gotName}, want ${r.wantName}`);
    if (!r.varsOk) console.log(`        variable order mismatch`);
    if (!r.countOk) console.log(`        COUNT mismatch: app body has ${r.bodyVars} variables but mapping sends ${r.mapVars}`);
    if (r.empties.length) console.log(`        EMPTY variables: ${r.empties.join(', ')}  [${r.sample}]`);
  }
  console.log(`\n  JS page errors: ${errs.length}`, errs.length ? errs : '');
  await b.close();
  const good = bad === 0 && errs.length === 0;
  console.log(`\n  ${good ? '✅ ALL 14 TYPES ALIGNED, NO EMPTY VARIABLES' : '❌ ' + bad + ' PROBLEM(S)'}\n`);
  process.exit(good ? 0 : 1);
})();
