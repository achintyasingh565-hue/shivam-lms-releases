// Three defects in the message templates.
//
//   1. A Hindi message carried an ENGLISH borrower name. {name} resolves from
//      l.name, which is stored once and prints on every legal document, so no
//      amount of template editing could change it. An optional nameHi is now
//      used for Hindi messages only, falling back to the English name.
//
//   2. An unrecognised placeholder was sent to the borrower VERBATIM. The
//      substitution returned the token unchanged when it wasn't in the map, so
//      a template using {tenure} or {bank} WhatsApped "{tenure}" to a customer.
//
//   3. {tenure}, {bank}, {txn} and {loanid} were missing from the base map
//      entirely, so they only ever resolved for the few message types whose own
//      variable list happened to include them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
function extract(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

const REM = R('src/app/11-reminders.js');
const HELP = R('src/app/02-helpers-nav.js');

// run the REAL applyVars
const ctx = {
  Math, Number, String, Object, Array, JSON, console,
  inr: (n) => '₹' + (Math.round(Number(n) || 0)).toLocaleString('en-IN'),
  fmtDate: (d) => (d ? String(d) : ''),
  _lateFeeFor: () => 500,
};
vm.createContext(ctx);
vm.runInContext([extract(HELP, 'tenureText'), extract(REM, 'applyVars'),
                 'this.apply = applyVars;'].join('\n'), ctx);

const loan = { name: 'Dinesh Chandra Mishra', nameHi: 'दिनेश चन्द्र मिश्रा',
               acno: 'SE-2627-0002', emi: 8000, tenure: 12, outstanding: 100000, principal: 120000, rate: 2, due: '2026-12-10' };

// ---------------------------------------------------------------------------
console.log('--- 1. a Hindi message uses the Hindi name ---');
{
  const hi = 'नमस्ते {name}, शुभकामनाएँ।';
  chk('Hindi message takes nameHi', ctx.apply(hi, loan, {}, 'hi').indexOf(loan.nameHi) > -1, true);
  chk('  and no longer carries the English name', ctx.apply(hi, loan, {}, 'hi').indexOf('Dinesh') > -1, false);
  chk('English message still takes the English name', ctx.apply('Dear {name},', loan, {}, 'en'), 'Dear Dinesh Chandra Mishra,');
  chk('  as does a call with no language at all', ctx.apply('Dear {name},', loan, {}), 'Dear Dinesh Chandra Mishra,');

  const noHi = Object.assign({}, loan); delete noHi.nameHi;
  chk('a borrower with no Hindi name falls back', ctx.apply('{name}', noHi, {}, 'hi'), 'Dinesh Chandra Mishra');
  const blank = Object.assign({}, loan, { nameHi: '   ' });
  chk('  a blank Hindi name falls back too', ctx.apply('{name}', blank, {}, 'hi'), 'Dinesh Chandra Mishra');
}

// ---------------------------------------------------------------------------
console.log('\n--- 2. an unknown placeholder never reaches the borrower ---');
{
  chk('a stray token is dropped, not sent',
    ctx.apply('Dear {name}, your {nonsense} is ready.', loan, {}, 'en'),
    'Dear Dinesh Chandra Mishra, your is ready.');
  chk('  no brace survives', /[{}]/.test(ctx.apply('{name} {nope} {alsonope}', loan, {}, 'en')), false);
  chk('  double spaces are tidied', ctx.apply('A  B', loan, {}), 'A B');
  chk('  a space before a comma is closed up', ctx.apply('{name} , hello', loan, {}), 'Dinesh Chandra Mishra, hello');
  chk('  and before a Hindi full stop', ctx.apply('{nope}नमस्ते ।', loan, {}), 'नमस्ते।');
}

// ---------------------------------------------------------------------------
console.log('\n--- 3. the variables that used to fall through ---');
{
  chk('{tenure} resolves on an EMI loan', ctx.apply('{tenure}', loan, {}, 'en'), '12 months');
  const byaj = Object.assign({}, loan, { interestOnly: true, tenure: 0 });
  chk('  and reads properly on a byaj loan', ctx.apply('{tenure}', byaj, {}, 'en'), 'Monthly, until the principal is repaid');
  chk('{bank} resolves from the supplied value', ctx.apply('{bank}', loan, { bank: 'PNB' }, 'en'), 'PNB');
  chk('  and is empty, not raw, when absent', ctx.apply('[{bank}]', loan, {}, 'en'), '[]');
  chk('{loanid} resolves to the account number', ctx.apply('{loanid}', loan, {}, 'en'), 'SE-2627-0002');
  chk('{txn} is empty rather than raw', ctx.apply('[{txn}]', loan, {}, 'en'), '[]');
  chk('an explicit extra still overrides', ctx.apply('{outstanding}', loan, { outstanding: '₹1' }, 'en'), '₹1');
}

// ---------------------------------------------------------------------------
console.log('\n--- 4. every shipped template still resolves completely ---');
{
  const i = REM.indexOf('DEFAULT_TPL'), j = REM.indexOf('};', i);
  const seg = REM.slice(i, j);
  const tpl = {};
  const re = /^\s*([a-z_]+)\s*:\s*"((?:[^"\\]|\\.)*)"/gm;
  let m; while ((m = re.exec(seg))) tpl[m[1]] = m[2];
  const names = Object.keys(tpl);
  chk('all 32 templates found', names.length, 32);

  // supply what the richer message types carry
  const extra = { occasion: 'दीपावली', date: '10/11/2026', cheque: '077130',
                  bank: 'PNB', amount: '₹8,000', txn: 'TXN1' };
  let leaked = [];
  names.forEach((k) => {
    const out = ctx.apply(tpl[k], loan, extra, k.endsWith('_hi') ? 'hi' : 'en');
    if (/\{[a-z_]+\}/.test(out)) leaked.push(k);
  });
  chk('no template leaves an unresolved token', leaked, []);

  // and every Hindi template now carries the Hindi name
  const hiNames = names.filter((k) => k.endsWith('_hi') && tpl[k].indexOf('{name}') > -1);
  chk('  every Hindi template with {name} uses the Hindi name',
    hiNames.filter((k) => ctx.apply(tpl[k], loan, extra, 'hi').indexOf(loan.nameHi) < 0), []);
  chk('  and none of them still shows the English name',
    hiNames.filter((k) => ctx.apply(tpl[k], loan, extra, 'hi').indexOf('Dinesh') > -1), []);
}

