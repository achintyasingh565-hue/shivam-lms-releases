// Reported: "in loan file when I add guarantor details, except name everything
// is missing from the file — father's name, address etc."
//
// The loan form has always collected the guarantor's name, father's/husband's
// name, address and phone. The Loan File used them in exactly one place (the
// promissory note). The application page printed the name alone, and the Loan
// Agreement printed hard-coded blank lines for the guarantor's father and
// address whatever was on record. Combining loans also dropped the guarantor's
// father and address, and the Excel export left them out.
//
// This renders the REAL Loan File for a loan with a full guarantor and checks
// every page carries what was entered.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const LF = R('src/app/31-loan-file.js');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// run the module and capture its private _html() through openLoanFile's iframe write
function render(loan) {
  let written = '';
  const frame = { contentWindow: { document: { open() {}, write(h) { written += h; }, close() {} } }, srcdoc: '' };
  const el = { style: {}, innerHTML: '', addEventListener() {}, appendChild() {} };
  const ctx = {
    window: {}, loans: [loan], toast() {}, console, Math, Number, String, Date, JSON, Object, Array,
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    fmtDate: (v) => { if (!v) return ''; const [y, m, d] = String(v).split('-'); return d + '-' + m + '-' + y.slice(2); },
    repAddMonths: (iso, n) => { const p = iso.split('-'); const d = new Date(+p[0], +p[1] - 1 + n, +p[2]); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    FIRM: () => ({ name: 'Shivam Enterprises', address: 'D-295, D-Block, Indira Nagar, Lucknow' }),
    firmRegLine: () => 'Udyam Reg. No.: UDYAM-UP-50-0268771',
    inrWords: () => 'Two Lakh Fifty Thousand Only',
    _docFileName: () => 'Loan_File', logAudit() {}, firmAddrLine: () => 'D-295, D-Block, Indira Nagar, Lucknow', firmPhoneLine: () => '9559561162', firmLine: () => '',
    document: {
      getElementById: (id) => (id === 'lfFrame' ? frame : (id === 'lfOverlay' ? el : null)),
      createElement: () => el, body: { appendChild() {} }, querySelector: () => null,
    },
    setTimeout: (f) => f(),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(LF, ctx);
  const src2 = LF.replace('try { fr.srcdoc = _html(l); } catch (e) {}', 'fr.srcdoc = _html(l);');
  if (src2 !== LF) { vm.runInContext(src2, ctx); }
  ctx.openLoanFile(loan.id);
  return written || frame.srcdoc || '';
}

const loan = {
  id: 'G1', acno: 'SE-2627-0007', name: 'Ramesh Kumar', reltype: 's/o', relname: 'Shyam Lal', addr: '12, Aliganj, Lucknow',
  phone: '9000000001', principal: 250000, rate: 2, tenure: 24, tint: 120000, tpay: 370000, emi: 15417,
  disb: '2026-11-21', payments: [], charges: [],
  gname: 'Suresh Verma', grelname: 'Mohan Verma', gaddr: '45, Mahanagar, Lucknow', gphone: '9000000002',
};

const html = render(loan);
chk('the Loan File renders', html.length > 1000, true);

// cut the document into its pages
const pages = html.split('<section class="sheet">').slice(1);
const appPage = pages.find((p) => /Name of the Applicant/.test(p)) || '';
const agrPage = pages.find((p) => /LOAN AGREEMENT/.test(p)) || '';
const pnPage = pages.find((p) => /PROMISSORY NOTE/.test(p)) || '';

console.log('--- application page ---');
chk('guarantor name', appPage.includes('Suresh Verma'), true);
chk('guarantor father\'s / husband\'s name (was missing)', appPage.includes('Mohan Verma'), true);
chk('guarantor address (was missing)', appPage.includes('45, Mahanagar, Lucknow'), true);
chk('guarantor phone (was missing)', appPage.includes('9000000002'), true);

console.log('\n--- loan agreement ---');
const agrPara = (agrPage.match(/Memorandum of agreement[\s\S]*?hereinafter called the “Guarantor”/) || [''])[0];
chk('guarantor name in the parties clause', agrPara.includes('Suresh Verma'), true);
chk('guarantor father in the parties clause (was a blank line)', agrPara.includes('Mohan Verma'), true);
chk('guarantor address in the parties clause (was a blank line)', agrPara.includes('45, Mahanagar, Lucknow'), true);

console.log('\n--- promissory note (already correct) ---');
chk('father and address still present', pnPage.includes('Mohan Verma') && pnPage.includes('45, Mahanagar, Lucknow'), true);

console.log('\n--- a detail left empty still prints a line to fill by hand ---');
const bare = Object.assign({}, loan, { id: 'G2', grelname: '', gaddr: '' });
const bareHtml = render(bare);
const bareAgr = ((bareHtml.split('<section class="sheet">').find((p) => /LOAN AGREEMENT/.test(p)) || '').match(/Memorandum of agreement[\s\S]*?hereinafter called the “Guarantor”/) || [''])[0];
chk('empty guarantor father -> blank line, not "undefined"', /Wife of Shri <span class="b bw"><\/span>/.test(bareAgr) && !/undefined/.test(bareHtml), true);

console.log('\n--- the other places that carry the guarantor ---');
chk('combining loans keeps the guarantor father and address', /'gname','gphone','grelname','gaddr'/.test(R('src/app/18-docgen.js')), true);
chk('the Excel export includes them', /'Guarantor S\/o, D\/o, W\/o','Guarantor Address'/.test(R('src/app/14-pwa-backup.js')), true);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
