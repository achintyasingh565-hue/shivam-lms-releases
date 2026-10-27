// Charge register: search, and the duplicate detector.
//
// The detector exists because duplicates created BEFORE the applyLateFees fix
// are still in the book. It must never delete anything — these are money
// records — only flag them for review. The thing to get right is precision: a
// false "duplicate" badge on a legitimate pair of charges would send the owner
// deleting real income.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '08-certificate.js'), 'utf8');
const i = src.indexOf('function renderChargeList(){');
let b = src.indexOf('{', i + 25), d = 0, end = -1;
for (let j = b; j < src.length; j++) {
  if (src[j] === '{') d++;
  else if (src[j] === '}') { d--; if (d === 0) { end = j + 1; break; } }
}
const fn = src.slice(i, end);

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

function render(loans, query, dupOnly) {
  const fields = {
    chgList: { innerHTML: '' },
    chgSearch: { value: query || '' },
    chgDupOnly: { checked: !!dupOnly },
  };
  const ctx = {
    $: id => fields[id] || null,
    loans,
    esc: v => String(v == null ? '' : v),
    inr: n => '₹' + Number(n || 0),
    fmtDate: d => String(d || ''),
    updateRegCards: () => {},
    renderChargeList: () => {},
    Date, Math, Number, String, Object, JSON, console,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fn + '; renderChargeList();', ctx);
  return { html: fields.chgList.innerHTML, dupCount: ctx._chgDupCount };
}

const chg = (id, type, amount, date, note) => ({ id, type, amount, date, note: note || '' });
const loan = (id, name, acno, charges) => ({ id, name, acno, charges });

// 1. THE CASE IT EXISTS FOR: two late fees on one borrower in one month
let r = render([loan('L1', 'Abha Srivastava', '16289', [
  chg('c1', 'Late fee', 500, '2026-09-09'),
  chg('c2', 'Late fee', 500, '2026-09-21'),
])]);
chk('two late fees in one month are flagged', r.dupCount, 2);

// 2. PRECISION — these must NOT be flagged
chk('different months are fine', render([loan('L1', 'A', '1', [
  chg('c1', 'Late fee', 500, '2026-09-09'), chg('c2', 'Late fee', 500, '2026-10-09')])]).dupCount, 0);
chk('different borrowers are fine', render([
  loan('L1', 'A', '1', [chg('c1', 'Late fee', 500, '2026-09-09')]),
  loan('L2', 'B', '2', [chg('c2', 'Late fee', 500, '2026-09-09')])]).dupCount, 0);
chk('different types in one month are fine', render([loan('L1', 'A', '1', [
  chg('c1', 'Late fee', 500, '2026-09-09'), chg('c2', 'Overdue interest', 600, '2026-09-09')])]).dupCount, 0);
chk('two cheque bounces in a month are NOT flagged (a borrower can bounce twice)',
  render([loan('L1', 'A', '1', [
    chg('c1', 'Cheque bounce', 350, '2026-09-02'), chg('c2', 'Cheque bounce', 350, '2026-09-20')])]).dupCount, 0);

// 3. three of a kind are all flagged
chk('three in a month flags all three', render([loan('L1', 'A', '1', [
  chg('c1', 'Overdue interest', 600, '2026-09-01'),
  chg('c2', 'Overdue interest', 600, '2026-09-10'),
  chg('c3', 'Overdue interest', 600, '2026-09-20')])]).dupCount, 3);

// 4. nothing is ever removed
const book = [loan('L1', 'A', '1', [chg('c1', 'Late fee', 500, '2026-09-09'), chg('c2', 'Late fee', 500, '2026-09-21')])];
render(book);
chk('the detector deletes nothing', book[0].charges.length, 2);

// 5. search narrows the list
const many = [
  loan('L1', 'Akash Balmiki', '17886', [chg('c1', 'Overdue interest', 1400, '2026-10-12')]),
  loan('L2', 'Abha Srivastava', '16289', [chg('c2', 'Late fee', 500, '2026-10-09')]),
  loan('L3', 'Sunil Shah', '16301', [chg('c3', 'Cheque bounce', 600, '2026-10-02')]),
];
chk('search by borrower', (render(many, 'akash').html.match(/chg-badge/g) || []).length, 1);
chk('search by account number', (render(many, '16289').html.match(/chg-badge/g) || []).length, 1);
chk('search by type', (render(many, 'bounce').html.match(/chg-badge/g) || []).length, 1);
chk('search is case-insensitive', (render(many, 'ABHA').html.match(/chg-badge/g) || []).length, 1);
chk('empty search shows everything', (render(many, '').html.match(/chg-badge/g) || []).length, 3);
chk('no match says so', /Nothing matches that search/.test(render(many, 'zzzz').html), true);

// 6. the duplicates-only filter
const mixed = [
  loan('L1', 'A', '1', [chg('c1', 'Late fee', 500, '2026-09-09'), chg('c2', 'Late fee', 500, '2026-09-21')]),
  loan('L2', 'B', '2', [chg('c3', 'Late fee', 500, '2026-09-09')]),
];
chk('all three listed normally', (render(mixed, '', false).html.match(/chg-badge/g) || []).length, 3);
chk('duplicates-only shows just the pair', (render(mixed, '', true).html.match(/chg-badge/g) || []).length, 2);

// 7. the header still reports the true total when filtered
chk('header shows filtered of total', /1 of 3/.test(render(many, 'akash').html), true);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHARGE-REGISTER CHECKS PASS');
process.exitCode = fails ? 1 : 0;
