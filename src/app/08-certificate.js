  /* ---------- certificate ---------- */
  const dash="__________";
  function emiDueDate(l, i){
    var anchor=l.baseDate||l.disb;
    if(anchor) return repAddMonths(anchor, i);
    if(l.due) return repAddMonths(l.due, i-1);
    return repAddMonths(todayISO(), i);
  }
  /* Single source of truth for the interest model: monthly flat interest.
     Inputs are sanitised: negatives are clamped to 0 (a negative rate/principal/tenure can
     never silently produce a contract where the customer owes less than the principal),
     tenure is forced to a whole number of months, and non-finite input becomes 0. */
  function calcLoanTotals(principal, ratePctPerMonth, months){
    var p=Number(principal), r=Number(ratePctPerMonth), n=Number(months);
    p=(isFinite(p)&&p>0)?p:0; r=(isFinite(r)&&r>0)?r:0; n=(isFinite(n)&&n>0)?Math.round(n):0;
    const tint=Math.round(p*r/100*n);
    const tpay=Math.round(p)+tint;
    const emi=n>0?Math.round(tpay/n):0;
    return {tint:tint, tpay:tpay, emi:emi};
  }
  /* Strict validator for loan terms — used at entry points (form save / import).
     Returns {ok:true} or {ok:false, error:'human-readable reason'}. */
  function validateLoanTerms(principal, rate, tenure){
    var p=Number(principal), r=Number(rate), n=Number(tenure);
    if(!isFinite(p)||p<=0)  return {ok:false, error:'Loan amount (principal) must be a number greater than zero.'};
    if(!isFinite(r)||r<0)   return {ok:false, error:'Interest rate cannot be negative.'};
    if(r>100)               return {ok:false, error:'Interest rate looks wrong ('+r+'% per month). Please check.'};
    if(!isFinite(n)||n<0)   return {ok:false, error:'Tenure cannot be negative.'};
    if(Math.round(n)!==n)   return {ok:false, error:'Tenure must be a whole number of months.'};
    if(n>600)               return {ok:false, error:'Tenure looks wrong ('+n+' months = '+(n/12).toFixed(0)+' years). Please check.'};
    return {ok:true};
  }
  /* ---------- Interest-only ("byaj") loans ----------
     No fixed tenure. The customer pays only the MONTHLY INTEREST (principal × rate); the
     principal stays fully outstanding and is returned later in a lump sum. So interest
     payments are income and do NOT reduce the balance — only a payment tagged kind:'principal'
     (recorded via "Principal Returned") reduces it and, once it covers the principal, closes
     the loan. Arrears = interest that has fallen due but not been paid. */
  function _recomputeInterestOnly(l){
    var pays=Array.isArray(l.payments)?l.payments:[];
    var P=Math.max(0, Number(l.principal)||0);
    var rate=Math.max(0, Number(l.rate)||0);
    var monthlyInt=Math.round(P*rate/100);
    l.emi=monthlyInt;                 // the "EMI" is the monthly interest
    l.tpay=P;                         // what's ultimately owed = the principal
    l.tint=0;
    var clearedAll=pays.filter(function(p){return p.status==='Cleared';}).reduce(function(a,p){return a+(Number(p.amount)||0);},0);
    var principalPaid=pays.filter(function(p){return p.status==='Cleared' && p.kind==='principal';}).reduce(function(a,p){return a+(Number(p.amount)||0);},0);
    var interestPaid=pays.filter(function(p){return p.status==='Cleared' && p.kind!=='principal';}).reduce(function(a,p){return a+(Number(p.amount)||0);},0);
    var fees=(Array.isArray(l.charges)?l.charges:[]).reduce(function(a,c){return a+(c?(Number(c.amount)||0):0);},0);
    l.paid=clearedAll;
    l.outstanding=Math.max(0, P - principalPaid + fees);
    l.lateFees=(Array.isArray(l.charges)?l.charges:[]).filter(function(c){return c&&c.type==='Late fee';}).reduce(function(a,c){return a+(Number(c.amount)||0);},0);
    var t=todayISO(), monthsElapsed=0;
    try{ var anchor=l.baseDate||l.disb; if(anchor){ var d0=new Date(anchor+'T00:00:00'), dn=new Date(t+'T00:00:00'); monthsElapsed=(dn.getFullYear()-d0.getFullYear())*12+(dn.getMonth()-d0.getMonth()); if(dn.getDate()<d0.getDate()) monthsElapsed--; monthsElapsed=Math.max(0,monthsElapsed); } }catch(e){}
    var intArr=Math.max(0, monthlyInt*monthsElapsed - interestPaid);   // interest due but unpaid
    if(P>0 && principalPaid>=P){ l.status='Closed'; l.arrears=0; }
    else {
      l.arrears=Math.round(intArr + fees);
      if(!l.dueManual && (l.baseDate||l.disb) && monthlyInt>0){
        var nextIdx=Math.min(600, Math.floor(interestPaid/monthlyInt)+1);
        var nd=emiDueDate(l, nextIdx); if(nd) l.due=nd;
      }
      l.status=(intArr>0)?'Overdue':'Active';
    }
  }
  function recomputeLoan(l){
    if(l && l.interestOnly){ return _recomputeInterestOnly(l); }
    const pays=Array.isArray(l.payments)?l.payments:[];
    const _isInt=function(p){ return p && (p.intOnly===true || p.type==='Interest'); };
    // Interest-only payments service that month's interest (byaj) — they are INCOME and push
    // the due date forward, but they do NOT reduce principal, so they are excluded from the
    // amount that brings the balance down.
    const clearedAll=pays.filter(p=>p.status==='Cleared').reduce((a,p)=>a+(Number(p.amount)||0),0);
    const intPaid=pays.filter(p=>p.status==='Cleared' && _isInt(p)).reduce((a,p)=>a+(Number(p.amount)||0),0);
    const cleared=Math.max(0, clearedAll-intPaid);
    l.paid=cleared;
    l.intServiced=pays.filter(p=>p.status==='Cleared' && _isInt(p)).length;   // months serviced by interest only
    l.intIncome=Math.round(intPaid);                                          // total interest received this way
    const tpay=Number(l.tpay)||0;
    // Extra charges the customer must repay — late fees, cheque-bounce fees, etc. — are
    // ADDED to what they owe. They are stored line-items (sticky: once charged they stay
    // owed until a cleared payment brings the balance down), so there is no double-count.
    const _fees=(Array.isArray(l.charges)?l.charges:[]).reduce(function(a,c){return a+(c?(Number(c.amount)||0):0);},0);
    // Processing / deductions are withheld at disbursement only — the customer is liable for the FULL amount,
    // so they do NOT reduce the outstanding.
    l.outstanding=Math.max(0, tpay + _fees - cleared);
    const paidBase=Number(l.paidBase)||0;            // amount already paid as of the last restructure baseline
    const fwdCleared=Math.max(0, cleared-paidBase);  // payments counted against the current (forward) schedule
    const emi=Math.round(Number(l.emi)||0);
    const n=Math.max(0, Math.round(Number(l.tenure)||0));
    // Interest-only loans (tenure 0 with a monthly amount set) have dues every month with
    // no fixed end. Before this, n=0 meant "no EMIs are ever due", so these loans could sit
    // unpaid forever and still show "Active". Horizon-cap at 50 years as a safety bound.
    const horizon = n>0 ? n : (emi>0 ? 600 : 0);
    const t=todayISO();
    // Each interest-only month serviced pushes the WHOLE EMI schedule forward by a month, so
    // servicing this month's interest keeps the account current and defers the principal EMIs.
    var _shift=Math.max(0, Number(l.intServiced)||0);
    // how many EMIs were due on/before today (due dates are monotonic — stop at the first future one)
    var dueByToday=0;
    for(var i=1;i<=horizon;i++){ var d=emiDueDate(l,i); if(d && _shift) d=repAddMonths(d,_shift); if(d && d<=t) dueByToday++; else if(d && d>t) break; }
    // amount that should have been paid by today. For fixed-tenure loans this is capped at the
    // total payable of the current (forward) schedule, so the last month's rounding difference
    // (n*emi can differ from tpay by a few rupees) can never overstate arrears.
    var totalFwd=(l.baseOut!=null)?Math.max(0,Number(l.baseOut)):tpay;
    var expectedByToday=dueByToday*emi;
    if(n>0) expectedByToday=Math.min(expectedByToday, totalFwd);
    // Overdue EMIs (principal+interest past due) ...
    var emiArr=Math.max(0, expectedByToday - fwdCleared);
    // ... plus any charges (late fees, bounce fees) are all due now. The demand/overdue
    // "amount overdue" therefore includes the late fees the customer has been charged.
    var arr=emiArr + _fees;
    if(arr>l.outstanding) arr=l.outstanding;
    l.lateFees=(Array.isArray(l.charges)?l.charges:[]).filter(function(c){return c&&c.type==='Late fee';}).reduce(function(a,c){return a+(Number(c.amount)||0);},0);
    l.arrears=Math.round(arr);
    if(l.outstanding<=0 && tpay>0){
      l.status='Closed'; l.arrears=0;
    } else {
      // advance "next due" to the first EMI not yet fully covered — unless the user set a custom due date
      if(!l.dueManual && emi>0 && (l.baseDate||l.disb)){
        var nextIdx=Math.min(horizon, Math.floor(fwdCleared/emi)+1);
        var nd=emiDueDate(l, nextIdx);
        if(nd){ if(_shift) nd=repAddMonths(nd,_shift); l.due=nd; }
      }
      // Status is driven by overdue EMIs only, so an unpaid fee on an otherwise-current
      // loan does not flip it to "Overdue" (but it still adds to the balance).
      l.status=(emiArr>0)?'Overdue':'Active';
    }
  }
  // Balance a borrower still owed immediately AFTER a given payment (by index in the
  // payments array, chronological). Used so a "Payment Received" message shows the
  // running balance as of THAT payment — e.g. after ₹75,000 on an ₹87,000 loan it
  // reads ₹12,000, and only the next ₹12,000 payment reads ₹0.
  function balanceAtPayment(l, idx){
    if(!l) return 0;
    var pays=Array.isArray(l.payments)?l.payments:[];
    var clearedThrough=0;
    for(var i=0;i<=idx && i<pays.length;i++){ var p=pays[i]; if(p && p.status==='Cleared') clearedThrough+=Number(p.amount)||0; }
    var fees=(Array.isArray(l.charges)?l.charges:[]).reduce(function(a,c){return a+(c?(Number(c.amount)||0):0);},0);
    return Math.max(0, (Number(l.tpay)||0) + fees - clearedThrough);
  }
  window.balanceAtPayment=balanceAtPayment;
  function recomputeAll(){ if(typeof loans!=='undefined' && Array.isArray(loans)) loans.forEach(recomputeLoan); }

  /* ===== Sample / Test data (admin) — merges labelled (TEST) loans, removable in one click ===== */
  function _testLoans(){
    function aDays(iso,n){ var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
    var T=todayISO(), M=function(n){ return repAddMonths(T,n); };
    function mk(o){
      var p=o.principal, r=o.rate, n=o.tenure;
      var _t2=calcLoanTotals(p,r,n), tint=_t2.tint, tpay=_t2.tpay, emi=_t2.emi;
      return Object.assign({
        id:'LTEST_'+o.acno, _test:true, type:o.type||'Personal',
        principal:p, rate:r, tenure:n, tint:tint, tpay:tpay, emi:emi,
        deductions:o.deductions||0, paid:0, outstanding:tpay, arrears:0, status:'Active',
        payments:o.payments||[], charges:o.charges||[], createdAt:T
      }, o.extra||{}, { name:o.name, acno:o.acno, phone:o.phone, disb:o.disb, dob:o.dob||'' });
    }
    return [
      mk({ name:'Ramesh Kumar (TEST)', acno:'SE-T001', phone:'9000000001', principal:200000, rate:2.5, tenure:12, deductions:4000, disb:M(-2),
        payments:[{date:aDays(M(-1),-1),mode:'Online',amount:21667,status:'Cleared',ref:'UPI001'},{date:aDays(T,-1),mode:'Cash',amount:21667,status:'Cleared'}],
        extra:{ gname:'Suresh Kumar', gphone:'9000000011', coname:'Sita Kumar', cophone:'9000000021', corel:'Spouse', addr:'12 Test Nagar, Lucknow', remarks:'Sample borrower — current & paid on time' } }),
      mk({ name:'Sunita Devi (TEST)', acno:'SE-T002', phone:'9000000002', principal:150000, rate:3, tenure:10, disb:repAddMonths(aDays(T,-15),-2),
        payments:[{date:repAddMonths(aDays(T,-15),-1),mode:'Cash',amount:19500,status:'Cleared'}],
        extra:{ addr:'5 Sample Road, Lucknow', remarks:'Sample borrower — one EMI overdue' } }),
      mk({ name:'Mohan Lal (TEST)', acno:'SE-T003', phone:'9000000003', principal:300000, rate:2, tenure:24, disb:M(-6),
        payments:[{date:aDays(M(-5),1),mode:'Cash',amount:18500,status:'Cleared'},{date:aDays(M(-4),1),mode:'Cash',amount:18500,status:'Cleared'}],
        extra:{ gname:'Gopal Lal', gphone:'9000000013', addr:'88 Demo Lane, Lucknow', remarks:'Sample borrower — heavily overdue (aging)' } }),
      mk({ name:'Priya Sharma (TEST)', acno:'SE-T004', phone:'9000000004', principal:100000, rate:2, tenure:12, disb:M(-10),
        payments:[{date:M(-1),mode:'Online',amount:124000,status:'Cleared',ref:'FULLPAY'}],
        extra:{ remarks:'Sample borrower — fully paid / closed' } }),
      mk({ name:'Arjun Singh (TEST)', acno:'SE-T005', phone:'9000000005', principal:250000, rate:2.5, tenure:18, disb:M(-1),
        payments:[{date:aDays(T,-19),mode:'Cheque',amount:20139,status:'Cleared',cheque:'100231',bank:'HDFC Bank'},{date:aDays(T,-5),mode:'Cheque',amount:20139,status:'Pending',cheque:'100232',bank:'HDFC Bank'}],
        extra:{ remarks:'Sample borrower — cheque cleared + cheque pending' } }),
      mk({ name:'Kavita Yadav (TEST)', acno:'SE-T006', phone:'9000000006', principal:180000, rate:3, tenure:12, disb:M(-1),
        payments:[{date:aDays(T,-11),mode:'Online',amount:20400,status:'Cleared',ref:'UPI006'}],
        charges:[{id:'CT_006',date:aDays(T,-7),type:'Cheque bounce',amount:20400,cheque:'778812',note:'Cheque returned — insufficient funds'}],
        extra:{ remarks:'Sample borrower — bounced cheque charge' } }),
      mk({ name:'Deepak Verma (TEST)', acno:'SE-T007', phone:'9000000007', principal:120000, rate:2, tenure:12, disb:repAddMonths(aDays(T,3),-1), dob:'1990-'+T.slice(5),
        extra:{ remarks:'Sample borrower — birthday today + EMI due in 3 days' } }),
      mk({ name:'Anita Gupta (TEST)', acno:'SE-T008', phone:'9000000008', principal:220000, rate:2.5, tenure:12, disb:M(-1),
        payments:[{date:aDays(T,-4),mode:'Cash',amount:10000,status:'Cleared'}],
        extra:{ remarks:'Sample borrower — partial payment made' } })
    ];
  }
  function loadTestData(){
    if(typeof currentUser!=='undefined' && currentUser && currentUser.role!=='admin'){ toast('Only an administrator can load test data'); return; }
    if(!confirm('Add 8 sample (TEST) borrowers alongside your real records? You can remove them any time with "Remove test customers".')) return;
    snapBefore('Before loading test data');
    var have={}; loans.forEach(function(l){ if(l&&l.acno) have[l.acno]=true; });
    var add=_testLoans().filter(function(l){ return !have[l.acno]; });
    if(!add.length){ toast('Test customers are already loaded'); return; }
    loans = add.concat(loans);
    recomputeAll(); save();
    logAudit('Test Data Loaded', add.length+' sample borrowers added');
    if(typeof renderLoans==='function') renderLoans();
    if(typeof renderDash==='function') renderDash();
    toast(add.length+' test customers added — open Loan Records to explore. Remove them any time from Administration.');
  }
  function removeTestData(){
    if(typeof currentUser!=='undefined' && currentUser && currentUser.role!=='admin'){ toast('Only an administrator can remove test data'); return; }
    var n=loans.filter(function(l){ return l && l._test; }).length;
    if(!n){ toast('No test customers found'); return; }
    if(!confirm('Remove all '+n+' test customers? Your real records are not affected.')) return;
    loans = loans.filter(function(l){ return !(l && l._test); });
    recomputeAll(); save();
    logAudit('Test Data Removed', n+' sample borrowers removed');
    if(typeof renderLoans==='function') renderLoans();
    if(typeof renderDash==='function') renderDash();
    toast(n+' test customers removed.');
  }
  window.loadTestData=loadTestData; window.removeTestData=removeTestData;
  window.recomputeAll=recomputeAll;
  function refreshPayLoanDropdown(){
    const sel=$('payb_loan'); if(!sel) return; const cur=sel.value;
    // Borrowers are listed A\u2192Z; an optional search box filters the list as you type.
    var q=(($('payb_search')||{}).value||'').trim().toLowerCase();
    var list=loans.slice().sort(function(a,b){ return (a.name||'').localeCompare(b.name||'')||(a.acno||'').localeCompare(b.acno||''); });
    if(q) list=list.filter(function(l){ return ((l.name||'')+' '+(l.acno||'')).toLowerCase().indexOf(q)>=0; });
    sel.innerHTML='<option value="">\u2014 Select a borrower \u2014</option>'+list.map(l=>`<option value="${l.id}">${esc(l.name)} (${esc(l.acno)}) \u2014 bal ${inr(l.outstanding)}</option>`).join('');
    // keep the current pick if it still matches the filter; if the search narrows to a
    // single borrower, select them automatically so recording is one step.
    if(cur && list.some(function(l){return l.id===cur;})) sel.value=cur;
    else if(q && list.length===1) sel.value=list[0].id;
  }
  window.filterPayLoans=function(){ refreshPayLoanDropdown(); };
  /* One month's interest for a flat loan = total interest ÷ tenure (e.g. ₹2,88,000 ÷ 48 = ₹6,000). */
  function monthlyInterestOf(l){ if(!l) return 0; var n=Math.max(1, Math.round(Number(l.tenure)||0)); var I=Number(l.tint); if(!(I>0)) I=Math.max(0,(Number(l.tpay)||0)-(Number(l.principal)||0)); return Math.round(I/n); }
  window.monthlyInterestOf=monthlyInterestOf;
  window.payIntOnlyToggle=function(){
    var on=$('payb_intonly')&&$('payb_intonly').checked;
    if(!on) return;
    var id=$('payb_loan')?$('payb_loan').value:''; var l=loans.find(function(x){return x.id===id;});
    if(!l){ toast('Choose a borrower first — then tick interest-only'); if($('payb_intonly')) $('payb_intonly').checked=false; return; }
    var mi=monthlyInterestOf(l);
    if($('payb_amt')) $('payb_amt').value=mi>0?mi:'';
  };
  function payTabModeUI(){ const m=$('payb_mode').value; const cq=$('payb_cheqRow'); const on=$('payb_onlineRow'); if(cq) cq.style.display=(m==='Cheque')?'flex':'none'; if(on) on.style.display=(m==='Online')?'flex':'none'; }
  /* Every payment gets a unique id so entries have an identity (dedup, audit, sync). */
  function newPayId(){ return 'P'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
  /* True when an identical payment (same date+amount+mode+cheque/ref) already exists on the loan. */
  function isDuplicatePayment(l, p){
    return (l.payments||[]).some(function(q){
      return q && Number(q.amount)===Number(p.amount) && (q.date||'')===(p.date||'') && (q.mode||'')===(p.mode||'')
        && (q.cheque||'')===(p.cheque||'') && (q.ref||'')===(p.ref||'');
    });
  }
  function recordPayTab(){
    if(recordPayTab._busy) return; /* double-click guard */
    const id=$('payb_loan').value; if(!id){ toast('Choose a borrower first'); return; }
    const l=loans.find(x=>x.id===id); if(!l){ toast('Loan not found'); return; }
    const amt=Number($('payb_amt').value)||0; if(amt<=0){ toast('Enter a payment amount'); return; }
    if(amt>1000000000){ toast('⚠ That payment amount looks too large — please check.'); return; }
    var _out=Number(l.outstanding)||0;
    if(_out>0 && amt>_out*1.5 && !confirm('This payment of '+inr(amt)+' is much larger than the outstanding balance of '+inr(_out)+' for '+l.name+'.\n\nRecord it anyway?')){ return; }
    const mode=$('payb_mode').value;
    const isInt=!!($('payb_intonly')&&$('payb_intonly').checked);
    const p={ pid:newPayId(), date:$('payb_date').value||todayISO(), mode, amount:amt,
      cheque: mode==='Cheque'?$('payb_cheqno').value.trim():'',
      bank: mode==='Cheque'?$('payb_bank').value.trim():'',
      ref: mode==='Online'?$('payb_ref').value.trim():'',
      status: mode==='Cheque'?$('payb_status').value:'Cleared' };
    if(isInt){ p.intOnly=true; p.type='Interest'; }   // services the month's interest; principal unchanged
    if(!Array.isArray(l.payments)) l.payments=[];
    if(isDuplicatePayment(l,p) && !confirm('A payment of '+inr(amt)+' ('+mode+') on '+fmtDate(p.date)+' is ALREADY recorded for '+l.name+'.\n\nRecord it again anyway?')){ toast('Duplicate payment not recorded'); return; }
    recordPayTab._busy=true; try{
    l.payments.push(p); recomputeLoan(l); save(); logAudit(p.mode==='Cheque'?'Cheque Entry Added':'Cash Entry Added', l.name+' \u2014 '+inr(p.amount)+(p.mode==='Cheque'?(' chq '+(p.cheque||'')+' ['+p.status+']'):''));
    $('payb_amt').value=''; $('payb_cheqno').value=''; $('payb_bank').value=''; if($('payb_ref'))$('payb_ref').value='';
    if($('payb_intonly')) $('payb_intonly').checked=false;
    renderPayReg(); refreshPayLoanDropdown();
    toast(isInt
      ? ('Interest-only payment recorded for '+l.name+' \u2014 due date moved forward, principal unchanged')
      : ('Payment recorded for '+l.name+(p.status==='Pending'?' (pending cheque \u2014 balance unchanged until cleared)':'')));
    // (Automatic WhatsApp receipt prompt removed \u2014 send receipts manually when needed.)
    } finally { setTimeout(function(){ recordPayTab._busy=false; }, 400); }
  }
  function payAllRows(){
    const rows=[];
    loans.forEach(l=>{ (l.payments||[]).forEach((p,idx)=>{ rows.push({loanId:l.id, idx, name:l.name, acno:l.acno, date:p.date, mode:p.mode, amount:Number(p.amount)||0, cheque:p.cheque||'', bank:p.bank||'', ref:p.ref||'', status:p.status, intOnly:!!(p.intOnly||p.type==='Interest')}); }); });
    rows.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    return rows;
  }
  function renderPayReg(){
    const q=($('payRegSearch')?$('payRegSearch').value:'').toLowerCase();
    const f=$('payRegFilter')?$('payRegFilter').value:'all';
    let rows=payAllRows();
    const clearedTot=rows.filter(r=>r.status==='Cleared').reduce((a,r)=>a+r.amount,0);
    const pendTot=rows.filter(r=>r.status==='Pending').reduce((a,r)=>a+r.amount,0);
    const cnt=rows.length;
    if(q) rows=rows.filter(r=>(r.name+' '+r.acno+' '+r.cheque+' '+r.bank).toLowerCase().includes(q));
    if(f==='Cash') rows=rows.filter(r=>r.mode==='Cash');
    else if(f==='Online') rows=rows.filter(r=>r.mode==='Online');
    else if(f==='Cheque') rows=rows.filter(r=>r.mode==='Cheque');
    else if(f==='Pending') rows=rows.filter(r=>r.status==='Pending');
    else if(f==='Cleared') rows=rows.filter(r=>r.status==='Cleared');
    const tiles=$('payTiles');
    if(tiles) tiles.innerHTML=`<div class="ptile ok"><span>Received (cleared)</span><b>${inr(clearedTot)}</b></div><div class="ptile warn"><span>Pending cheques</span><b>${inr(pendTot)}</b></div><div class="ptile"><span>Total entries</span><b>${cnt}</b></div>`;
    try{ updateRegCards(); }catch(e){}
    const body=$('payRegBody'); if(!body) return;
    if(!rows.length){ body.innerHTML=`<tr><td colspan="8"><div class="empty"><b>No payments recorded yet.</b><br>Use the form on the Payments tab to record a cash or cheque payment.</div></td></tr>`; return; }
    // Show the newest slice first and let the user pull in more — keeps the register
    // instant once there are thousands of entries. Any search/filter resets the window.
    const _total=rows.length;
    if(renderPayReg._key!==(q+'|'+f)){ renderPayReg._key=(q+'|'+f); renderPayReg._lim=200; }
    if(!renderPayReg._lim) renderPayReg._lim=200;
    const _more=Math.max(0,_total-renderPayReg._lim);
    rows=rows.slice(0,renderPayReg._lim);
    body.innerHTML=rows.map(r=>{
      const chq = r.mode==='Cheque' ? (esc(r.cheque||'\u2014')+(r.bank?(' / '+esc(r.bank)):'')) : (r.mode==='Online'?('Ref '+esc(r.ref||'\u2014')):'\u2014');
      const intTag = r.intOnly ? ' <span class="pp" style="background:#eef2ff;color:#4338ca;">Interest</span>' : '';
      const badge = (r.status==='Cleared'?'<span class="pp ok">Cleared</span>':'<span class="pp pend">Pending</span>')+intTag;
      const tog = r.mode==='Cheque' ? `<button class="lnk" onclick="payToggle('${r.loanId}',${r.idx})">${r.status==='Cleared'?'mark pending':'mark cleared'}</button>` : '';
      const chqNotice = r.mode==='Cheque' ? `<button class="lnk" style="color:#0b7a4b;" onclick="chequeNotice('${r.loanId}',${r.idx})">cheque notice</button>` : '';
      return `<tr><td>${fmtDate(r.date)||'\u2014'}</td><td><div class="name">${esc(r.name)}</div></td><td>${esc(r.acno)}</td><td>${esc(r.mode)}</td><td>${chq}</td><td class="right num">${inr(r.amount)}</td><td>${badge}</td><td><div class="rowact" style="gap:12px;"><button class="lnk" onclick="printPayReceipt('${r.loanId}',${r.idx})">receipt</button>${chqNotice}${tog}<button class="lnk del" onclick="payRemove('${r.loanId}',${r.idx})">remove</button></div></td></tr>`;
    }).join('')
      + (_more>0 ? `<tr class="reg-more"><td colspan="8"><button class="btn btn-sm btn-ghost" onclick="payRegMore()">Show ${Math.min(200,_more)} more &mdash; ${rows.length} of ${_total} shown</button></td></tr>` : '');
  }
  window.payRegMore=function(){ renderPayReg._lim=(renderPayReg._lim||200)+200; renderPayReg(); };
  /* ---- Registers open as their own full page, so the Payments tab stays uncluttered.
     The lists themselves (with their receipt / edit / remove actions) are unchanged — they
     simply render inside these sheets now. ---- */
  function updateRegCards(){
    try{
      var rows=(typeof payAllRows==='function')?payAllRows():[];
      var cl=rows.filter(function(r){return r.status==='Cleared';}).reduce(function(a,r){return a+r.amount;},0);
      var pd=rows.filter(function(r){return r.status==='Pending';}).reduce(function(a,r){return a+r.amount;},0);
      var s1=$('regCardPaySub');
      if(s1) s1.innerHTML=rows.length+' entr'+(rows.length===1?'y':'ies')+' &middot; '+inr(cl)+' received'+(pd>0?(' &middot; '+inr(pd)+' pending'):'');
      var cN=0,cT=0; loans.forEach(function(l){ (l.charges||[]).forEach(function(c){ cN++; cT+=Number(c&&c.amount)||0; }); });
      var s2=$('regCardChgSub');
      if(s2) s2.innerHTML=cN+' charge'+(cN===1?'':'s')+' &middot; '+inr(cT)+' total';
    }catch(e){}
  }
  window.updateRegCards=updateRegCards;
  window.openPayRegister=function(){ try{ renderPayReg(); }catch(e){} var o=$('payRegOverlay'); if(o) o.style.display='flex'; };
  window.closePayRegister=function(){ var o=$('payRegOverlay'); if(o) o.style.display='none'; updateRegCards(); };
  window.openChargeRegister=function(){ try{ renderChargeList(); }catch(e){} var o=$('chgRegOverlay'); if(o) o.style.display='flex'; };
  window.closeChargeRegister=function(){ var o=$('chgRegOverlay'); if(o) o.style.display='none'; updateRegCards(); };
  function payToggle(loanId, idx){
    const l=loans.find(x=>x.id===loanId); if(!l||!l.payments||!l.payments[idx]) return;
    const p=l.payments[idx]; if(p.mode!=='Cheque') return;
    p.status = (p.status==='Cleared')?'Pending':'Cleared';
    recomputeLoan(l); save(); logAudit('Cheque '+p.status, l.name+' \u2014 '+inr(p.amount)); renderPayReg(); refreshPayLoanDropdown();
  }
  function payRemove(loanId, idx){
    const l=loans.find(x=>x.id===loanId); if(!l||!l.payments||!l.payments[idx]) return;
    if(!confirm('Remove this payment entry? The borrower\u2019s balance will be recalculated.')) return;
    const _nm=l.name; l.payments.splice(idx,1); recomputeLoan(l); save(); logAudit('Payment Removed', _nm); renderPayReg(); refreshPayLoanDropdown();
  }
  function payReceiptHTML(l, p, idx){
    var refNo='RCP/'+(l.acno||'')+'/'+(idx+1);
    var modeLine=esc(p.mode||'\u2014');
    if(p.mode==='Cheque') modeLine+=' \u2014 Cheque No. '+esc(p.cheque||'\u2014')+(p.bank?(', '+esc(p.bank)):'');
    if(p.mode==='Online') modeLine+=' \u2014 Ref/UTR '+esc(p.ref||'\u2014');
    var cum=0; for(var i=0;i<=idx && i<(l.payments||[]).length;i++){ var q=l.payments[i]; if(q && q.status==='Cleared') cum+=Number(q.amount)||0; }
    var bal=Math.max(0,(Number(l.tpay)||0)-cum);
    var pending=(p.status!=='Cleared');
    /* reuse the same authorised-signature image the certificate / notices use, if one is set */
    var sigImg=''; try{ var _im=document.querySelector('#sec-cert .sigcol img'); var _src=_im&&_im.getAttribute('src'); if(_src) sigImg='<img src="'+_src+'" alt="signature" style="max-height:52px;max-width:170px;display:block;margin:8px auto 2px;">'; }catch(e){}
    var sigInner = sigImg
      ? '<div>For <b>Shivam Enterprises</b></div>'+sigImg+'<div class="ln" style="margin-top:2px;">Authorised Signatory</div>'
      : '<div>For <b>Shivam Enterprises</b></div><div class="ln">Authorised Signatory</div>';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Receipt \u2014 '+esc(l.name||'')+'</title><style>'+
      (typeof docBrandCSS==='function'?docBrandCSS():'')+
      'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141414;margin:32px;line-height:1.6;}'+
      '.name{font-size:24px;font-weight:bold;letter-spacing:1px;text-align:center;color:#0b1f4b;}'+
      '.addr{text-align:center;font-size:11px;color:#444;margin:4px 0 2px;}.rule{border-bottom:2px solid #c8a02a;margin:8px 0 18px;}'+
      'h2{text-align:center;font-size:16px;margin:14px 0;text-decoration:underline;letter-spacing:.5px;color:#0b1f4b;}'+
      '.refrow{display:flex;justify-content:space-between;font-size:12.5px;margin:14px 0 6px;}'+
      'table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px;}td{border:1px solid #bbb;padding:7px 11px;}td.k{width:44%;color:#0b1f4b;font-weight:600;background:#f7f7f7;}td.v{text-align:right;font-variant-numeric:tabular-nums;}'+
      '.note{font-size:11.5px;font-style:italic;color:#555;margin-top:10px;}'+
      '.sig{margin-top:52px;display:flex;justify-content:flex-end;}.sig div{text-align:center;font-size:12.5px;}.sig .ln{border-top:1px solid #444;padding-top:5px;margin-top:44px;min-width:210px;}'+
      '.foot{border-top:1px solid #c8a02a;margin-top:36px;padding-top:6px;text-align:center;font-size:11px;color:#555;font-style:italic;}'+
      '</style></head><body>'+
      (typeof docBrandHTML==='function'?docBrandHTML(true):'')+
      '<div class="name">'+esc(FIRM().name)+'</div>'+
      '<div class="addr">'+esc(FIRM().address)+' &nbsp;|&nbsp; Mobile: '+esc(FIRM().phones)+'</div>'+
      '<div class="addr">'+esc(firmRegLine())+'</div>'+
      '<div class="rule"></div>'+
      '<h2>PAYMENT RECEIPT</h2>'+
      '<div class="refrow"><div>Receipt No.: <b>'+esc(refNo)+'</b></div><div>Date: <b>'+(fmtDate(p.date)||'\u2014')+'</b></div></div>'+
      '<table>'+
      '<tr><td class="k">Received with thanks from</td><td>'+esc(l.name||'')+'</td></tr>'+
      '<tr><td class="k">Loan account no.</td><td>'+esc(l.acno||'')+'</td></tr>'+
      '<tr><td class="k">Mode of payment</td><td>'+modeLine+'</td></tr>'+
      '<tr><td class="k">Amount received</td><td class="v"><b>'+inr(Number(p.amount)||0)+'</b></td></tr>'+
      '<tr><td class="k">Balance outstanding after this payment</td><td class="v">'+inr(bal)+'</td></tr>'+
      '</table>'+
      (pending?'<div class="note">Note: This payment is by cheque and is subject to realisation. The balance above will update once the cheque clears.</div>':'')+
      '<div class="sig"><div>'+sigInner+'</div></div>'+
      '<div class="foot">This is a computer-generated receipt issued by Shivam Enterprises.</div>'+
      '</body></html>';
  }
  function printPayReceipt(loanId, idx){
    const l=loans.find(x=>x.id===loanId); if(!l||!l.payments||!l.payments[idx]){ toast('Payment entry not found'); return; }
    var html=payReceiptHTML(l, l.payments[idx], idx);
    var f=document.createElement('iframe'); f.style.position='fixed'; f.style.right='0'; f.style.bottom='0'; f.style.width='0'; f.style.height='0'; f.style.border='0'; document.body.appendChild(f);
    var doc=f.contentWindow.document; doc.open(); doc.write(html); doc.close();
    setTimeout(function(){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} setTimeout(function(){ f.remove(); },1500); },350);
    try{ logAudit('Receipt Printed', (l.name||'')+' \u2014 '+inr(Number(l.payments[idx].amount)||0)); }catch(_){}
  }
  function renderPayTab(){ refreshPayLoanDropdown(); if($('payb_date')&&!$('payb_date').value)$('payb_date').value=todayISO(); refreshChargeUI(); payTabModeUI(); renderPayReg(); }
  function refreshChargeUI(){ var sel=$('chg_loan'); if(sel){ var cur=sel.value; sel.innerHTML='<option value="">\u2014 Select a borrower \u2014</option>'+loans.map(function(l){return '<option value="'+l.id+'">'+esc(l.name)+' ('+esc(l.acno)+')</option>';}).join(''); sel.value=cur; } if($('chg_date')&&!$('chg_date').value)$('chg_date').value=todayISO(); if($('lateFeeRate')) $('lateFeeRate').value=getLateFeeRate(); if($('lateGraceDays')) $('lateGraceDays').value=getLateGraceDays(); if($('ovdIntRate')){ var _mi=getManualOvdInt(); $('ovdIntRate').value=_mi>0?_mi:''; } if($('ovdFromDate')) $('ovdFromDate').value=getOvdFrom(); renderChargeList(); try{ chgUpdateHint(); }catch(e){} }
  /* ---- Late-fee rate (₹ per overdue month) — persistent, default ₹500 ---- */
  function getLateFeeRate(){ try{ var raw=localStorage.getItem('shivam_latefee_v1'); if(raw==null||raw==='') return 500; var v=Number(raw); return (!isNaN(v) && v>=0)?v:500; }catch(e){ return 500; } }
  window.getLateFeeRate=getLateFeeRate;
  window.setLateFeeRate=function(v){ try{ localStorage.setItem('shivam_latefee_v1', String(Math.max(0,Math.round(Number(v)||0)))); }catch(e){} try{ chgUpdateHint(); }catch(e){} };
  /* Grace period (days) before a late-paid / unpaid installment attracts a late fee. Default 7. */
  function getLateGraceDays(){ try{ var raw=localStorage.getItem('shivam_lategrace_v1'); if(raw==null||raw==='') return 7; var v=Number(raw); return (!isNaN(v) && v>=0)?Math.round(v):7; }catch(e){ return 7; } }
  window.getLateGraceDays=getLateGraceDays;
  window.setLateGraceDays=function(v){ try{ localStorage.setItem('shivam_lategrace_v1', String(Math.max(0,Math.round(Number(v)||0)))); }catch(e){} try{ chgUpdateHint(); }catch(e){} };
  /* ---- Manual overdue-interest amount (₹ per fully-missed month) ----
     Blank/0 = work it out automatically from the loan (the fixed monthly byaj). If a figure is
     entered here, THAT exact amount is charged for every unpaid month instead. */
  function getManualOvdInt(){ try{ var raw=localStorage.getItem('shivam_ovdint_v1'); if(raw==null||raw==='') return 0; var v=Number(raw); return (!isNaN(v)&&v>0)?Math.round(v):0; }catch(e){ return 0; } }
  window.getManualOvdInt=getManualOvdInt;
  /* "Charge only from" — a cut-off date for the one-click overdue button. After entering years of
     handwritten history the app would otherwise be entitled to back-charge every missed month at
     once; this lets the lender say "start charging from here". Blank = no limit (previous behaviour). */
  function getOvdFrom(){ try{ var raw=localStorage.getItem('shivam_ovdfrom_v1'); return (raw&&/^\d{4}-\d{2}-\d{2}$/.test(raw))?raw:''; }catch(e){ return ''; } }
  window.getOvdFrom=getOvdFrom;
  window.setOvdFrom=function(v){
    var s=String(v==null?'':v).trim();
    try{
      if(!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)){ localStorage.removeItem('shivam_ovdfrom_v1'); s=''; }
      else localStorage.setItem('shivam_ovdfrom_v1', s);
    }catch(e){}
    try{ chgUpdateHint(); }catch(e){}
    if(typeof toast==='function') toast(s?('Overdue charges will start from '+s):'Overdue charges no longer limited by date');
  };
  window.setManualOvdInt=function(v){
    try{
      var n=Number(v);
      if(v===''||v==null||isNaN(n)||n<=0) localStorage.removeItem('shivam_ovdint_v1');
      else localStorage.setItem('shivam_ovdint_v1', String(Math.round(n)));
    }catch(e){}
    try{ chgUpdateHint(); }catch(e){}
  };
  function _lfAddDays(iso, days){ if(!iso) return iso; var p=String(iso).split('-'); var dt=new Date(+p[0], +p[1]-1, +p[2]); dt.setDate(dt.getDate()+(Number(days)||0)); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
  /* Installments that attract a late fee: an installment is LATE if it was not fully covered by
     cleared payments received on/before (its due date + grace days). This catches missed months,
     partially-paid months, AND months that were paid but after the due date (beyond grace). */
  /* Which EMI each CLEARED payment actually pays — matched by the MONTH the money was
     received, not just the running total. So a month the customer genuinely skipped stays
     unpaid even if later months were paid; a "catch-up" payment (more than one EMI in a
     month) overflows to the oldest still-unpaid EMI. Restructured loans keep the simple
     oldest-first waterfall (their pre-restructure payments are baselined out).
     Returns an array where index i (1..n) holds the amount allocated to EMI i. */
  function _ymKey(iso){ var m=String(iso||'').match(/^(\d{4})-(\d{2})/); return m?(m[1]+'-'+m[2]):null; }
  function emiPaidByIndex(l){
    var n=Math.max(0,Math.round(Number(l&&l.tenure)||0));
    var emi=Math.round(Number(l&&l.emi)||0);
    var total=(l&&l.baseOut!=null)?Math.max(0,Number(l.baseOut)):((Number(l&&l.tpay)>0)?Number(l.tpay):emi*n);
    var alloc=[]; for(var k=0;k<=n;k++) alloc[k]=0;
    if(!l || n<=0) return alloc;
    var _isInt=function(p){ return p && (p.intOnly===true || p.type==='Interest'); };  // interest-only payments don't cover EMIs
    var emiOf=function(i){ return (i<n)?emi:Math.max(0,total-emi*(n-1)); };
    var paidBase=Number(l.paidBase)||0;
    var clearedTot=Math.max(0,(l.payments||[]).filter(function(p){return p.status==='Cleared' && !_isInt(p);}).reduce(function(a,p){return a+(Number(p.amount)||0);},0)-paidBase);
    if(paidBase>0){ for(var w=1;w<=n;w++) alloc[w]=Math.max(0,Math.min(emiOf(w), clearedTot-emi*(w-1))); return alloc; }
    var keyToIdx={}; for(var i2=1;i2<=n;i2++){ var dk=_ymKey(emiDueDate(l,i2)); if(dk && keyToIdx[dk]==null) keyToIdx[dk]=i2; }
    var monthKeyOf=function(i){ return _ymKey(emiDueDate(l,i)); };
    // First installment whose due-month is on/after the payment's month. A payment dated AFTER
    // the last installment returns n+1 (→ not credited to any earlier row: it's an advance).
    var fwdStartFor=function(pk){ if(pk==null) return 1; for(var j=1;j<=n;j++){ var mk=monthKeyOf(j); if(mk && mk>=pk) return j; } return n+1; };
    var earliestUnfull=function(from){ for(var j=(from||1);j<=n;j++){ if(alloc[j] < emiOf(j)-0.001) return j; } return 0; };
    var pays=(l.payments||[]).filter(function(p){return p.status==='Cleared' && !_isInt(p) && (Number(p.amount)||0)>0;})
      .map(function(p){return {date:p.date||'', amt:Number(p.amount)||0};})
      .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
    pays.forEach(function(p){
      var remaining=p.amt, pk=_ymKey(p.date), target=(pk!=null)?keyToIdx[pk]:null;
      if(target!=null && alloc[target] < emiOf(target)-0.001){ var room=emiOf(target)-alloc[target], put=Math.min(room,remaining); alloc[target]+=put; remaining-=put; }
      // Any surplus spills FORWARD only (to later unpaid installments) — a payment never
      // back-fills an EARLIER month, and a payment made after the last installment is left as
      // an advance (not merged into past-due rows).
      var startIdx=(target!=null)?target:fwdStartFor(pk);
      while(remaining>0.001 && startIdx<=n){ var e=earliestUnfull(startIdx); if(!e) break; var room2=emiOf(e)-alloc[e], put2=Math.min(room2,remaining); alloc[e]+=put2; remaining-=put2; }
    });
    return alloc;
  }
  window.emiPaidByIndex=emiPaidByIndex;
  function overdueEmiIdxs(l){
    if(!l) return [];
    var n=Math.max(0,Math.round(Number(l.tenure)||0)), emi=Math.round(Number(l.emi)||0), t=todayISO();
    var total=(l.baseOut!=null)?Math.max(0,Number(l.baseOut)):((Number(l.tpay)>0)?Number(l.tpay):emi*n);
    var grace=getLateGraceDays(), paidBase=Number(l.paidBase)||0;
    // Does the loan still owe money today? If so, the schedule keeps running PAST the tenure and
    // every unpaid month after it is also a late month — so late fees keep accruing until repaid.
    var clearedNI=Math.max(0,(l.payments||[]).filter(function(p){return p&&p.status==='Cleared'&&!(p.intOnly||p.type==='Interest');}).reduce(function(a,p){return a+(Number(p.amount)||0);},0)-paidBase);
    var stillOwes=(total-clearedNI)>0.5;
    // Effective number of months to examine: the tenure, extended month-by-month up to TODAY while
    // the loan is still unpaid (so overdue months after the tenure are detected too).
    var nEff=n;
    if(stillOwes && n>0){ for(var mm=n+1; mm-n<=240; mm++){ var dmm=emiDueDate(l,mm); if(!dmm) break; if(_lfAddDays(dmm,grace)>t) break; nEff=mm; } }
    var emiOf=function(i){ return (i<n)?emi:(i===n?Math.max(0,total-emi*(n-1)):emi); };  // extension months expect a full catch-up EMI
    // Restructured loans reset the schedule baseline — keep the simple rule there.
    if(paidBase>0){
      var a=emiPaidByIndex(l), o=[]; for(var i0=1;i0<=n;i0++){ var d0=emiDueDate(l,i0); if(d0 && d0<t && a[i0]<emiOf(i0)-0.001) o.push({i:i0,due:d0}); } return o;
    }
    // Date-aware allocation (same forward-spill as emiPaidByIndex) that also records the DATE
    // each installment became fully covered, so we can tell if it was covered on time.
    var alloc=[], cover=[]; for(var k=0;k<=nEff;k++){ alloc[k]=0; cover[k]=null; }
    var keyToIdx={}; for(var i2=1;i2<=nEff;i2++){ var dk=_ymKey(emiDueDate(l,i2)); if(dk && keyToIdx[dk]==null) keyToIdx[dk]=i2; }
    var monthKeyOf=function(i){ return _ymKey(emiDueDate(l,i)); };
    var fwdStartFor=function(pk){ if(pk==null) return 1; for(var j=1;j<=nEff;j++){ var mk=monthKeyOf(j); if(mk && mk>=pk) return j; } return nEff+1; };
    var earliestUnfull=function(from){ for(var j=(from||1);j<=nEff;j++){ if(alloc[j] < emiOf(j)-0.001) return j; } return 0; };
    var pays=(l.payments||[]).filter(function(p){ return p && p.status==='Cleared' && !(p.intOnly||p.type==='Interest') && (Number(p.amount)||0)>0; })
      .map(function(p){ return {date:String(p.date||''), amt:Number(p.amount)||0}; })
      .sort(function(a,b){ return a.date.localeCompare(b.date); });
    pays.forEach(function(p){
      var remaining=p.amt, pk=_ymKey(p.date), target=(pk!=null?keyToIdx[pk]:null);
      var fill=function(j){ if(j && alloc[j] < emiOf(j)-0.001){ var put=Math.min(emiOf(j)-alloc[j], remaining); alloc[j]+=put; remaining-=put; if(alloc[j] >= emiOf(j)-0.5 && !cover[j]) cover[j]=p.date; } };
      if(target!=null) fill(target);
      var start=(target!=null)?target:fwdStartFor(pk);   // forward-only; after-last payment is an advance
      while(remaining>0.5 && start<=nEff){ var e=earliestUnfull(start); if(!e) break; fill(e); }
    });
    // Months serviced by an INTEREST-ONLY (byaj) payment are NOT late — the customer paid that
    // month's interest and the EMI simply defers. Never charge a late fee or overdue interest there.
    var intMonths={};
    (l.payments||[]).forEach(function(p){ if(p && p.status==='Cleared' && (p.intOnly||p.type==='Interest') && (Number(p.amount)||0)>0){ var k=_ymKey(p.date); if(k) intMonths[k]=true; } });
    var out=[];
    for(var i=1;i<=nEff;i++){
      var d=emiDueDate(l,i); if(!d) continue;
      if(intMonths[_ymKey(d)]) continue;                  // interest serviced this month → not late
      var deadline=_lfAddDays(d, grace);
      if(deadline>t) continue;                            // grace window not elapsed yet — not late
      // late if never fully covered (missed/partial) OR only covered after the grace deadline
      if(!cover[i] || cover[i] > deadline) out.push({i:i, due:d, ext:(i>n)});
    }
    return out;
  }
  window.overdueEmiIdxs=overdueEmiIdxs;
  function chgTypeChange(){ var t=($('chg_type')||{}).value; var row=$('chg_chequeRow')||$('chg_chequeWrap'); if(row) row.style.display=(t==='Cheque bounce')?'flex':'none'; chgUpdateHint(); }
  function chgUpdateHint(){
    if($('lateFeeRate') && document.activeElement!==$('lateFeeRate')) $('lateFeeRate').value=getLateFeeRate();
    var hint=$('lateFeeHint'); if(!hint) return;
    var l=loans.find(function(x){return x.id===(($('chg_loan')||{}).value);});
    if(!l){ hint.textContent=''; return; }
    var idxs=overdueEmiIdxs(l), rate=getLateFeeRate();
    var _from=(typeof getOvdFrom==='function')?getOvdFrom():'', _skip=0;
    if(_from){ var _all=idxs.length; idxs=idxs.filter(function(o){ return String(o.due||'')>=_from; }); _skip=_all-idxs.length; }
    var already=(l.charges||[]).filter(function(c){return c&&c.type==='Late fee'&&c.emiIdx;}).length;
    var pending=Math.max(0, idxs.length-already);
    var _mi=(typeof getManualOvdInt==='function')?getManualOvdInt():0;
    var _iAmt=(_mi>0)?_mi:((typeof overdueMonthlyInterest==='function')?overdueMonthlyInterest(l):0);
    var _iTxt=_iAmt>0?(' · interest '+inr(_iAmt)+'/unpaid month'+(_mi>0?' (manual)':' (auto)')):'';
    var _skipTxt=_skip?(' · <b>'+_skip+' earlier month(s) skipped</b> (charging only from '+esc(_from)+')'):'';
    hint.innerHTML = idxs.length ? (esc(l.name)+' is '+idxs.length+' month(s) overdue · '+(pending>0?('<b>'+pending+' late fee(s) pending = '+inr(rate*pending)+'</b>'):'late fees up to date')+_iTxt+_skipTxt)
                                 : (esc(l.name)+(_skip?(' has no overdue EMIs on or after '+esc(_from)+_skipTxt):' has no overdue EMIs.'));
    if(($('chg_type')||{}).value==='Late fee' && $('chg_amt') && !$('chg_amt').value && pending>0){ $('chg_amt').value = rate*pending; }
  }
  window.chgLoanChange=function(){ if($('chg_amt')) $('chg_amt').value=''; chgUpdateHint(); };

  /* Interest-only loans: record the principal being returned (in full, or the remaining
     part) as a kind:'principal' payment — this reduces the balance and, once the whole
     principal is back, closes the loan. Regular interest payments stay untouched. */
  window.settlePrincipal=function(id){
    var l=loans.find(function(x){return x.id===id;}); if(!l){ toast('Loan not found'); return false; }
    if(!l.interestOnly){ toast('This is not an interest-only loan.'); return false; }
    if(!Array.isArray(l.payments)) l.payments=[];
    var P=Math.max(0, Number(l.principal)||0);
    var principalPaid=l.payments.filter(function(p){return p.status==='Cleared' && p.kind==='principal';}).reduce(function(a,p){return a+(Number(p.amount)||0);},0);
    var remaining=Math.max(0, P-principalPaid);
    if(remaining<=0){ toast('The principal has already been returned — this loan is closed.'); return false; }
    if(!confirm('Record the principal returned for '+(l.name||'')+' (A/C '+(l.acno||'')+')?\n\nPrincipal being returned: Rs '+remaining.toLocaleString('en-IN')+'\n\nThe loan will be marked CLOSED.')) return false;
    l.payments.push({ date:todayISO(), mode:'Cash', amount:remaining, status:'Cleared', cheque:'', bank:'', ref:'', kind:'principal', note:'Principal returned' });
    try{ recomputeLoan(l); }catch(e){}
    save();
    try{ logAudit('Principal Returned', (l.name||'')+' ('+(l.acno||'')+') — Rs '+remaining.toLocaleString('en-IN')); }catch(e){}
    try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}
    try{ if(typeof renderPayReg==='function') renderPayReg(); }catch(e){}
    try{ if(typeof renderDash==='function') renderDash(); }catch(e){}
    toast('✓ Principal returned (Rs '+remaining.toLocaleString('en-IN')+') — loan closed', 6000);
    return true;
  };

  /* ---------- Foreclosure (early settlement) ----------
     The borrower clears the loan early: the interest on the UNPAID months is waived, so
     they pay only the remaining PRINCIPAL (plus any unpaid charges and an optional manual
     foreclosure charge). Allowed only once at least 6 EMIs have actually been paid.
     Implemented by lowering the loan's total-payable to (paid + remaining
     principal) — which removes the future interest — then recording the settlement
     payment so the loan closes with a zero balance. */
  function _foreclosePreview(l){
    var tpay0=Number(l.tpay)||0, principal=Number(l.principal)||0, emi=Math.round(Number(l.emi)||0);
    var cleared0=(Array.isArray(l.payments)?l.payments:[]).filter(function(p){return p.status==='Cleared';}).reduce(function(a,p){return a+(Number(p.amount)||0);},0);
    var remainingAll=Math.max(0, tpay0-cleared0);
    var remainingPrincipal=Math.round(principal*(tpay0>0?(tpay0-cleared0)/tpay0:0));
    if(remainingPrincipal>remainingAll) remainingPrincipal=remainingAll;
    var interestWaived=Math.max(0, remainingAll-remainingPrincipal);
    var feesNow=(Array.isArray(l.charges)?l.charges:[]).reduce(function(a,c){return a+(c?(Number(c.amount)||0):0);},0);
    var emisPaid=emi>0?Math.floor((cleared0+1)/emi):0;
    var monthsElapsed=0; try{ var disb=l.disb||l.baseDate; if(disb){ var d0=new Date(disb+'T00:00:00'), dn=new Date(todayISO()+'T00:00:00'); monthsElapsed=(dn.getFullYear()-d0.getFullYear())*12+(dn.getMonth()-d0.getMonth()); } }catch(e){}
    return { tpay0:tpay0, cleared0:cleared0, remainingAll:remainingAll, remainingPrincipal:remainingPrincipal,
             interestWaived:interestWaived, feesNow:feesNow, emisPaid:emisPaid, monthsElapsed:monthsElapsed };
  }
  // Opens the in-app foreclosure dialog (Electron has no window.prompt). Returns true if
  // the dialog opened, false if the loan is ineligible/ already settled.
  window.forecloseLoan=function(id){
    var l=loans.find(function(x){return x.id===id;}); if(!l){ toast('Loan not found'); return false; }
    if((Number(l.tpay)||0)<=0){ toast('This loan has no payable amount to foreclose.'); return false; }
    if(!Array.isArray(l.payments)) l.payments=[];
    var pv=_foreclosePreview(l);
    if(pv.remainingAll<=0){ toast('This loan is already fully paid / closed.'); return false; }
    if(pv.emisPaid<6){
      toast('⚠ Foreclosure is allowed only after at least 6 EMIs have been paid — this loan has '+pv.emisPaid+' EMI(s) paid.', 7000); return false;
    }
    window._fcPreview={ id:id, cleared0:pv.cleared0, remainingPrincipal:pv.remainingPrincipal, feesNow:pv.feesNow, interestWaived:pv.interestWaived };
    if($('fcWho')) $('fcWho').textContent=(l.name||'')+' — A/C '+(l.acno||'');
    if($('fcPrin')) $('fcPrin').textContent=inr(pv.remainingPrincipal);
    if($('fcWaived')) $('fcWaived').textContent=inr(pv.interestWaived);
    if($('fcFeesRow')) $('fcFeesRow').style.display=pv.feesNow>0?'flex':'none';
    if($('fcFees')) $('fcFees').textContent=inr(pv.feesNow);
    if($('fcCharge')) $('fcCharge').value='0';
    if($('fcMode')) $('fcMode').value='Cash';
    if($('fcDate')) $('fcDate').value=todayISO();
    fcUpdateTotal();
    if($('fcOverlay')) $('fcOverlay').classList.add('show');
    return true;
  };
  window.fcUpdateTotal=function(){
    var pv=window._fcPreview||{}; var charge=Math.max(0, Math.round(Number(($('fcCharge')||{}).value)||0));
    var total=(Number(pv.remainingPrincipal)||0)+(Number(pv.feesNow)||0)+charge;
    if($('fcTotal')) $('fcTotal').value=inr(total);
  };
  window.closeForeclose=function(){ if($('fcOverlay')) $('fcOverlay').classList.remove('show'); };
  window.confirmForeclose=function(){
    var pv=window._fcPreview; if(!pv){ window.closeForeclose(); return; }
    var l=loans.find(function(x){return x.id===pv.id;}); if(!l){ window.closeForeclose(); return; }
    var charge=Math.max(0, Math.round(Number(($('fcCharge')||{}).value)||0));
    var mode=(($('fcMode')||{}).value)||'Cash';
    var date=(($('fcDate')||{}).value)||todayISO();
    var settlement=(Number(pv.remainingPrincipal)||0)+(Number(pv.feesNow)||0)+charge;
    l.tpay=(Number(pv.cleared0)||0)+(Number(pv.remainingPrincipal)||0);   // waive future interest
    l.baseOut=null; l.paidBase=0;
    if(!Array.isArray(l.charges)) l.charges=[];
    if(charge>0){ l.charges.unshift({ id:'C'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), date:date, type:'Foreclosure charge', amount:charge, note:'Foreclosure charge' }); }
    if(!Array.isArray(l.payments)) l.payments=[];
    l.payments.push({ date:date, mode:mode, amount:settlement, status:'Cleared', cheque:'', bank:'', ref:(mode==='Online'?'Foreclosure':''), note:'Foreclosure settlement', foreclosure:true });
    l.foreclosed=true; l.foreclosedAt=date; l.interestWaived=(Number(l.interestWaived)||0)+(Number(pv.interestWaived)||0);
    try{ recomputeLoan(l); }catch(e){}
    save();
    try{ logAudit('Loan Foreclosed', (l.name||'')+' ('+(l.acno||'')+') — settled Rs '+settlement.toLocaleString('en-IN')+', interest waived Rs '+(Number(pv.interestWaived)||0).toLocaleString('en-IN')+(charge>0?(', charge Rs '+charge.toLocaleString('en-IN')):'')); }catch(e){}
    window._fcPreview=null;
    window.closeForeclose();
    try{ if(typeof closeLoan==='function') closeLoan(); }catch(e){}
    try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}
    try{ if(typeof renderPayReg==='function') renderPayReg(); }catch(e){}
    try{ if(typeof renderChargeList==='function') renderChargeList(); }catch(e){}
    try{ if(typeof renderDash==='function') renderDash(); }catch(e){}
    toast('✓ Loan foreclosed — settled '+inr(settlement)+', '+inr(Number(pv.interestWaived)||0)+' interest waived', 6000);
  };
  /* The loan's FIXED (flat) monthly interest — the "original interest amount" baked into every EMI.
     Same every month; does NOT reduce as the principal is repaid (flat rate, not reducing balance).
     e.g. ₹50,000 @ 2.5% = ₹1,250/month. Used to charge interest on a fully-unpaid overdue month.
     Derived from the loan's own booked interest (total interest ÷ tenure) so it always matches the
     EMI; falls back to principal × monthly rate when the total interest isn't stored. */
  function overdueMonthlyInterest(l){
    if(!l) return 0;
    var tint=Number(l.tint)||0, ten=Math.max(1,Math.round(Number(l.tenure)||0));
    if(tint>0 && ten>0) return Math.round(tint/ten);
    var P=Number(l.principal)||0, rate=Number(l.rate)||0;
    return Math.round(P*rate/100);
  }
  window.overdueMonthlyInterest=overdueMonthlyInterest;
  /* Amount actually received (cleared, principal-bearing) IN a given installment's own month. */
  function _monthPaidInEmiMonth(l, i){
    var mk=_ymKey(emiDueDate(l,i)); if(!mk) return 0;
    return (l.payments||[]).filter(function(p){ return p && p.status==='Cleared' && !(p.intOnly||p.type==='Interest') && _ymKey(p.date)===mk; })
      .reduce(function(a,p){ return a+(Number(p.amount)||0); }, 0);
  }
  /* One-click: for every overdue month, apply a ₹rate late fee; AND for months where NOTHING was
     paid, also apply that month's interest (byaj on the outstanding principal). Keyed by EMI number
     + type so repeated clicks never double-charge. All are ordinary, removable/editable charges. */
  window.applyLateFees=function(id){
    var l=loans.find(function(x){return x.id===id;}); if(!l){ toast('Choose a borrower first'); return; }
    var rate=getLateFeeRate();
    // A figure typed into the "Overdue interest ₹/month" box wins — that exact amount is charged
    // for every fully-missed month. Left blank, we work it out from the loan automatically.
    var manualInt=(typeof getManualOvdInt==='function')?getManualOvdInt():0;
    var monthInt=(manualInt>0)?manualInt:overdueMonthlyInterest(l);
    if(rate<=0 && monthInt<=0){ toast('Set a late-fee rate and/or an overdue-interest amount first.'); return; }
    if(!Array.isArray(l.charges)) l.charges=[];
    var idxs=overdueEmiIdxs(l), addedFee=0, addedInt=0;
    // Honour the "Charge only from" cut-off: months whose due date falls before it are left alone.
    var _from=(typeof getOvdFrom==='function')?getOvdFrom():'', _skipped=0;
    if(_from){ idxs=idxs.filter(function(o){ var keep=String(o.due||'')>=_from; if(!keep) _skipped++; return keep; }); }
    var _noteInt=(manualInt>0)?' (manual)':'';
    idxs.forEach(function(o){
      if(rate>0){ var hasFee=l.charges.some(function(c){return c&&c.type==='Late fee'&&c.emiIdx===o.i;}); if(!hasFee){ l.charges.unshift({ id:'C'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), date:o.due, type:'Late fee', amount:rate, emiIdx:o.i, note:'Late fee — EMI #'+o.i+' overdue' }); addedFee++; } }
      // interest only for FULLY-MISSED months (nothing paid that month)
      if(monthInt>0 && _monthPaidInEmiMonth(l,o.i)<=0.5){ var hasInt=l.charges.some(function(c){return c&&c.type==='Overdue interest'&&c.emiIdx===o.i;}); if(!hasInt){ l.charges.unshift({ id:'C'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), date:o.due, type:'Overdue interest', amount:monthInt, emiIdx:o.i, note:'Interest — EMI #'+o.i+' (month unpaid)'+_noteInt }); addedInt++; } }
    });
    if(addedFee||addedInt){ try{ recomputeLoan(l); }catch(e){} save(); try{ logAudit('Overdue Charges Applied', addedFee+' late fee(s), '+addedInt+' interest — '+(l.name||'')+' ('+(l.acno||'')+')'); }catch(e){} renderChargeList(); chgUpdateHint(); try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){} toast('Applied '+addedFee+' late fee(s)'+(addedInt?(' + '+addedInt+' interest charge(s)'):'')+(_skipped?(' — '+_skipped+' month(s) before '+_from+' skipped'):'')); }
    else if(_skipped){ toast(_skipped+' overdue month(s) fall before '+_from+' and were skipped. Clear "Charge only from" to include them.', 6000); }
    else { toast('Overdue charges already up to date for '+(l.name||'this borrower')); }
  };
  window.applyLateFeesSelected=function(){ applyLateFees(($('chg_loan')||{}).value); };
  /* One-click undo: remove ALL late-fee charges for the selected borrower (individual
     charges can still be deleted from the list below). Recomputes so the outstanding,
     schedule, reminders and reports drop the fees immediately. */
  window.waiveLateFees=function(id){
    var l=loans.find(function(x){return x.id===id;}); if(!l){ toast('Choose a borrower first'); return; }
    var late=(l.charges||[]).filter(function(c){return c&&(c.type==='Late fee'||c.type==='Overdue interest');});
    if(!late.length){ toast('No overdue charges to remove for '+(l.name||'this borrower')+'.'); return; }
    var tot=late.reduce(function(a,c){return a+(Number(c.amount)||0);},0);
    if(!confirm('Remove all '+late.length+' overdue charge(s) ('+inr(tot)+' — late fees & interest) for '+(l.name||'')+'?\n\nThis clears them from the outstanding, schedule, reminders and reports.')) return;
    l.charges=(l.charges||[]).filter(function(c){return !(c&&(c.type==='Late fee'||c.type==='Overdue interest'));});
    try{ recomputeLoan(l); }catch(e){} save();
    try{ logAudit('Overdue Charges Removed', late.length+' charge(s) ('+inr(tot)+') — '+(l.name||'')+' ('+(l.acno||'')+')'); }catch(e){}
    renderChargeList(); chgUpdateHint(); try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}
    toast(late.length+' overdue charge(s) removed');
  };
  window.waiveLateFeesSelected=function(){ waiveLateFees(($('chg_loan')||{}).value); };
  var _editCharge=null;
  function recordCharge(){
    var id=($('chg_loan')||{}).value; if(!id){ toast('Choose a borrower first'); return; }
    var l=loans.find(function(x){return x.id===id;}); if(!l){ toast('Loan not found'); return; }
    var amt=Number(($('chg_amt')||{}).value)||0; if(amt<=0){ toast('Enter a charge amount'); return; }
    var type=($('chg_type')||{}).value||'Other';
    var cheque=(type==='Cheque bounce'?(($('chg_cheque')||{}).value||'').trim():'');
    var note=(($('chg_note')||{}).value||'').trim();
    var date=($('chg_date')||{}).value||todayISO();
    // EDIT MODE: update an existing charge instead of adding
    if(_editCharge){
      var el=loans.find(function(x){return x.id===_editCharge.loanId;});
      var ec=el&&(el.charges||[]).find(function(x){return x.id===_editCharge.chargeId;});
      if(ec){
        ec.date=date; ec.type=type; ec.amount=amt; ec.cheque=cheque; ec.note=note;
        if(el.id!==l.id){ el.charges=el.charges.filter(function(x){return x.id!==ec.id;}); if(!Array.isArray(l.charges)) l.charges=[]; l.charges.unshift(ec); }
        try{ recomputeLoan(l); if(el&&el.id!==l.id) recomputeLoan(el); }catch(e){}
        save();
        logAudit('Charge Edited', type+' '+inr(amt)+' \u2014 '+(l.name||'')+' ('+(l.acno||'')+')');
        _editCharge=null; clearChargeForm();
        renderChargeList(); try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}
        toast('Charge updated \u2014 balance & schedule updated');
        return;
      }
      _editCharge=null;
    }
    var charge={ id:'C'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), date:date, type:type, amount:amt, cheque:cheque, note:note };
    if(!Array.isArray(l.charges)) l.charges=[];
    l.charges.unshift(charge);
    try{ recomputeLoan(l); }catch(e){}
    save();
    logAudit('Charge Recorded', type+' '+inr(amt)+' \u2014 '+(l.name||'')+' ('+(l.acno||'')+')'+(charge.cheque?(' cheque '+charge.cheque):''));
    clearChargeForm();
    renderChargeList(); try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}
    toast(type+' of '+inr(amt)+' recorded \u2014 added to balance & schedule');
  }
  function clearChargeForm(){
    if($('chg_amt'))$('chg_amt').value=''; if($('chg_cheque'))$('chg_cheque').value=''; if($('chg_note'))$('chg_note').value='';
    var btn=$('chgRecordBtn'); if(btn) btn.innerHTML='\uFF0B Record charge';
  }
  function waBounce(l, charge){
    var p=String(l.phone||'').replace(/\D/g,''); if(p.length===10) p='91'+p; else if(p.length===11&&p[0]==='0') p='91'+p.slice(1);
    if(!p){ toast('No phone number on this loan'); return; }
    var msg='Namaste '+(l.name||'')+', we wish to inform you that your cheque'+(charge.cheque?(' no. '+charge.cheque):'')+' towards loan account '+(l.acno||'')+' has been returned/bounced by the bank. A charge of '+inr(charge.amount)+' is applicable. Kindly arrange the payment at the earliest.\n\n\u2014 Shivam Enterprises';
    window.open('https://wa.me/'+p+'?text='+encodeURIComponent(msg), '_blank');
    toast('WhatsApp opened to notify the customer');
  }
  function renderChargeList(){
    var host=$('chgList'); if(!host) return;
    var rows=[];
    loans.forEach(function(l){ (l.charges||[]).forEach(function(c){ if(!c.id) c.id='C'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); rows.push({loanId:l.id, name:l.name, acno:l.acno, c:c}); }); });
    rows.sort(function(a,b){ return (b.c.date||'').localeCompare(a.c.date||''); });
    try{ updateRegCards(); }catch(e){}
    if(!rows.length){ host.innerHTML='<div class="chg-list-h">Recorded charges</div><p style="color:var(--muted);font-size:13px;margin:4px 2px;">No charges recorded yet.</p>'; return; }
    var total=rows.reduce(function(a,r){return a+(Number(r.c.amount)||0);},0);
    var badgeClass=function(t){ return t==='Cheque bounce'?'cbounce':(t==='Late fee'?'clate':(t==='Overdue interest'?'cint':'cother')); };
    var body=rows.map(function(r){
      var meta=[]; if(r.c.cheque) meta.push('chq '+esc(r.c.cheque)); if(r.c.note) meta.push(esc(r.c.note));
      return '<tr>'
        +'<td><span class="chg-badge '+badgeClass(r.c.type)+'">'+esc(r.c.type)+'</span></td>'
        +'<td><div class="name">'+esc(r.name||'')+'</div><div class="chg-sub">'+esc(r.acno||'')+(meta.length?(' &middot; '+meta.join(' &middot; ')):'')+'</div></td>'
        +'<td class="right num">'+inr(r.c.amount)+'</td>'
        +'<td class="chg-date">'+fmtDate(r.c.date)+'</td>'
        +'<td class="right"><div class="rowact" style="gap:12px;justify-content:flex-end;"><button class="lnk" onclick="editCharge(\''+r.loanId+'\',\''+r.c.id+'\')">edit</button><button class="lnk del" onclick="deleteCharge(\''+r.loanId+'\',\''+r.c.id+'\')">delete</button></div></td>'
        +'</tr>';
    }).join('');
    host.innerHTML='<div class="chg-list-h">Recorded charges <span class="chg-list-sum">'+rows.length+' &middot; '+inr(total)+' total</span></div>'
      +'<div class="reg-wrap" style="max-height:460px;overflow:auto;"><table class="data reg-table chg-table"><thead><tr><th>Type</th><th>Borrower</th><th class="right">Amount</th><th>Date</th><th class="right">Actions</th></tr></thead><tbody>'+body+'</tbody></table></div>';
  }
  function deleteCharge(loanId, chargeId){
    var l=loans.find(function(x){return x.id===loanId;}); if(!l||!Array.isArray(l.charges)) return;
    var c=l.charges.find(function(x){return x.id===chargeId;}); if(!c) return;
    if(!confirm('Delete this '+(c.type||'charge')+' of '+inr(c.amount)+' for '+(l.name||'')+'?')) return;
    l.charges=l.charges.filter(function(x){return x.id!==chargeId;});
    try{ recomputeLoan(l); }catch(e){}
    save();
    logAudit('Charge Deleted', (c.type||'')+' '+inr(c.amount)+' \u2014 '+(l.name||'')+' ('+(l.acno||'')+')');
    if(_editCharge&&_editCharge.chargeId===chargeId){ _editCharge=null; clearChargeForm(); }
    renderChargeList(); try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}
    toast('Charge deleted \u2014 balance & schedule updated');
  }
  function editCharge(loanId, chargeId){
    var l=loans.find(function(x){return x.id===loanId;}); if(!l) return;
    var c=(l.charges||[]).find(function(x){return x.id===chargeId;}); if(!c) return;
    _editCharge={loanId:loanId, chargeId:chargeId};
    if($('chg_loan'))$('chg_loan').value=loanId;
    if($('chg_type'))$('chg_type').value=c.type||'Late fee';
    chgTypeChange();
    if($('chg_amt'))$('chg_amt').value=c.amount||'';
    if($('chg_date'))$('chg_date').value=c.date||todayISO();
    if($('chg_cheque'))$('chg_cheque').value=c.cheque||'';
    if($('chg_note'))$('chg_note').value=c.note||'';
    var btn=$('chgRecordBtn'); if(btn) btn.innerHTML='\u2713 Update charge';
    if($('chg_loan'))$('chg_loan').scrollIntoView({behavior:'smooth',block:'center'});
    toast('Editing charge \u2014 change values, then click Update');
  }
  window.editCharge=editCharge; window.deleteCharge=deleteCharge;
  window.chgTypeChange=chgTypeChange; window.recordCharge=recordCharge;
  function refreshLoanDropdown(){
    const sel=$('loadLoan'); const cur=sel.value;
    sel.innerHTML='<option value="">— Select a borrower —</option>'+loans.map(l=>`<option value="${l.id}">${esc(l.name)} (${esc(l.acno)})</option>`).join('');
    sel.value=cur;
  }
  function loadFromLoan(){
    const id=$('loadLoan').value; if(!id) return;
    const l=loans.find(x=>x.id===id); if(!l) return;
    $('f_name').value=l.name||''; $('f_reltype').value=l.reltype||'son of'; $('f_relname').value=l.relname||'';
    $('f_addr').value=l.addr||''; $('f_loan').value=(l.type||'Personal').toLowerCase()+' loan';
    $('f_ref').value=l.acno||'';
    if($('f_amount')) $('f_amount').value=(Number(l.principal)||0)||'';
    if($('f_secured')) $('f_secured').value=l.secured?'yes':'no';
    updateCert();
    toast('Details loaded from '+l.name);
  }
  function certFromLoan(id){ go('cert'); refreshLoanDropdown(); $('loadLoan').value=id; loadFromLoan(); }
  function loanCap(v){ return v?v.charAt(0).toUpperCase()+v.slice(1):''; }
  /* Title-case each word (English only) so the loan type reads "Personal Loan", not
     "personal loan". Devanagari has no ASCII word chars, so Hindi is left untouched. */
  function loanTitle(v){ return String(v||'').replace(/\b[a-z]/g, function(c){ return c.toUpperCase(); }); }
  function _clLoan(v){ if(window._certLang!=='hi') return v; return v==='personal loan'?'व्यक्तिगत ऋण':(v==='housing loan'?'आवास ऋण':(v==='product loan'?'उत्पाद ऋण':v)); }
  function _clMode(v){ if(window._certLang!=='hi') return v; return v==='Cash'?'नकद':(v==='Cheque'?'चेक':v); }
  function _clRel(t){ if(window._certLang!=='hi') return t; return t==='son of'?'पुत्र':(t==='daughter of'?'पुत्री':(t==='wife of'?'पत्नी':t)); }
  function updateCert(){
    applyFirmToDocs();
    const name=$('f_name').value.trim(), relt=$('f_reltype').value, relname=$('f_relname').value.trim();
    const addr=$('f_addr').value.trim(), loan=loanTitle(_clLoan($('f_loan').value)), mode=_clMode($('f_mode').value);
    const ref=$('f_ref').value.trim(), date=fmtDate($('f_date').value);
    const hi=(window._certLang==='hi');
    $('c_ref').textContent=ref||"______"; $('c_ref2').textContent=ref||"______"; $('c_date').textContent=date||"______";
    $('c_name').textContent=name||dash; $('c_addr').textContent=addr||dash; $('c_loan').textContent=loan; $('c_mode').textContent=mode;
    if($('c_rel')) $('c_rel').innerHTML=relname?(", "+esc(_clRel(relt))+' <span class="fillv">'+esc(relname)+'</span>'):"";
    $('c_t_name').textContent=name||"—"; $('c_t_addr').textContent=addr||"—"; $('c_t_mode').textContent=mode;
    $('r_ref').textContent=ref||"______"; $('r_date').textContent=date||"______";
    $('r_name').textContent=name||dash;
    if($('r_rel')) $('r_rel').innerHTML=relname?(esc(_clRel(relt))+' <span class="fillv">'+esc(relname)+'</span>'):(esc(_clRel(relt))+" "+dash);
    $('r_addr').textContent=addr||dash; $('r_loan').textContent=loan;
    $('r_t_name').textContent=name||"—"; $('r_t_addr').textContent=addr||"—"; $('r_t_loan').textContent=loan;
    $('r_t_ref').textContent=ref||"—"; $('r_t_mode').textContent=mode; $('r_t_date').textContent=date||"—";
    // Loan amount + security (shown on both the certificate and the receipt)
    var amt=Number(($('f_amount')||{}).value)||0;
    var amtTxt=amt>0?('Rs. '+amt.toLocaleString('en-IN')):dash;
    var secured=(($('f_secured')||{}).value==='yes');
    var secTxt=hi?(secured?'सुरक्षित / बंधक ऋण':'असुरक्षित ऋण'):(secured?'Secured / Mortgaged':'Unsecured');
    if($('c_t_amount')) $('c_t_amount').textContent=amtTxt;
    if($('c_t_secured')) $('c_t_secured').textContent=secTxt;
    if($('r_t_amount')) $('r_t_amount').textContent=amtTxt;
    if($('r_t_secured')) $('r_t_secured').textContent=secTxt;
    if($('c_secnote')) $('c_secnote').style.display=secured?'':'none';
    if($('r_secnote')) $('r_secnote').style.display=secured?'':'none';
  }
  window._certLang='en';
  function applyFirmToDocs(){
    try{
      const f=FIRM();
      document.querySelectorAll('#pageCert .lh-name, #pageRcpt .lh-name').forEach(function(el){ el.textContent=f.name; });
      document.querySelectorAll('#pageCert .lh-addr, #pageRcpt .lh-addr').forEach(function(el){
        el.innerHTML = esc(f.address)+'<br>Mobile: '+esc(f.phones)+'<br>'+(f.gstin?('GSTIN: '+esc(f.gstin)+' &nbsp;|&nbsp; '):'')+'Udyam Reg. No.: '+esc(f.udyam);
      });
    }catch(e){}
  }
  function applyCertLang(){
    const hi=(window._certLang==='hi');
    const pc=$('pageCert'), pr=$('pageRcpt'); if(!pc||!pr) return;
    /* certificate */
    pc.querySelector('.refrow').innerHTML = hi
      ? '<div>संदर्भ संख्या: <span class="v" id="c_ref">______</span></div><div>दिनांक: <span class="v" id="c_date">______</span></div>'
      : '<div>Ref. No.: <span class="v" id="c_ref">______</span></div><div>Date: <span class="v" id="c_date">______</span></div>';
    pc.querySelector('.doc-title').textContent = hi?'अदेयता प्रमाण पत्र':'NO DUES CERTIFICATE';
    pc.querySelector('.body-txt.cert').innerHTML = hi
      ? 'प्रमाणित किया जाता है कि श्री / श्रीमती / कुमारी <span class="fillv" id="c_name"></span><span class="relinline" id="c_rel"></span>, निवासी <span class="fillv" id="c_addr"></span>, ने शिवम एंटरप्राइजेज से ऋण खाता संख्या <span class="fillv" id="c_ref2"></span> के अंतर्गत <span class="fillv" id="c_loan"></span> प्राप्त किया था, जिसका पूर्ण भुगतान <span class="fillv" id="c_mode"></span> द्वारा कर दिया गया है।'
      : 'This is to certify that Shri / Smt. / Km. <span class="fillv" id="c_name"></span><span class="relinline" id="c_rel"></span>, resident of <span class="fillv" id="c_addr"></span>, had availed a <span class="fillv" id="c_loan"></span> from Shivam Enterprises vide Loan A/C No. <span class="fillv" id="c_ref2"></span>, and the same has been fully repaid by <span class="fillv" id="c_mode"></span>.';
    pc.querySelectorAll('.body-txt')[1].textContent = hi
      ? 'ऋण का पूर्ण एवं अंतिम भुगतान प्राप्त हो चुका है तथा ऋण खाता बंद कर दिया गया है। उक्त ऋण के संबंध में उधारकर्ता पर कोई बकाया शेष नहीं है, और प्रतिभूति स्वरूप हमारे पास रखा कोई भी प्रभार अथवा बंधक मुक्त कर दिया गया है।'
      : 'The full and final payment of the loan has been received and the loan account stands closed. The borrower has no outstanding dues against the said loan, and any charge or mortgage held by us as security stands released.';
    pc.querySelector('.sec-h').textContent = hi?'पक्षकार विवरण':'PARTY DETAILS';
    var ck=pc.querySelectorAll('table.details td.k');
    ck[0].textContent=hi?'उधारकर्ता का नाम':'Name of Borrower'; ck[1].textContent=hi?'पता':'Address';
    if(ck[2])ck[2].textContent=hi?'ऋण राशि':'Loan Amount'; if(ck[3])ck[3].textContent=hi?'प्रतिभूति':'Security';
    if(ck[4])ck[4].textContent=hi?'भुगतान का माध्यम':'Mode of Payment';
    var csn=document.getElementById('c_secnote'); if(csn) csn.textContent=hi
      ? 'यह ऋण एक सुरक्षित / बंधक ऋण था। प्रतिभूति स्वरूप रखे गए मूल संपत्ति / बंधक कागजात एवं स्वामित्व दस्तावेज़ मुक्त कर उधारकर्ता को पूर्णतः लौटा दिए गए हैं।'
      : 'This loan was a secured / mortgaged loan. The original property / mortgage papers and title documents held as security have been released and handed back to the borrower in full.';
    var csig=pc.querySelectorAll('.sigblock .sigcol');
    csig[0].querySelector('.ln').textContent=hi?'ग्राहक की पावती':'Customer Acknowledgement';
    csig[1].querySelector('.regards').innerHTML=hi?'सादर,<br><b>शिवम एंटरप्राइजेज की ओर से</b>':'With Regards,<br><b>For Shivam Enterprises</b>';
    csig[1].querySelector('.ln').textContent=hi?'अधिकृत हस्ताक्षरकर्ता':'Authorised Signatory';
    pc.querySelector('.docfoot').textContent = hi
      ? 'यह शिवम एंटरप्राइजेज द्वारा जारी कंप्यूटर-जनित प्रमाण पत्र है'
      : 'This is a computer-generated certificate issued by Shivam Enterprises';
    /* receipt */
    pr.querySelector('.banner').textContent = hi?'केवल आंतरिक उपयोग हेतु — कार्यालय प्रति':'FOR INTERNAL USE ONLY — OFFICE COPY';
    pr.querySelector('.refrow').innerHTML = hi
      ? '<div>रसीद संख्या: <span class="v" id="r_ref">______</span></div><div>दिनांक: <span class="v" id="r_date">______</span></div>'
      : '<div>Receipt No.: <span class="v" id="r_ref">______</span></div><div>Date: <span class="v" id="r_date">______</span></div>';
    pr.querySelector('.doc-title').textContent = hi?'पावती रसीद':'ACKNOWLEDGEMENT RECEIPT';
    pr.querySelector('.doc-sub').textContent = hi?'( अदेयता प्रमाण पत्र जारी करने विषयक )':'( No Dues Certificate Issuance )';
    var rb=pr.querySelectorAll('.body-txt');
    rb[0].innerHTML = hi
      ? 'मैं, <span class="fillv" id="r_name"></span>, <span id="r_rel" class="relinline"></span>, निवासी <span class="fillv" id="r_addr"></span>, एतद्द्वारा स्वीकार करता/करती हूँ कि मुझे शिवम एंटरप्राइजेज से मेरे <span class="fillv" id="r_loan"></span> के संबंध में <b>अदेयता प्रमाण पत्र</b> प्राप्त हो गया है।'
      : 'I, <span class="fillv" id="r_name"></span>, <span id="r_rel" class="relinline"></span>, resident of <span class="fillv" id="r_addr"></span>, hereby acknowledge that I have received the <b>No Dues Certificate</b> from Shivam Enterprises in respect of my <span class="fillv" id="r_loan"></span>.';
    rb[1].textContent = hi
      ? 'मैं पुष्टि करता/करती हूँ कि पूर्ण एवं अंतिम भुगतान कर दिया गया है तथा मेरे खाते में कोई बकाया शेष नहीं है। इस संबंध में शिवम एंटरप्राइजेज के विरुद्ध मेरा कोई दावा शेष नहीं है।'
      : 'I confirm that the full and final payment has been made and no dues are outstanding against my account. I have no further claims against Shivam Enterprises in this regard.';
    pr.querySelector('.sec-h').textContent = hi?'ऋण विवरण':'LOAN DETAILS';
    var rk=pr.querySelectorAll('table.details td.k');
    var rl=hi?['उधारकर्ता का नाम','पता','ऋण का प्रकार','ऋण राशि','प्रतिभूति','रसीद संख्या','भुगतान का माध्यम','प्रमाण पत्र दिनांक']
             :['Name of Borrower','Address','Loan Type','Loan Amount','Security','Receipt No.','Mode of Payment','No Dues Cert. Date'];
    rk.forEach(function(td,i){ if(rl[i]) td.textContent=rl[i]; });
    var rsn=document.getElementById('r_secnote'); if(rsn) rsn.textContent=hi
      ? 'मैं यह भी स्वीकार करता/करती हूँ कि यह एक सुरक्षित / बंधक ऋण था, तथा प्रतिभूति स्वरूप रखे गए मूल संपत्ति / बंधक कागजात एवं स्वामित्व दस्तावेज़ मुझे पूर्णतः लौटा दिए गए हैं।'
      : 'I further acknowledge that this was a secured / mortgaged loan, and that the original property / mortgage papers and title documents held as security have been returned and handed back to me in full.';
    var rsig=pr.querySelectorAll('.sigblock .sigcol');
    rsig[0].querySelector('.ln').textContent=hi?'उधारकर्ता के हस्ताक्षर':'Signature of Borrower';
    var s2=rsig[0].querySelector('.sub2'); if(s2) s2.textContent=hi?'(ग्राहक)':'(Customer)';
    rsig[1].querySelector('.ln').textContent=hi?'अधिकृत हस्ताक्षरकर्ता':'Authorised Signatory';
    pr.querySelector('.docfoot').textContent = hi
      ? 'यह रसीद शिवम एंटरप्राइजेज के आंतरिक अभिलेख हेतु सुरक्षित रखी जानी चाहिए।'
      : 'This receipt must be retained by Shivam Enterprises for internal records.';
    updateCert();
  }
  window.setCertLang=function(v){
    window._certLang=(v==='hi')?'hi':'en';
    var seg=$('certLangSeg'); if(seg){ [...seg.children].forEach(function(b){ b.classList.toggle('active', b.dataset.clang===window._certLang); }); }
    applyCertLang();
  };
  ['f_name','f_relname','f_addr','f_ref'].forEach(id=>$(id).addEventListener('input',updateCert));
  ['f_reltype','f_loan','f_mode','f_date'].forEach(id=>$(id).addEventListener('change',updateCert));
  function setDoc(v){
    document.body.classList.remove('show-both','show-cert','show-receipt'); document.body.classList.add('show-'+v);
    $('pageCert').classList.toggle('doc-hide', v==='receipt'); $('pageRcpt').classList.toggle('doc-hide', v==='cert');
    [...$('docseg').children].forEach(b=>b.classList.toggle('active', b.dataset.doc===v));
  }
  $('docseg').addEventListener('click', e=>{ if(e.target.dataset.doc) setDoc(e.target.dataset.doc); });
  function printCert(){ logAudit('Document Printed','No Dues / Receipt'); window._docTitleBak=document.title; document.title=_docFileName(($('f_name')||{}).value, ($('f_loan')||{}).value, 'Certificate'); document.body.classList.add('printing-cert'); window.print(); }
