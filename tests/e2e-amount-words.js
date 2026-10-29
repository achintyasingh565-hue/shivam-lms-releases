// The promissory note's "(Rupees ______)" blank.
//
// Nothing ever filled it, so every note printed with the figure present and
// the words missing. On a negotiable instrument the words are the part that
// governs if the two disagree, so a blank there weakens the document.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '02-helpers-nav.js'), 'utf8');
const i = src.indexOf('function inrWords(');
let b = src.indexOf('{', i), d = 0, end = i;
for (let j = b; j < src.length; j++) {
  if (src[j] === '{') d++;
  else if (src[j] === '}' && --d === 0) { end = j + 1; break; }
}
const ctx = { Math, Number, String, Array };
vm.createContext(ctx);
vm.runInContext(src.slice(i, end), ctx);
const w = ctx.inrWords;

let fails = 0;
function chk(label, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (ok ? '' : '\n        got  ' + got + '\n        want ' + want));
}

// the reported loan
chk('2,00,000', w(200000), 'Two Lakh Only');
// Indian numbering, not thousands-millions
chk('1,00,000 is a lakh, not a hundred thousand', w(100000), 'One Lakh Only');
chk('1,00,00,000 is a crore', w(10000000), 'One Crore Only');
chk('mixed lakh + thousand', w(250000), 'Two Lakh Fifty Thousand Only');
chk('hundreds read with "and"', w(1567), 'One Thousand Five Hundred and Sixty Seven Only');
chk('teens', w(15), 'Fifteen Only');
chk('tens', w(40), 'Forty Only');
chk('a full mixed figure', w(1234567),
  'Twelve Lakh Thirty Four Thousand Five Hundred and Sixty Seven Only');
chk('largest realistic figure', w(99999999),
  'Nine Crore Ninety Nine Lakh Ninety Nine Thousand Nine Hundred and Ninety Nine Only');

// never produce a blank or a broken string
chk('zero', w(0), 'Zero Only');
chk('blank input', w(''), 'Zero Only');
chk('null input', w(null), 'Zero Only');
chk('text input', w('abc'), 'Zero Only');
chk('paise are dropped, not rounded up', w(200000.99), 'Two Lakh Only');
chk('a negative figure is read as its magnitude', w(-5000), 'Five Thousand Only');

// no double spaces anywhere across a wide sweep
let bad = [];
for (let n = 0; n <= 100000; n += 377) if (/\s{2,}|undefined|NaN/.test(w(n))) bad.push(n);
chk('no malformed output across 266 sample amounts', bad.length, 0);

// the note actually asks for it
const doc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '10-loan-documents.js'), 'utf8');
chk('the promissory note fills the words blank', /S\('pn_words'/.test(doc), true);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL AMOUNT-IN-WORDS CHECKS PASS');
process.exitCode = fails ? 1 : 0;