// ---------------------------------------------------------------------------
console.log('\n--- 5. the loan modal stores it without disturbing anything ---');
{
  const CRUD = R('src/app/07-loans-crud.js');
  const HTML = R('src/index.template.html');
  chk('the field exists in the modal', /id="m_nameHi"/.test(HTML), true);
  chk('  exactly once', (HTML.match(/id="m_nameHi"/g) || []).length, 1);
  chk('  it sits on the borrower tab', /m_nameHi:'borrower'/.test(CRUD), true);
  chk('the record is loaded into it', /\$\('m_nameHi'\)\.value=f\.nameHi\|\|''/.test(CRUD), true);
  chk('  guarded, so an older markup cannot throw', /if\(\$\('m_nameHi'\)\) \$\('m_nameHi'\)\.value/.test(CRUD), true);
  chk('the record is saved from it', /nameHi:\(\(\(\$\('m_nameHi'\)\|\|\{\}\)\.value\)\|\|''\)\.trim\(\)/.test(CRUD), true);
  chk('the English name is untouched in the save', /\n\s*name, nameHi:/.test(CRUD), true);

  // a repeat borrower should not have to retype it in Devanagari
  chk('nameHi is carried across to a repeat borrower', /'nameHi',/.test(CRUD), true);
  chk("  and the autofill's m_<field> lookup resolves to the real input",
    /id="m_nameHi"/.test(HTML), true);

  // the send path keeps the row's language
  const WA = R('src/app/12-whatsapp.js');
  chk('the WhatsApp send path passes the row language', /applyVars\(it\.tpl, l, ex, it\.lang\)/.test(WA), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- 6. documents still use the English name ---');
{
  // nameHi must appear nowhere outside the message path
  const files = fs.readdirSync(path.join(root, 'src/app')).filter((f) => f.endsWith('.js'));
  const uses = files.filter((f) => /nameHi/.test(R('src/app/' + f)));
  chk('only the message and loan-record modules know about it',
    uses.sort(), ['07-loans-crud.js', '11-reminders.js']);
}


// ---------------------------------------------------------------------------
console.log('\n--- 7. the Devanagari suggestion ---');
{
  const H = R('src/app/02-helpers-nav.js');
  const i = H.indexOf('var HI_NAMES'), j = H.indexOf('function tenureText');
  const store = {};
  const c2 = { String, Object, Array, JSON, console, RegExp,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } } };
  vm.createContext(c2);
  vm.runInContext(H.slice(i, j) + '\nthis.t = hiTranslit; this.o = hiOccasion; this.learn = hiLearn;', c2);

  chk('a listed name comes out right', c2.t('Dinesh Chandra Mishra'), '\u0926\u093f\u0928\u0947\u0936 \u091a\u0902\u0926\u094d\u0930 \u092e\u093f\u0936\u094d\u0930\u093e');
  chk('  honorifics are translated, not transliterated', c2.t('Mr. Pramod Kumar').split(' ')[0], '\u0936\u094d\u0930\u0940');
  chk('  "Late" too', c2.t('Late Devi Charan').split(' ')[0], '\u0938\u094d\u0935\u0930\u094d\u0917\u0940\u092f');
  chk('an unlisted name still produces something', c2.t('Lavkush Nishad').length > 0, true);
  chk('Devanagari input is passed through untouched', c2.t('\u0926\u093f\u0928\u0947\u0936'), '\u0926\u093f\u0928\u0947\u0936');
  chk('an empty name gives an empty suggestion', c2.t('  '), '');

  chk('occasions use the accepted Hindi name', c2.o('Diwali'), '\u0926\u0940\u092a\u093e\u0935\u0932\u0940');
  chk('  two-word occasions too', c2.o('Raksha Bandhan'), '\u0930\u0915\u094d\u0937\u093e\u092c\u0902\u0927\u0928');
  chk('  and Devanagari typed directly is kept', c2.o('\u0939\u094b\u0932\u0940'), '\u0939\u094b\u0932\u0940');

  // the part that actually makes 100 names workable
  const before = c2.t('Ramesh Nishad');
  c2.learn('Lavkush Nishad', '\u0932\u0935\u0915\u0941\u0936 \u0928\u093f\u0937\u093e\u0926');
  const after = c2.t('Ramesh Nishad');
  chk('a correction is remembered', after.indexOf('\u0928\u093f\u0937\u093e\u0926') > -1, true);
  chk('  and applies to a different borrower with that surname', before === after, false);
  chk('a mismatched word count teaches nothing', c2.learn('A B C', '\u0905'), 0);
  chk('  nor does a Roman "correction"', c2.learn('Nishad', 'Nishad'), 0);
}

// ---------------------------------------------------------------------------
console.log('\n--- 8. suggestions never overwrite ---');
{
  const CRUD2 = R('src/app/07-loans-crud.js');
  chk('the suggestion stops if anything is typed',
    /if\(String\(hi\.value\|\|''\)\.trim\(\)!==''\) return;/.test(CRUD2), true);
  chk('  it is wired to the English name box', /loanNameLookup\(\);loanHiSuggest\(\)/.test(R('src/index.template.html')), true);
  chk('corrections are learnt on save', /loanHiLearn\(\)/.test(CRUD2), true);
  const REM2 = R('src/app/11-reminders.js');
  chk('the bulk fill only touches blank records',
    /!String\(l\.nameHi\|\|''\)\.trim\(\)/.test(REM2), true);
  chk('  and asks before writing', /if\(!confirm\(/.test(REM2.slice(REM2.indexOf('hiFillAllNames'))), true);
  chk('the occasion is translated only for Hindi',
    /lang==='hi' && typeof hiOccasion==='function'/.test(REM2), true);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
