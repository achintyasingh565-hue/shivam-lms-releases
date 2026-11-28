// Credit appraisal: every figure below is worked by hand from the bank-style
// rules in 38-appraisal.js (FOIR, ABB cover, LTV, ITR haircut, risk cuts) and
// this book's flat-interest model EMI = P x (1/n + r).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '38-appraisal.js'), 'utf8');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
function world(store) {
  store = store || {};
  const ctx = { console, JSON, Math, Number, String, Date, Object, Array, isFinite,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    custKeyOf: (l) => 'ph:' + String(l.phone || '').replace(/\D/g, '') + '|nm:' + String(l.name || '').trim().toLowerCase(),
    inr: (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN'),
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    fmtDate: (v) => { const [y, m, d] = String(v).split('-'); return d + '-' + m + '-' + y; },
    FIRM: () => ({ name: 'Shivam Enterprises', address: 'D-295, Indira Nagar, Lucknow' }),
    document: { getElementById: () => null }, loans: [] };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
const W = world();
const P = (r) => r.tiers.map((t) => t.principal);

// --- 1. salaried, secured, one return, good bureau
const base = { occ: 'salaried', salary: 32000, itr1: 410000, itr2: 365000, credits: 38500, abb: 14000, emis: 4500, bounces: 1,
  score: 760, overdue: false, secured: true, propValue: 1800000, propType: 'residential', titleOk: true, rate: 1.5, tenure: 24 };
let r = W.apprCompute(base);
chk('minimum / average / maximum', P(r), [110000, 145000, 220000]);
chk('decided by the bank balance at every level', r.tiers.map((t) => t.limitBy), ['balance', 'balance', 'balance']);
chk('EMIs on the flat model', r.tiers.map((t) => t.emi), [6233, 8217, 12467]);
chk('one return cuts 10%', Math.round(r.riskMult * 100), 90);
chk('risk score 25+14+15+11+4+10', r.score, 79);
chk('grade A', r.grade, 'A');
chk('recommends the average', r.recommended, 145000);

// --- 2. bank-rule knock-out: 3 returns and a score under 650
r = W.apprCompute(Object.assign({}, base, { bounces: 3, score: 620 }));
chk('knock-out forces grade D', r.grade, 'D');
chk('  nothing recommended', r.recommended, 0);
chk('  amounts cut to 0.5 x 0.6', Math.round(r.riskMult * 100), 30);

// --- 3. self-employed: ITR counted at 60 / 70 / 75%
r = W.apprCompute({ occ: 'self', itr1: 600000, credits: 60000, rate: 2, tenure: 12 });
chk('ITR haircut gives incomes 30,000 / 35,000 / 37,500', r.tiers.map((t) => Math.round(t.income)), [30000, 35000, 37500]);
chk('amounts', P(r), [115000, 165000, 215000]);

// --- 4. property not verified is not counted
r = W.apprCompute(Object.assign({}, base, { titleOk: false, abb: 0 }));
chk('unverified title: no property limit', r.tiers.map((t) => t.cap === Infinity), [true, true, true]);
chk('  and it is flagged as adverse', r.flags.some((f) => f.lvl === 'bad' && /title not verified/i.test(f.text)), true);
chk('  no security points', r.scoreParts.find((p) => p.k === 'Security').v, 0);

// --- 5. property caps the loan; commercial 5 points lower
r = W.apprCompute(Object.assign({}, base, { salary: 200000, itr1: 0, itr2: 0, credits: 0, abb: 0, emis: 0, propValue: 400000, propType: 'commercial' }));
chk('commercial LTV 35 / 45 / 55%', r.tiers.map((t) => t.ltv), [35, 45, 55]);
chk('capped by property value', P(r), [140000, 180000, 220000]);
chk('  decided by property', r.tiers[1].limitBy, 'property');

// --- 6. interest-only assessed as if repaid over 24 months
r = W.apprCompute({ occ: 'salaried', salary: 30000, rate: 2, interestOnly: true });
chk('byaj loan principal from 1/24 + r', r.tiers[1].principal, 240000);
chk('  shown monthly interest', r.tiers[1].emi, 4800);

// --- 7. income that never reaches the bank is not counted
r = W.apprCompute({ occ: 'salaried', salary: 50000, credits: 30000, rate: 1.5, tenure: 24 });
chk('income capped at bank credits', Math.round(r.tiers[1].income), 30000);
chk('  flagged', r.flags.some((f) => /higher than what reaches the bank/.test(f.text)), true);

// --- 8. errors
r = W.apprCompute({ rate: 2, tenure: 12 });
chk('no income: not computed', r.ok, false);
r = W.apprCompute({ salary: 30000, rate: 2 });
chk('no tenure on an EMI loan: not computed', r.ok, false);

// --- 9. record with us
const book = [
  { id: 'A', name: 'Ram Lal', phone: '9000000001', status: 'Closed', emi: 0, charges: [] },
  { id: 'B', name: 'Ram Lal', phone: '9000000001', status: 'Active', emi: 3000, arrears: 0, charges: [{ type: 'Cheque bounce', amount: 500 }] },
  { id: 'C', name: 'Someone Else', phone: '9000000002', status: 'Active', emi: 9999, charges: [] },
];
const past = W.apprPast(W.custKeyOf({ name: 'Ram Lal', phone: '9000000001' }), 'NEW', book);
chk('finds only this borrower\'s loans', [past.loans, past.active, past.closed, past.activeEmi, past.bounces], [2, 1, 1, 3000, 1]);
r = W.apprCompute(base, null, past);
chk('  bounce with us costs 5 points', r.scoreParts.find((p) => p.k === 'Record with us').v, -5);
chk('  reminds to count the EMI with us', r.flags.some((f) => /active loan with you \(EMI ₹3,000\)/.test(f.text)), true);

// --- 10. the owner's own limits are honoured
const W2 = world({ shivam_appraisal_v1: JSON.stringify({ foir: [30, 40, 50], ltv: [30, 40, 50] }) });
chk('saved limits load', [W2.apprCfg().foir, W2.apprCfg().ltv], [[30, 40, 50], [30, 40, 50]]);
const W3 = world({ shivam_appraisal_v1: JSON.stringify({ foir: [0, 400, 'x'] }) });
chk('nonsense limits fall back to the defaults', W3.apprCfg().foir, [40, 50, 60]);

// --- 11. cautious never exceeds stretch, over many random cases
let bad = 0;
for (let i = 0; i < 3000; i++) {
  const x = { occ: Math.random() < 0.5 ? 'self' : 'salaried', salary: Math.random() < 0.7 ? Math.round(Math.random() * 90000) : 0,
    itr1: Math.random() < 0.6 ? Math.round(Math.random() * 1200000) : 0, credits: Math.random() < 0.8 ? Math.round(Math.random() * 120000) : 0,
    abb: Math.random() < 0.7 ? Math.round(Math.random() * 60000) : 0, emis: Math.round(Math.random() * 20000), bounces: Math.floor(Math.random() * 5),
    score: Math.random() < 0.6 ? 300 + Math.floor(Math.random() * 600) : '', secured: Math.random() < 0.5, propValue: Math.round(Math.random() * 5e6),
    propType: ['residential', 'commercial', 'plot'][i % 3], titleOk: Math.random() < 0.7, rate: 1 + Math.random() * 3, tenure: 6 + Math.floor(Math.random() * 30),
    interestOnly: Math.random() < 0.2 };
  const y = W.apprCompute(x);
  if (!y.ok) continue;
  const p = P(y);
  if (!(p[0] <= p[1] && p[1] <= p[2]) || p.some((v) => !isFinite(v) || v < 0) || y.score < 0 || y.score > 100 || 'ABCD'.indexOf(y.grade) < 0) bad++;
  if (y.recommended && y.recommended !== p[y.recTier]) bad++;
}
chk('3,000 random cases: ordered, finite, graded', bad, 0);

// --- 12. the printed memo
const rec = { at: '2026-11-28T10:00:00Z', by: 'Achintya', inputs: base, terms: { rate: 1.5, tenure: 24, secured: true }, cfg: { foir: [40, 50, 60], ltv: [40, 50, 60] },
  min: 110000, avg: 145000, max: 220000, emi: [6233, 8217, 12467], recommended: 145000, grade: 'A', score: 79,
  flags: ['warn:1 cheque / ECS return in 6 months.'], past: { loans: 0 } };
const html = W.apprMemoHTML(rec, { name: 'Ram Lal', acno: 'SE-2627-0016', phone: '9000000001', principal: 145000 });
chk('memo carries the recommendation and grade', /Recommended loan <b>₹1,45,000/.test(html) && /class="gl">A</.test(html), true);
chk('  marked internal', /not to be given to the borrower/.test(html), true);
chk('  no undefined or NaN', /undefined|NaN/.test(html), false);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CREDIT-APPRAISAL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
