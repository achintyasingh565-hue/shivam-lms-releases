// The "due in the next 7 days" window.
//
// todayISO() was already written to avoid toISOString(), because in IST that
// reports YESTERDAY before 05:30. But the +7 boundary next to it was still
// built with toISOString(), so first thing in the morning the dashboard,
// the notification bell and the reminders list each looked at a window that
// started a day early -- quietly dropping an account that was due today.
//
// These checks run the real addDaysISO() out of the source, and also
// demonstrate the old pattern failing, so the reason for the helper stays
// on the record.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '02-helpers-nav.js'), 'utf8');
function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let b = src.indexOf('{', i), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}
const ctx = { Date, Number, String, Math, console };
vm.createContext(ctx);
vm.runInContext(extract('todayISO') + '\n' + extract('addDaysISO'), ctx);
const addDaysISO = ctx.addDaysISO;

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// plain arithmetic
chk('7 days on', addDaysISO('2026-10-28', 7), '2026-11-04');
chk('crosses the month end', addDaysISO('2026-10-28', 10), '2026-11-07');
chk('crosses the year end', addDaysISO('2026-12-28', 7), '2027-01-04');
chk('backwards', addDaysISO('2026-03-03', -7), '2026-02-24');
chk('leap day is counted', addDaysISO('2028-02-28', 1), '2028-02-29');
chk('non-leap February', addDaysISO('2027-02-28', 1), '2027-03-01');
chk('zero is a no-op', addDaysISO('2026-10-28', 0), '2026-10-28');
chk('result keeps the padded format', addDaysISO('2026-01-05', 3), '2026-01-08');

// the window must be exactly 7 days wide and must INCLUDE today
const today = '2026-10-28';
const end = addDaysISO(today, 7);
chk('window ends 7 days out', end, '2026-11-04');
chk('an account due today is inside the window', today >= today && today <= end, true);
chk('an account due on day 7 is inside', '2026-11-04' <= end, true);
chk('an account due on day 8 is outside', '2026-11-05' <= end, false);

// --- why the helper exists: the old pattern, in IST, before 05:30 ---
// 2026-10-28 02:00 IST is 2026-10-27 20:30 UTC, so toISOString() reports the 27th.
const istEarlyMorning = new Date('2026-10-27T20:30:00Z');
const oldWay = (function () {
  const d = new Date(istEarlyMorning); d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
})();
chk('the old toISOString pattern really did land a day early', oldWay, '2026-11-03');
chk('addDaysISO gives the correct boundary instead', addDaysISO('2026-10-28', 7), '2026-11-04');
chk('  so the old window would have been one day short',
  oldWay < addDaysISO('2026-10-28', 7), true);

// no call site may go back to the old pattern
const appDir = path.join(__dirname, '..', 'src', 'app');
const offenders = [];
for (const f of fs.readdirSync(appDir).filter(x => x.endsWith('.js'))) {
  const t = fs.readFileSync(path.join(appDir, f), 'utf8');
  t.split('\n').forEach((L, i) => {
    if (/setDate\([^)]*\+\s*7\s*\)/.test(L) && /toISOString/.test(L)) offenders.push(f + ':' + (i + 1));
  });
}
chk('no 7-day window is built with toISOString any more', offenders, []);

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL DATE-WINDOW CHECKS PASS');
process.exitCode = fails ? 1 : 0;
