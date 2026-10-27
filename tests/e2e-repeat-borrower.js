// Copying an existing borrower's details into a new loan.
//
// The dangerous mistake here would be copying anything about the LOAN — amount,
// tenure, rate, dates, account number — which would silently create a wrong
// loan that looks deliberate. Most of these checks guard that boundary.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '07-loans-crud.js'), 'utf8');
function slice(decl) {
  const i = src.indexOf(decl);
  if (i < 0) throw new Error('not found: ' + decl);
  let b = src.indexOf('{', i + decl.length - 1), d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced: ' + decl);
}

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

const EXISTING = {
  id: 'L1', name: 'Rajguru Tiwari', acno: '16286',
  reltype: 'son of', relname: 'Ram Tiwari', phone: '9876543210',
  addr: 'D-295 Indira Nagar, Lucknow', age: '41', occupation: 'Shopkeeper',
  gname: 'Sunil Shah', gphone: '9000000000',
  // loan terms that must NEVER be copied
  principal: 120000, tenure: 24, emi: 7400, rate: 2, disb: '2026-02-01',
  due: '2026-03-01', status: 'Active', tpay: 177600,
  ids: [{ type: 'Aadhaar', no: '1111-2222-3333' }],
  payments: [{ id: 'p', amount: 7400 }], charges: [{ id: 'c', amount: 500 }],
};

function form(typedName, editing, preset, accept) {
  const F = {};
  ['name','acno','reltype','relname','phone','addr','age','residence','occupation',
   'designation','officeaddr','gname','gphone','coname','cophone','corel','coid','coaddr',
   'principal','tenure','emi','rate','disb','due','status','tpay']
    .forEach(k => { F['m_' + k] = { value: (preset && preset[k]) || '' }; });
  F.m_name.value = typedName;

  const ctx = {
    $: id => F[id] || null,
    loans: [EXISTING],
    editId: editing ? 'L1' : null,
    modalIds: [],
    _idsFromRecord: l => (l.ids || []),
    renderIdRows: () => {},
    toast: m => { ctx._toast = m; },
    confirm: () => accept !== false,
    JSON, String, Number, console,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    slice('var LOAN_COPY_FIELDS = [').split('\n').slice(0, 5).join('\n') + '\n' +
    slice('function _normName(v)') + '\n' +
    slice('window.loanNameLookup = function()') + '\n', ctx);
  vm.runInContext('loanNameLookup();', ctx);
  return { F, ctx };
}

// 1. a repeat borrower's personal details come across
let { F, ctx } = form('Rajguru Tiwari');
chk('address copied', F.m_addr.value, 'D-295 Indira Nagar, Lucknow');
chk("father's name copied", F.m_relname.value, 'Ram Tiwari');
chk('phone copied', F.m_phone.value, '9876543210');
chk('occupation copied', F.m_occupation.value, 'Shopkeeper');
chk('guarantor copied', F.m_gname.value, 'Sunil Shah');
chk('identity documents copied', ctx.modalIds.length, 1);

// 2. THE BOUNDARY — nothing about the loan may be copied
chk('loan amount NOT copied', F.m_principal.value, '');
chk('tenure NOT copied', F.m_tenure.value, '');
chk('EMI NOT copied', F.m_emi.value, '');
chk('rate NOT copied', F.m_rate.value, '');
chk('disbursement date NOT copied', F.m_disb.value, '');
chk('due date NOT copied', F.m_due.value, '');
chk('account number NOT copied', F.m_acno.value, '');
chk('status NOT copied', F.m_status.value, '');

// 3. matching is forgiving about case and spacing, but not about identity
chk('case-insensitive match', form('rajguru tiwari').F.m_addr.value, 'D-295 Indira Nagar, Lucknow');
chk('extra spaces still match', form('  Rajguru   Tiwari ').F.m_addr.value, 'D-295 Indira Nagar, Lucknow');
chk('a different borrower is not matched', form('Someone Else').F.m_addr.value, '');
chk('a partial name is not matched', form('Rajguru').F.m_addr.value, '');

// 4. declining copies nothing
chk('declining leaves the form empty', form('Rajguru Tiwari', false, null, false).F.m_addr.value, '');

// 5. editing an existing loan must never trigger it
chk('no offer while editing', form('Rajguru Tiwari', true).F.m_addr.value, '');

// 6. anything already typed is never overwritten
const typed = form('Rajguru Tiwari', false, { addr: 'NEW ADDRESS', phone: '' });
chk('a typed address is kept', typed.F.m_addr.value, 'NEW ADDRESS');
chk('  but blank fields still fill', typed.F.m_phone.value, '9876543210');

// 7. a very short name does nothing (avoids prompting mid-typing)
chk('two letters does not prompt', form('Ra').F.m_addr.value, '');

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL REPEAT-BORROWER CHECKS PASS');
process.exitCode = fails ? 1 : 0;
