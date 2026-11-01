// A byaj (interest-only) loan has no tenure and no instalment count: the
// borrower services the monthly interest and the principal stands until he
// returns it. Every document that printed `l.tenure` therefore put a bare 0 on
// a page meant to be signed:
//
//   "...repay the Loan with interest in  0  monthly instalments of Rs. 2,000"
//   "Monthly instalment Rs. 2,000 x 0"
//   "Tenure 0 months"          "Balance Instalments 0"
//   "This loan has 0 EMIs"
//
// A clause stating zero instalments states nothing, and on an agreement it
// reads as an error. These checks pin the byaj wording in every place it
// appears, and pin that an ordinary EMI loan is completely unchanged.

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

// ---------------------------------------------------------------------------
console.log('--- the shared wording helpers ---');
{
  const H = R('src/app/02-helpers-nav.js');
  const ctx = { Math, Number, String };
  vm.createContext(ctx);
  vm.runInContext([extract(H, 'tenureText'), extract(H, 'tenureShort'),
                   extract(H, 'instalmentCountText'),
                   'this.t = tenureText; this.s = tenureShort; this.c = instalmentCountText;'].join('\n'), ctx);

  const byaj = { interestOnly: true, tenure: 0 };
  chk('byaj tenure reads as a standing arrangement', ctx.t(byaj), 'Monthly, until the principal is repaid');
  chk('  short form for a tile', ctx.s(byaj), 'Monthly (interest only)');
  chk('  and the instalment count is a phrase, not a number', ctx.c(byaj), 'every month until the principal is repaid');
  chk('  never a bare zero', /\b0\b/.test(ctx.t(byaj) + ctx.s(byaj) + ctx.c(byaj)), false);

  const emi = { tenure: 12 };
  chk('an ordinary loan is unchanged', ctx.t(emi), '12 months');
  chk('  short form', ctx.s(emi), '12 mo');
  chk('  count', ctx.c(emi), '12');
  chk('one month is singular', ctx.t({ tenure: 1 }), '1 month');
  chk('a loan with no tenure set shows a dash, not 0', ctx.t({ tenure: 0 }), '—');
}

