// How tall is a printed page? Not a number you can hard-code.
//
// Two ways to get this wrong, and the app has had both:
//
//   min-height:auto  -> the sheet shrinks to the text, so a short certificate
//                       prints across the top half and the footer, gold rule
//                       and corner graphic stop mid-page.
//
//   min-height:295mm -> looks like "a full A4", but @page{margin:0} is only a
//                       request. The print dialog's own margin setting wins, so
//                       the real printable height can be ~277mm and a rigid
//                       295mm block overruns -- pushing the footer onto a
//                       second sheet. (This one shipped, and split the No Dues
//                       certificate between the signatures and the footer.)
//
// vh was the third attempt and it failed the same way: on a real printer it
// resolved taller than the printable area and the footer still spilled.
//
// The height of a printed page is simply not knowable from CSS. So the closing
// block is no longer laid out by height at all -- it is pinned with
// position:fixed, which is placed against the page box and takes no part in
// the flow. It adds zero height, so it cannot push anything onto a second
// sheet whatever the printable height turns out to be.
//
// These checks hold that line: no document may go back to guessing a page
// height, and the pinned footer must stay pinned.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// All @media print blocks (the stylesheet has more than one), concatenated.
// Rules outside them are screen rules: the on-screen preview is deliberately a
// fixed 296mm sheet so it looks like paper in the app, and must not be "fixed".
function printRules(css) {
  let out = '';
  let from = 0;
  for (;;) {
    const i = css.indexOf('@media print', from);
    if (i < 0) return out;
    let d = 0, end = css.length;
    for (let j = css.indexOf('{', i); j < css.length; j++) {
      if (css[j] === '{') d++;
      else if (css[j] === '}' && --d === 0) { end = j + 1; break; }
    }
    out += css.slice(i, end) + '\n';
    from = end;
  }
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

const css = fs.readFileSync(path.join(root, 'src/styles/01-base.css'), 'utf8');
const printBlock = printRules(css);

// --- 1. The certificate closing block is pinned, not laid out by height.
chk('signature block is pinned to the page box',
  /\.page-cert \.sigblock,[\s\S]{0,120}position:fixed/.test(printBlock), true);
chk('footer line is pinned to the page box',
  /\.page-cert \.docfoot,[\s\S]{0,120}position:fixed/.test(printBlock), true);
chk('the corner graphic is pinned to the paper, not the text',
  /\.page-cert \.pg-corner\.br,[\s\S]{0,120}position:fixed/.test(printBlock), true);
chk('space is reserved so the text cannot run under the pinned block',
  /\.page\{[^}]*padding:12mm 15mm 54mm/.test(printBlock), true);

// --- 2. No page-height guess may come back, in ANY printable document.
const guessy = [];
for (const f of ['src/styles/01-base.css', 'src/app/25-welcome-letter.js',
                 'src/app/26-letterhead.js', 'src/app/28-loan-file.js']) {
  let src = fs.readFileSync(path.join(root, f), 'utf8');
  if (f.endsWith('.css')) src = printRules(src);
  // comments explain the failed attempts by name -- don't flag the explanation
  src = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  src.split('\n').forEach((L, i) => {
    if (/print-fit-exempt/.test(L)) return;
    // a page-sized vh height is the guess that failed on a real printer
    if (/(min-)?height\s*:\s*(9\d|100)vh/.test(L)) guessy.push(f + ':' + (i + 1) + ' ' + L.trim().slice(0, 70));
  });
}
chk('no printable document sizes itself with a page-height vh guess', guessy, []);

// --- 3. The letterhead keeps its footer pinned too, and stays content-height.
const lh = fs.readFileSync(path.join(root, 'src/app/26-letterhead.js'), 'utf8');
chk('letterhead footer is pinned in print', /@media print\{\.lhfoot\{position:fixed/.test(lh), true);
chk('letterhead body is not forced to a page height', /body\{[^}]*min-height:0/.test(lh), true);
chk('letterhead reserves room for the pinned footer', /padding-bottom:26mm/.test(lh), true);
chk('letterhead still measures rather than hard-coding a target',
  [/TARGET\s*=\s*\d+/.test(lh), /clientHeight/.test(lh)], [false, true]);

// --- 4. Documents I did not need to touch must stay exactly as they shipped.
const lf = fs.readFileSync(path.join(root, 'src/app/28-loan-file.js'), 'utf8');
chk('loan-file booklet cover is unchanged', /\.cover-sheet\{padding:0;min-height:296mm;height:296mm/.test(lf), true);
const wl = fs.readFileSync(path.join(root, 'src/app/25-welcome-letter.js'), 'utf8');
chk('welcome-letter cover is unchanged', /min-height:248mm;"/.test(wl), true);
chk('loan-documents cover is unchanged', /\.cover-page\{width:auto; border:5px solid #111;\}/.test(printBlock), true);

// --- 5. break-inside:avoid on a page box can shunt a whole page -- stay away.
chk('no break-inside:avoid on the page box', /\.page\{[^}]*break-inside:avoid/.test(printBlock), false);
chk('a second document still starts its own sheet',
  /\.page \+ \.page\{[^}]*page-break-before:always/.test(printBlock), true);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL PRINT PAGE-FIT CHECKS PASS');
process.exitCode = fails ? 1 : 0;
