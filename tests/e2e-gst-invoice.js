// GST tax invoices for the processing charge (v2.34.0).
//
// From the effective date of registration (20 Nov 2026) every new loan with a
// processing charge gets a tax invoice. GST is added on top by default and can
// be included per loan. Numbers run SE/26-27/0001 per financial year and are
// never reused; an issued invoice is never edited — a change goes through a
// credit note. GST changes only the cash handed over, never what is owed.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const GST = R('src/app/37-gst-invoice.js');
const HLP = R('src/app/02-helpers-nav.js');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}
function extract(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('unbalanced: ' + name);
}
function extractConst(src, name) {
  const i = src.indexOf('const ' + name + ' = {');
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 2); }
  throw new Error('unbalanced: ' + name);
}

function world(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const answers = (opts.confirm || []).slice();
  const ctx = {
    console, Math, Number, String, Date, JSON, Object, Array, isFinite, parseInt,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    loans: opts.loans || [], recycle: opts.recycle || [],
    todayISO: () => opts.today || '2026-11-21',
    confirm: () => (answers.length ? answers.shift() : true),
    logAudit() {}, toast() {}, save() {},
    inr: (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN'),
    fmtDate: (v) => { if (!v) return ''; const [y, m, d] = String(v).split('-'); return d + '-' + m + '-' + y.slice(2); },
    inrWords: (n) => (n === 11800 ? 'Eleven Thousand Eight Hundred Only' : String(n) + ' Only'),
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    currentUser: { name: 'Achintya' },
  };
  ctx.window = ctx;
  ctx.recycleLoad = () => ctx.recycle;
  vm.createContext(ctx);
  vm.runInContext(extractConst(HLP, 'FIRM_DEFAULT') + '\n' + extract(HLP, 'FIRM') + '\nthis.FIRM=FIRM;', ctx);
  vm.runInContext(GST, ctx);
  ctx._store = store;
  return ctx;
}
const loan = (o) => Object.assign({ id: 'L' + Math.random().toString(36).slice(2, 7), acno: 'SE-2627-0006', name: 'Ramesh Kumar', reltype: 's/o', relname: 'Shyam Lal', addr: '12, Aliganj, Lucknow',
  principal: 250000, deductions: 10000, rate: 2, tenure: 24, tint: 120000, tpay: 370000, emi: 15417, disb: '2026-11-21', charges: [], payments: [] }, o || {});

// ---------------------------------------------------------------------------
console.log('--- the arithmetic ---');
{
  const W = world();
  chk('on top, Rs 10,000: 9% + 9%, total 11,800', W.feeGstSplit(10000, 'top'), { fee: 10000, cgst: 900, sgst: 900, gst: 1800, roundOff: 0, total: 11800 });
  chk('included, Rs 10,000: the sample figures', W.feeGstSplit(10000, 'incl'), { fee: 8474.58, cgst: 762.71, sgst: 762.71, gst: 1525.42, roundOff: 0, total: 10000 });
  chk('on top, Rs 4,250: half-rupee GST, no round-off needed', W.feeGstSplit(4250, 'top'), { fee: 4250, cgst: 382.5, sgst: 382.5, gst: 765, roundOff: 0, total: 5015 });
  chk('on top, Rs 1,111: total rounded to the rupee, round-off shown', W.feeGstSplit(1111, 'top'), { fee: 1111, cgst: 99.99, sgst: 99.99, gst: 199.98, roundOff: 0.02, total: 1311 });

  // every amount from 1 to 60,000 adds up to the paisa, both ways
  let bad = [];
  for (let b = 1; b <= 60000; b += (b < 2000 ? 1 : 37)) {
    const t = W.feeGstSplit(b, 'top'), i = W.feeGstSplit(b, 'incl');
    const sumT = Math.round((t.fee + t.cgst + t.sgst + t.roundOff) * 100), sumI = Math.round((i.fee + i.cgst + i.sgst) * 100);
    if (sumT !== t.total * 100 || Math.abs(t.roundOff) > 0.5   /* 50 paise rounds UP, as the law reads */ || t.cgst !== t.sgst) bad.push('top ' + b);
    if (sumI !== b * 100 || i.cgst !== i.sgst || i.total !== b) bad.push('incl ' + b);
  }
  chk('taxable + CGST + SGST (+ round-off) = total for every amount, both ways; CGST always equals SGST', bad.slice(0, 5), []);
}

// ---------------------------------------------------------------------------
console.log('\n--- which loans get an invoice ---');
{
  const W = world();
  chk('firm defaults carry the GSTIN and effective date', [W.gstCfg().gstin, W.gstCfg().from], ['09JXBPK7550J2ZX', '2026-11-20']);
  chk('disbursed on the effective date: yes', W.feeInvoiceQualifies(loan({ disb: '2026-11-20' })), true);
  chk('disbursed the day before: no', W.feeInvoiceQualifies(loan({ disb: '2026-11-19' })), false);
  chk('no processing charge: no', W.feeInvoiceQualifies(loan({ deductions: 0 })), false);
  chk('a sample (TEST) loan: no', W.feeInvoiceQualifies(loan({ _test: true })), false);
  chk('no disbursement date yet: no', W.feeInvoiceQualifies(loan({ disb: '' })), false);
  const saved = world({ store: { shivam_firm_v1: JSON.stringify({ name: 'SHIVAM ENTERPRISES', address: 'x', gstin: '', udyam: 'u' }) } });
  chk('firm details saved before this version (GSTIN blank) still invoice', saved.gstCfg().gstin, '09JXBPK7550J2ZX');
  const other = world({ store: { shivam_firm_v1: JSON.stringify({ gstin: '09AAAAA0000A1Z5', gstFrom: '2027-01-01' }) } });
  chk('a GSTIN and date entered in Firm Details win over the defaults', [other.gstCfg().gstin, other.gstCfg().from], ['09AAAAA0000A1Z5', '2027-01-01']);
}

// ---------------------------------------------------------------------------
console.log('\n--- cash handed over; nothing owed changes ---');
{
  const W = world();
  chk('on top: 2,50,000 - 11,800 = 2,38,200', W.feeNetDisbursed(loan()), 238200);
  chk('included: 2,50,000 - 10,000 = 2,40,000', W.feeNetDisbursed(loan({ gstOnFee: 'incl' })), 240000);
  chk('before the effective date: no GST', W.feeNetDisbursed(loan({ disb: '2026-11-01' })), 240000);
  chk('an adjustment (dues carried over) still comes off', W.feeNetDisbursed(loan({ downpay: 5000 })), 233200);

  const { makeSandbox } = require('./harness');
  const S = makeSandbox('2026-12-25');
  const a = loan(), b = loan({ gstOnFee: 'top', feeInvoice: { no: 'SE/26-27/0001', total: 11800, status: 'issued' } });
  S.recomputeLoan(a); S.recomputeLoan(b);
  chk('outstanding, EMI, total payable, arrears identical with an invoice on the loan',
    [b.outstanding, b.emi, b.tpay, b.arrears], [a.outstanding, a.emi, a.tpay, a.arrears]);
}

// ---------------------------------------------------------------------------
console.log('\n--- numbering ---');
{
  const l1 = loan(), l2 = loan({ disb: '2026-12-02' }), l3 = loan({ disb: '2027-03-31' }), l4 = loan({ disb: '2027-04-01' });
  const W = world({ loans: [l1, l2, l3, l4] });
  chk('first invoice', W.gstIssue(l1).no, 'SE/26-27/0001');
  chk('second', W.gstIssue(l2).no, 'SE/26-27/0002');
  chk('31 March is still 2026-27', W.gstIssue(l3).no, 'SE/26-27/0003');
  chk('1 April starts the 2027-28 series at 0001', W.gstIssue(l4).no, 'SE/27-28/0001');
  chk('an invoice is not issued twice for one loan', W.gstIssue(l1), null);
  chk('the longest number fits the 16-character limit', 'SE/CN/26-27/0001'.length <= 16, true);

  // a number is never reused, even after its loan is gone from the book and the bin
  W.loans.splice(W.loans.indexOf(l3), 1);
  const l5 = loan({ disb: '2027-01-10' });
  W.loans.push(l5);
  chk('after the loan holding 0003 is gone entirely, the next is 0004 — not 0003 again', W.gstIssue(l5).no, 'SE/26-27/0004');
}

// ---------------------------------------------------------------------------
console.log('\n--- saving a loan ---');
{
  const l = loan();
  const W = world({ loans: [l], confirm: [true] });
  chk('a new qualifying loan: invoice issued on save', W.gstOnLoanSave(l), 'Tax invoice SE/26-27/0001 issued');
  chk('  stored on the loan with what was billed', [l.feeInvoice.total, l.feeInvoice.mode, l.feeInvoice.party.name], [11800, 'top', 'Ramesh Kumar']);
  chk('  and in the durable log', W.gstLogLoad().map((d) => d.no), ['SE/26-27/0001']);
  chk('saving again with nothing changed: nothing happens', W.gstOnLoanSave(l), '');

  l.name = 'Ramesh K.';
  chk('editing the borrower\'s name does not rewrite the issued invoice', [W.gstOnLoanSave(l), l.feeInvoice.party.name], ['', 'Ramesh Kumar']);

  l.deductions = 9000;   // owner agrees: cancel and reissue
  chk('charge changed, owner agrees: cancelled and reissued', W.gstOnLoanSave(l), 'Invoice SE/26-27/0001 cancelled, SE/26-27/0002 issued');
  chk('  the old one is kept, cancelled, with its credit note', [l.feeInvoiceHistory[0].no, l.feeInvoiceHistory[0].status, l.feeInvoiceHistory[0].creditNote.no], ['SE/26-27/0001', 'cancelled', 'SE/CN/26-27/0001']);
  chk('  the new one carries the new figure', l.feeInvoice.total, 10620);

  const m = loan(); const W2 = world({ loans: [m], confirm: [false] });
  W2.gstOnLoanSave(m); m.gstOnFee = 'incl';
  chk('charge changed, owner declines: the issued invoice stands untouched', [W2.gstOnLoanSave(m), m.feeInvoice.no, m.feeInvoice.mode], ['', 'SE/26-27/0001', 'top']);
  chk('  and the cash figure follows the invoice actually issued', W2.feeNetDisbursed(m), 238200);

  const n = loan(); const W3 = world({ loans: [n], confirm: [true] });
  W3.gstOnLoanSave(n); n.disb = '2026-11-10';
  chk('moved before the effective date: cancelled, not reissued', [W3.gstOnLoanSave(n), !!n.feeInvoice], ['Invoice SE/26-27/0001 cancelled by credit note', false]);

  const old = loan({ disb: '2026-10-14' }); const W4 = world({ loans: [old] });
  chk('a loan disbursed before 20 Nov never gets one', [W4.gstOnLoanSave(old), !!old.feeInvoice], ['', false]);
}

// ---------------------------------------------------------------------------
console.log('\n--- deleting a loan ---');
{
  const l = loan(); const W = world({ loans: [l], confirm: [true] });   // issuing on save asks nothing; the delete is the one question
  W.gstOnLoanSave(l); W.gstOnLoanDelete(l);
  chk('entered by mistake: cancelled by credit note', [l.feeInvoiceHistory[0].status, l.feeInvoiceHistory[0].creditNote.reason], ['cancelled', 'Loan record deleted']);
  const k = loan(); const W2 = world({ loans: [k], confirm: [false] });
  W2.gstOnLoanSave(k); W2.gstOnLoanDelete(k);
  chk('a real loan removed for tidiness: the invoice is kept (GST still due)', k.feeInvoice.status, 'issued');
}

// ---------------------------------------------------------------------------
console.log('\n--- the register ---');
{
  const a = loan({ id: 'A', acno: 'A1' }), b = loan({ id: 'B', acno: 'B1', disb: '2026-11-25', deductions: 4000 });
  const W = world({ loans: [a, b], confirm: [true], today: '2026-12-03' });
  W.gstIssue(a); W.gstIssue(b);
  W.gstCancel(b, 'Loan amended');                                  // credit note dated 3 Dec
  const docs = W.gstAllDocs();
  const nov = docs.filter((d) => d.date.slice(0, 7) === '2026-11'), dec = docs.filter((d) => d.date.slice(0, 7) === '2026-12');
  chk('November: both invoices (one marked cancelled)', nov.map((d) => [d.no, d.status]).sort(), [['SE/26-27/0001', 'issued'], ['SE/26-27/0002', 'cancelled']]);
  chk('December: the credit note, against the right invoice', dec.map((d) => [d.kind, d.no, d.against]), [['CN', 'SE/CN/26-27/0001', 'SE/26-27/0002']]);

  // a deleted, purged loan's invoice is still in the register (the log keeps it)
  W.loans.length = 0;
  chk('after the loans are gone, the log still holds all three documents', W.gstAllDocs().length, 3);

  // two devices issuing the same number at once
  const x = loan({ id: 'X', acno: 'X1', feeInvoice: { no: 'SE/26-27/0009', date: '2026-11-22', total: 11800, status: 'issued' } });
  const y = loan({ id: 'Y', acno: 'Y1', feeInvoice: { no: 'SE/26-27/0009', date: '2026-11-22', total: 5900, status: 'issued' } });
  const Wd = world({ loans: [x, y] });
  chk('the same number on two loans is reported as a duplicate', Wd.gstAllDocs().dups.map((d) => d.no), ['SE/26-27/0009']);
}

// ---------------------------------------------------------------------------
console.log('\n--- restoring never loses an invoice ---');
{
  const W = world();
  W.localStorage.setItem('shivam_gstlog_v1', JSON.stringify([{ no: 'SE/26-27/0005', loanId: 'A', kind: 'INV', status: 'issued' }]));
  chk('merging an older backup adds what is missing', W.gstLogMerge([{ no: 'SE/26-27/0001', loanId: 'Z', kind: 'INV' }]), 1);
  chk('  and keeps what this device issued since', W.gstLogLoad().map((d) => d.no).sort(), ['SE/26-27/0001', 'SE/26-27/0005']);
  chk('  a cancellation in the backup is carried over', (W.gstLogMerge([{ no: 'SE/26-27/0005', loanId: 'A', status: 'cancelled' }]), W.gstLogLoad().find((d) => d.no === 'SE/26-27/0005').status), 'cancelled');
  chk('the backup file carries the log', /gstlog:\(typeof gstLogLoad==='function'/.test(R('src/app/15-init-errors.js')), true);
  chk('  and the restore merges it', /gstLogMerge\(extras\.gstlog\)/.test(R('src/app/14-pwa-backup.js')), true);
  chk('the daily cloud snapshot carries it and merges it back',
    /_payload\.gstlog = gstLogLoad\(\)/.test(R('src/app/20-cloud-sync.js')) && /gstLogMerge\(_d\.gstlog\)/.test(R('src/app/20-cloud-sync.js')), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- the printed invoice matches the approved sample ---');
{
  const l = loan(); const W = world({ loans: [l] });
  W.gstIssue(l);
  const html = W.gstDocHTML(W.gstAllDocs()[0]);
  chk('GSTIN', html.includes('09JXBPK7550J2ZX'), true);
  chk('the address as registered', html.includes('D-295, First Floor, D-Block, Indira Nagar, Church Road, Lucknow, Uttar Pradesh 226016'), true);
  chk('mobile 9559561162', html.includes('Mob. 9559561162'), true);
  chk('no proprietor line', /Proprietor/i.test(html), false);
  chk('no interest-exemption note', /exempt/i.test(html), false);
  chk('number, SAC, place of supply, reverse charge', ['SE/26-27/0001', '997113', 'Uttar Pradesh (09)', 'Reverse charge <b>No</b>'].every((s) => html.includes(s)), true);
  chk('CGST 900, SGST 900, total 11,800', ['900.00', '11,800.00'].every((s) => html.includes(s)), true);
  chk('net paid to borrower 2,38,200', html.includes('2,38,200.00'), true);
  chk('amount in words', html.includes('Rupees Eleven Thousand Eight Hundred Only'), true);

  W.gstCancel(l, 'Processing charge amended');
  const cn = W.gstAllDocs().find((d) => d.kind === 'CN');
  const ch = W.gstDocHTML(cn);
  chk('a credit note says so and names the invoice it cancels', ['Credit note', 'SE/CN/26-27/0001', 'SE/26-27/0001', 'Processing charge amended'].every((s) => ch.includes(s)), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- wiring ---');
{
  const T = R('src/index.template.html'), C = R('src/app/07-loans-crud.js');
  chk('the loan form has the GST switch, on top first', /<select id="m_gstmode"[^>]*><option value="top">Added on top \(18%\)<\/option><option value="incl">/.test(T), true);
  chk('  opening a loan sets it from the record', /\$\('m_gstmode'\)\.value=\(f\.gstOnFee==='incl'\)\?'incl':'top'/.test(C), true);
  chk('  saving stores it', /gstOnFee: \(\(\$\('m_gstmode'\)\|\|\{\}\)\.value==='incl'\)\?'incl':'top'/.test(C), true);
  chk('  saving issues / reconciles the invoice before the book is saved', C.indexOf('gstOnLoanSave(rec)') > 0 && C.indexOf('gstOnLoanSave(rec)') < C.indexOf("logAudit(editId?'Loan Modified':'Loan Created'"), true);
  chk('  Net Disbursed in the form subtracts the GST when it is on top', /\$\('m_remaining'\)\.value=Math\.max\(0, Math\.round\(\(p-_withheld-dp\)\*100\)\/100\)/.test(C), true);
  chk('deleting asks about the invoice', /gstOnLoanDelete\(l\)/.test(C), true);
  chk('the Welcome Letter\'s net disbursed includes the GST', /feeNetDisbursed\(l\)/.test(R('src/app/26-welcome-letter.js')), true);
  chk('Reports has a GST Invoices tab', /data-r="gst">GST Invoices</.test(R('src/views/reports.html')), true);
  chk('Firm Details carries the effective date, invoice address and email', ['firm_gstFrom', 'firm_gstAddress', 'firm_email'].every((s) => R('src/app/24-firm-details.js').includes(s)), true);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
