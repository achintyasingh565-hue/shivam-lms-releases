// Financial-math test harness.
// Loads the REAL functions out of src/app (brace-matched from source, not re-typed)
// into a sandbox where "today" is controllable, then runs edge cases against them.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'src', 'app');

function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }

// Extract `function NAME(...){...}` by brace matching, so we test the exact shipped code.
function extractFn(src, name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('not found: ' + name);
  let i = src.indexOf('{', idx), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(idx, j + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

function makeSandbox(fixedToday) {
  const helpers = read('02-helpers-nav.js');
  const cert = read('08-certificate.js');
  const sched = read('03-emi-schedule.js');
  const restr = read('17-restructure.js');

  const code = [
    "var SCHED_MAX_ROWS=600;",
    extractFn(helpers, 'repPad'),
    extractFn(helpers, 'repAddMonths'),
    extractFn(helpers, 'repDaysBetween'),
    extractFn(cert, 'emiDueDate'),
    extractFn(cert, 'calcLoanTotals'),
    extractFn(cert, 'recomputeLoan'),
    extractFn(sched, 'repScheduleData'),
    extractFn(restr, 'addMonths'),   // the schedule generator's month-adder
    extractFn(restr, 'fmt'),
    extractFn(restr, 'rupee'),
    extractFn(restr, 'build'),
  ].join('\n');

  const sandbox = {
    todayISO: () => fixedToday,
    console, Math, Number, Array, Date, JSON, String, isNaN, parseInt, parseFloat,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

module.exports = { makeSandbox };
