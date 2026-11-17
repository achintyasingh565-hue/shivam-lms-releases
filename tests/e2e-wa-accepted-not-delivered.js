// The WhatsApp Cloud API returns HTTP 200 and a message id when it ACCEPTS a
// template. For a marketing template it can then decline to deliver it — the
// per-user marketing cap — and report that only on the "messages" status
// webhook, as error 131049. This desktop app has no public HTTPS endpoint, so
// it never receives that webhook and cannot know whether a message arrived.
//
// The app used to record acceptance as "Sent", which read as proof of
// delivery. Festival greetings were being accepted and silently dropped while
// the screen said every one had gone. These checks pin the honest wording and
// pin that utility messages are not labelled with the marketing caveat.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const W = fs.readFileSync(path.join(root, 'src/app/12-whatsapp.js'), 'utf8');

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
console.log('--- which categories WhatsApp treats as marketing ---');
{
  const decl = W.slice(W.indexOf('var WA_MARKETING_CATS='), W.indexOf('function waIsMarketing'));
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(decl + extract(W, 'waIsMarketing') + '; this.m = waIsMarketing;', ctx);

  // no transaction attached -> marketing -> subject to the per-user cap
  ['Greeting / Notice', 'Birthday Greeting', 'Office Closure', 'Business Launched']
    .forEach((c) => chk('marketing: ' + c, ctx.m(c), true));

  // attached to a transaction -> utility -> delivered normally
  ['EMI Reminder', 'Overdue Reminder', 'Payment Confirmation', 'Loan Approval',
   'Final Notice', 'Default Notice', 'Cheque Presentation', 'Cheque Bounce',
   'Loan Closed', 'Cheque Cleared', 'Loan Restructured', 'Welcome / Account Opened']
    .forEach((c) => chk('utility:   ' + c, ctx.m(c), false));

  chk('an unknown category is not claimed to be marketing', ctx.m('Something Else'), false);
  chk('  nor is a blank one', ctx.m(''), false);
}

// ---------------------------------------------------------------------------
console.log('\n--- the app no longer calls acceptance "Sent" ---');
{
  chk('a successful send records Accepted', /rec\.status='Accepted'/.test(W), true);
  chk('  and never records Sent again', /rec\.status='Sent'/.test(W), false);
  chk('  the marketing flag is stored on the record',
    /rec\.mktg=waIsMarketing\(it\.cat\)\?1:0/.test(W), true);
  chk('  the message id is still kept', /rec\.mid=res\.id\|\|''/.test(W), true);
  chk('a failure is still recorded as Failed', /rec\.status='Failed'/.test(W), true);

  chk('the toast says accepted, not sent', /accepted by WhatsApp'\)/.test(W), true);
  chk('  the summary panel says acceptance is not delivery',
    /Acceptance is not delivery/.test(W), true);
  chk('  the audit entry says accepted', /'accepted '\+okc\+', failed '\+failc/.test(W), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- the warning shown before a greeting batch ---');
{
  const seg = W.slice(W.indexOf('var _mk=sel.filter'), W.indexOf('const hist=loadWaHist()'));
  chk('only marketing messages trigger it', /waIsMarketing\(it\.cat\)/.test(seg), true);
  chk('  it is a confirm, so the send can still proceed', /if\(!confirm\(/.test(seg), true);
  chk('  it names how many of the batch are affected',
    /_mk\.length \+ ' of these ' \+ sel\.length/.test(seg), true);
  chk('  it names the categories', /_cats/.test(seg), true);
  // Meta's own wording: the limit is per person PER BUSINESS, weighted by how
  // likely that person is to reply — not a cap pooled across all businesses.
  // An earlier draft of this warning said "all businesses put together", which
  // was wrong; these two checks stop it coming back.
  chk('  it says the limit is from this business', /one person receives from this/.test(seg) && /business in a period/.test(seg), true);
  chk('  it names engagement as what tightens it', /tightest for people who rarely reply/.test(seg), true);
  chk('  it does NOT claim a cross-business cap', /businesses put together/.test(seg), false);
  chk('  it names the error code', /131049/.test(seg), true);
  chk('  it says where the real failures are visible', /Ecosystem health/.test(seg), true);
  chk('  it says reminders are unaffected', /Reminders and payment confirmations are not affected/.test(seg), true);
  chk('  it does not claim the app can see delivery',
    /never told\\nwhether it arrived|never told/.test(seg), true);

  // a batch of pure reminders must not be interrupted
  chk('the warning is skipped when nothing is marketing', /if\(_mk\.length\)\{/.test(seg), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- Message History ---');
{
  chk('history treats the old "Sent" records as Accepted too',
    /_acc=\(x\.status==='Accepted'\|\|x\.status==='Sent'\)/.test(W), true);
  chk('  the chip reads Accepted', /\\u2713 Accepted/.test(W), true);
  chk('  with a tooltip saying delivery is not confirmed',
    /delivery is not confirmed here/.test(W), true);
  chk('  greetings carry a visible caveat', /may not be delivered/.test(W), true);
  chk('  the caveat is driven by the stored flag OR the category',
    /_mk=\(x\.mktg===1\)\|\|waIsMarketing\(x\.category\)/.test(W), true);

  // a reminder must not be tarred with the marketing caveat
  const seg = W.slice(W.indexOf('const stat=_acc'), W.indexOf('return \'<details'));
  chk('  the caveat is conditional, not unconditional', /\(_mk\?/.test(seg), true);
}

// ---------------------------------------------------------------------------
console.log('\n--- nothing about sending itself changed ---');
{
  chk('the empty-variable pre-flight still blocks the batch', /CANNOT SEND/.test(W), true);
  chk('the retry on transient errors is untouched', /_waSendRetry/.test(W), true);
  chk('the 250ms pacing between recipients is untouched', /_waSleep\(250\)/.test(W), true);
  chk('the manual open-in-WhatsApp path still records its own status',
    /status:'Opened in app'/.test(W), true);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL CHECKS PASS');
process.exitCode = fails ? 1 : 0;