// ---------------------------------------------------------------------------
console.log('\n--- Loan File: clause 2 of the agreement ---');
{
  const LF = R('src/app/31-loan-file.js');
  chk('a byaj clause exists', /l\.interestOnly\s*\n?\s*\?\s*\('<li>The Borrower shall pay interest on the Loan/.test(LF), true);
  chk('  it names the monthly interest', /pay interest on the Loan at Rs\. ' \+ fv\(_r\(l\.emi\)\) \+ ' per month/.test(LF), true);
  chk('  it says what ends the loan', /until the principal sum of Rs\. ' \+ fv\(_r\(l\.principal\)\) \+ ' is repaid in full/.test(LF), true);
  chk('  it states the principal does not reduce',
    /principal shall remain due and payable in full and shall not stand reduced by any payment of interest/.test(LF), true);
  chk('  the EMI clause is still there for ordinary loans',
    /repay the Loan with interest in ' \+ fv\(l\.tenure\) \+ ' monthly instalments/.test(LF), true);

  // the clause is a single ternary, so exactly one of the two is ever emitted
  const seg = LF.slice(LF.indexOf('+ (l.interestOnly'), LF.indexOf('<li>As and by way of security'));
  chk('  exactly one clause is emitted', (seg.match(/<li>/g) || []).length, 2);
}

// ---------------------------------------------------------------------------
console.log('\n--- Loan File: Schedule of Loan table ---');
{
  const LF = R('src/app/31-loan-file.js');
  chk('byaj shows the monthly interest, not "x 0"',
    /Monthly interest Rs\. ' \+ fv\(_r\(l\.emi\)\) \+ ', payable every month/.test(LF), true);
  chk('  and the principal as what is repayable',
    /Principal repayable Rs\. ' \+ fv\(_r\(l\.principal\)\) \+ ', plus interest until repaid/.test(LF), true);
  chk('  the "x tenure" form survives for ordinary loans',
    /Monthly instalment Rs\. ' \+ fv\(_r\(l\.emi\)\) \+ ' &times; ' \+ fv\(l\.tenure\)/.test(LF), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- Loan Documents tab: agreement + schedule row ---');
{
  const V = R('src/views/loan-documents.html');
  const J = R('src/app/10-loan-documents.js');
  chk('the view carries both clause 2 variants', /id="av_c2emi"/.test(V) && /id="av_c2byaj"/.test(V), true);
  chk('  the byaj one is hidden by default', /id="av_c2byaj" style="display:none;"/.test(V), true);
  chk('the view carries both schedule rows', /id="av_rowemi"/.test(V) && /id="av_rowbyaj"/.test(V), true);
  chk('  the byaj row is hidden by default', /id="av_rowbyaj" style="display:none;"/.test(V), true);

  chk('the product is remembered when the form is filled from a loan',
    (J.match(/window\._hpByaj=!!l\.interestOnly;/g) || []).length, 2);
  chk('  clearing the form clears it', /window\._hpByaj=false;/.test(J), true);
  chk('  and the right pair is shown', /_show\('av_c2emi', !_byaj\); _show\('av_c2byaj', _byaj\);/.test(J), true);
  chk('  the byaj spans are filled', /S\('avb_emi',num\(emi\)\);[\s\S]{0,120}S\('avb_loan',num\(loan\)\);/.test(J), true);

  // no duplicate ids introduced — the whole app resolves elements by id
  const ids = [...V.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  chk('no duplicate id in the view', ids.filter((x, i) => ids.indexOf(x) !== i), []);
}

// ---------------------------------------------------------------------------
console.log('\n--- Statement of Account ---');
{
  const H = R('src/app/02-helpers-nav.js');
  chk('the on-screen terms table uses the helper', /<th>Tenure<\/th><td>'\+esc\(tenureText\(l\)\)/.test(H), true);
  chk('  and labels the byaj figure as interest, not EMI',
    /\(l\.interestOnly\?'Monthly interest':'EMI'\)/.test(H), true);
  chk('the printed summary uses the short helper', /\['Tenure',tenureShort\(l\)\]/.test(H), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- Welcome Letter: Loan Account Detail ---');
{
  const W = R('src/app/26-welcome-letter.js');
  chk('byaj gets its own detail block', /l\.interestOnly\s*\n?\s*\?\s*\(_kv\('Principal Repayable'/.test(W), true);
  chk('  no "0 months / 0"', /_kv\('Tenure \/ Total Instalments', 'Monthly, until the principal is repaid'\)/.test(W), true);
  chk('  and no "Balance Instalments 0" for byaj',
    /\?[\s\S]{0,400}Balance Instalments/.test(W.slice(W.indexOf("l.interestOnly\n        ? (_kv('Principal Repayable'"), W.indexOf("_kv('Loan Status'"))), false);
  chk('the ordinary block is untouched',
    /_kv\('Tenure \/ Total Instalments', \(Number\(l\.tenure\) \|\| 0\) \+ ' months \/ '/.test(W), true);
  // the earlier summary block already handled byaj — confirm it still does
  chk('the summary block still shows Monthly Interest Payable',
    /_kv\('Monthly Interest Payable'/.test(W), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- EMI schedule legend ---');
{
  const S = R('src/app/03-emi-schedule.js');
  chk('byaj gets a "Monthly interest" legend instead of "0 EMIs"',
    /pt\('Monthly interest', 'the byaj of '\+inr\(D\.emi\)/.test(S), true);
  chk('  it says there is no fixed count', /There is no fixed number of instalments/.test(S), true);
  chk('  the EMI legend survives for ordinary loans',
    /pt\('EMI', 'the fixed monthly instalment of '\+inr\(D\.emi\)\+'\. This loan has '\+D\.n/.test(S), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- WhatsApp / message templates ---');
{
  const M = R('src/app/11-reminders.js');
  chk('the {tenure} variable uses the helper',
    /tenure:\(\(typeof tenureText==='function'\)\?tenureText\(l\):String\(l\.tenure\|\|''\)\)/.test(M), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- nothing about the money changed ---');
{
  const { makeSandbox } = require('./harness');
  const S = makeSandbox('2026-06-01');
  const l = { id: 'B', interestOnly: true, principal: 100000, rate: 2, tenure: 0,
              disb: '2026-01-01', charges: [],
              payments: [2, 3, 4, 5, 6].map((m) => ({ date: '2026-0' + m + '-01', amount: 2000, status: 'Cleared' })) };
  S.recomputeLoan(l);
  chk('byaj principal untouched by interest receipts', l.outstanding, 100000);
  chk('  the monthly due is still the interest', l.emi, 2000);
  chk('  tenure is still 0 in the DATA (only the wording changed)', l.tenure, 0);
  chk('  total payable is still the principal', l.tpay, 100000);
  chk('  and no notional interest is added to the debt', l.tint, 0);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
