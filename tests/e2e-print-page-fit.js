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
// The answer is vh: at print time it resolves to the actual page box, whatever
// margins end up applied. These checks keep every document on that rule.

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

// Every file that defines a printable page box.
const files = [
  'src/styles/01-base.css',
  'src/app/25-welcome-letter.js',
  'src/app/26-letterhead.js',
  'src/app/28-loan-file.js',
];

// --- 1. A big fixed page height must always be backed by a vh rule.
// Anything >= 240mm is describing a sheet, not a component.
const unbacked = [];
for (const f of files) {
  let src = fs.readFileSync(path.join(root, f), 'utf8');
  // Only print rules are judged. The on-screen preview is deliberately a fixed
  // 296mm sheet so it looks like a sheet of paper in the app -- that is not a
  // print-fit problem and must not be "fixed".
  if (f.endsWith('.css')) src = printRules(src);
  const re = /(min-)?height\s*:\s*(\d{3}(?:\.\d+)?)mm/g;
  let m;
  while ((m = re.exec(src))) {
    if (Number(m[2]) < 240) continue;
    // a vh override must follow within the same declaration block
    const after = src.slice(m.index, m.index + 160);
    // a line marked print-fit-exempt is an offscreen measuring harness, not a
    // page box -- it is sized to the printable area on purpose
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const context = src.slice(Math.max(0, lineStart - 400), m.index);
    if (/print-fit-exempt/.test(context)) continue;
    if (!/\dvh\b/.test(after)) {
      unbacked.push(f + ': ' + m[0] + ' with no vh fallback');
    }
  }
}
chk('no page box relies on a fixed millimetre height alone', unbacked, []);

// --- 2. No page box may be left to collapse to its content.
const collapsing = [];
for (const f of files) {
  let src = fs.readFileSync(path.join(root, f), 'utf8');
  if (f.endsWith('.css')) src = printRules(src);
  src.split('\n').forEach((L, i) => {
    if (!/min-height\s*:\s*(auto|0)\s*(!important)?\s*[;}'"]/.test(L)) return;
    // only care about rules that are page boxes
    if (!/\.page\b|\.pform\b|\.cover-page\b|\.cover-sheet\b|\.wl-cover\b|#lhpage\b|\bbody\s*\{/.test(L)) return;
    collapsing.push(f + ':' + (i + 1));
  });
}
chk('no page box collapses to its content height', collapsing, []);

// --- 3. The letterhead's shrink-to-fit must measure the page, not a constant.
const lh = fs.readFileSync(path.join(root, 'src/app/26-letterhead.js'), 'utf8');
chk('letterhead no longer scales against a hard-coded pixel target',
  /TARGET\s*=\s*\d+/.test(lh), false);
chk('  it measures the page box instead', /clientHeight/.test(lh), true);
chk('  and never sets the page height to the content height',
  /pg\.style\.height\s*=/.test(lh), false);
chk('letterhead footer is pinned to the foot of the sheet',
  /\.lhfoot\{[^}]*margin-top:auto/.test(lh), true);
chk('letterhead body fills the page box', /body\{[^}]*min-height:99vh/.test(lh), true);

// --- 4. The certificate / receipt page: full page, footer at the bottom.
const css = fs.readFileSync(path.join(root, 'src/styles/01-base.css'), 'utf8');
const printBlock = printRules(css);
chk('certificate page is sized to the page box', /\.page\{[^}]*min-height:99vh/.test(printBlock), true);
chk('  laid out as a column', /\.page\{[^}]*flex-direction:column/.test(printBlock), true);
chk('  with the signature block pushed to the foot',
  /\.page \.sigblock\{[^}]*margin-top:auto/.test(printBlock), true);
chk('  and a millimetre fallback declared before it',
  /\.page\{[^}]*min-height:265mm[^}]*min-height:99vh/.test(printBlock), true);

// --- 5. The two certificates must not run into one another when both print.
chk('a second document starts its own sheet',
  /\.page \+ \.page\{[^}]*page-break-before:always/.test(printBlock), true);

// --- 6. break-inside:avoid on a full-page box can shunt the whole page to the
// next sheet and leave the first one blank -- it must not come back.
chk('no break-inside:avoid on the full-height page box',
  /\.page\{[^}]*break-inside:avoid/.test(printBlock), false);

// --- 7. The cover pages carry visible borders/graphics, so their height shows.
chk('loan-documents cover fills the page box',
  /\.cover-page\{[^}]*min-height:99vh/.test(printBlock), true);
const lf = fs.readFileSync(path.join(root, 'src/app/28-loan-file.js'), 'utf8');
chk('loan-file booklet cover fills the page box',
  /\.cover-sheet\{[^}]*min-height:99vh/.test(lf), true);
const wl = fs.readFileSync(path.join(root, 'src/app/25-welcome-letter.js'), 'utf8');
chk('welcome-letter cover fills the page box', /min-height:99vh/.test(wl), true);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL PRINT PAGE-FIT CHECKS PASS');
process.exitCode = fails ? 1 : 0;
