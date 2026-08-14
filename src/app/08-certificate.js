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
  function recomputeLoan(l){
    const pays=Array.isArray(l.payments)?l.payments:[];
    const cleared=pays.filter(p=>p.status==='Cleared').reduce((a,p)=>a+(Number(p.amount)||0),0);
    l.paid=cleared;
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
    // how many EMIs were due on/before today (due dates are monotonic — stop at the first future one)
    var dueByToday=0;
    for(var i=1;i<=horizon;i++){ var d=emiDueDate(l,i); if(d && d<=t) dueByToday++; else if(d && d>t) break; }
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
        if(nd) l.due=nd;
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
    sel.innerHTML='<option value="">\u2014 Select a borrower \u2014</option>'+loans.map(l=>`<option value="${l.id}">${esc(l.name)} (${esc(l.acno)}) \u2014 bal ${inr(l.outstanding)}</option>`).join('');
    sel.value=cur;
  }
  function payTabModeUI(){ const m=$('payb_mode').value; const cq=$('payb_cheqRow'); const on=$('payb_onlineRow'); if(cq) cq.style.display=(m==='Cheque')?'grid':'none'; if(on) on.style.display=(m==='Online')?'grid':'none'; }
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
    const p={ pid:newPayId(), date:$('payb_date').value||todayISO(), mode, amount:amt,
      cheque: mode==='Cheque'?$('payb_cheqno').value.trim():'',
      bank: mode==='Cheque'?$('payb_bank').value.trim():'',
      ref: mode==='Online'?$('payb_ref').value.trim():'',
      status: mode==='Cheque'?$('payb_status').value:'Cleared' };
    if(!Array.isArray(l.payments)) l.payments=[];
    if(isDuplicatePayment(l,p) && !confirm('A payment of '+inr(amt)+' ('+mode+') on '+fmtDate(p.date)+' is ALREADY recorded for '+l.name+'.\n\nRecord it again anyway?')){ toast('Duplicate payment not recorded'); return; }
    recordPayTab._busy=true; try{
    l.payments.push(p); recomputeLoan(l); save(); logAudit(p.mode==='Cheque'?'Cheque Entry Added':'Cash Entry Added', l.name+' \u2014 '+inr(p.amount)+(p.mode==='Cheque'?(' chq '+(p.cheque||'')+' ['+p.status+']'):''));
    $('payb_amt').value=''; $('payb_cheqno').value=''; $('payb_bank').value=''; if($('payb_ref'))$('payb_ref').value='';
    renderPayReg(); refreshPayLoanDropdown();
    toast('Payment recorded for '+l.name+(p.status==='Pending'?' (pending cheque \u2014 balance unchanged until cleared)':''));
    } finally { setTimeout(function(){ recordPayTab._busy=false; }, 400); }
  }
  function payAllRows(){
    const rows=[];
    loans.forEach(l=>{ (l.payments||[]).forEach((p,idx)=>{ rows.push({loanId:l.id, idx, name:l.name, acno:l.acno, date:p.date, mode:p.mode, amount:Number(p.amount)||0, cheque:p.cheque||'', bank:p.bank||'', ref:p.ref||'', status:p.status}); }); });
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
    const body=$('payRegBody'); if(!body) return;
    if(!rows.length){ body.innerHTML=`<tr><td colspan="8"><div class="empty"><b>No payments recorded yet.</b><br>Use the form above to record a cash or cheque payment.</div></td></tr>`; return; }
    body.innerHTML=rows.map(r=>{
      const chq = r.mode==='Cheque' ? (esc(r.cheque||'\u2014')+(r.bank?(' / '+esc(r.bank)):'')) : (r.mode==='Online'?('Ref '+esc(r.ref||'\u2014')):'\u2014');
      const badge = r.status==='Cleared'?'<span class="pp ok">Cleared</span>':'<span class="pp pend">Pending</span>';
      const tog = r.mode==='Cheque' ? `<button class="lnk" onclick="payToggle('${r.loanId}',${r.idx})">${r.status==='Cleared'?'mark pending':'mark cleared'}</button>` : '';
      return `<tr><td>${fmtDate(r.date)||'\u2014'}</td><td><div class="name">${esc(r.name)}</div></td><td>${esc(r.acno)}</td><td>${esc(r.mode)}</td><td>${chq}</td><td class="right num">${inr(r.amount)}</td><td>${badge}</td><td><div class="rowact" style="gap:12px;"><button class="lnk" onclick="printPayReceipt('${r.loanId}',${r.idx})">receipt</button>${tog}<button class="lnk del" onclick="payRemove('${r.loanId}',${r.idx})">remove</button></div></td></tr>`;
    }).join('');
  }
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
      '<div class="name">'+esc(FIRM().name)+'</div>'+
      '<div class="addr">'+esc(FIRM().address)+' &nbsp;|&nbsp; Mobile: '+esc(FIRM().phones)+'</div>'+
      '<div class="addr">GSTIN: '+esc(FIRM().gstin)+' &nbsp;|&nbsp; Udyam Reg. No.: '+esc(FIRM().udyam)+'</div>'+
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
  function refreshChargeUI(){ var sel=$('chg_loan'); if(sel){ var cur=sel.value; sel.innerHTML='<option value="">\u2014 Select a borrower \u2014</option>'+loans.map(function(l){return '<option value="'+l.id+'">'+esc(l.name)+' ('+esc(l.acno)+')</option>';}).join(''); sel.value=cur; } if($('chg_date')&&!$('chg_date').value)$('chg_date').value=todayISO(); if($('lateFeeRate')) $('lateFeeRate').value=getLateFeeRate(); renderChargeList(); try{ chgUpdateHint(); }catch(e){} }
  /* ---- Late-fee rate (₹ per overdue month) — persistent, default ₹500 ---- */
  function getLateFeeRate(){ try{ var v=Number(localStorage.getItem('shivam_latefee_v1')); return (!isNaN(v) && v>=0)?v:500; }catch(e){ return 500; } }
  window.getLateFeeRate=getLateFeeRate;
  window.setLateFeeRate=function(v){ try{ localStorage.setItem('shivam_latefee_v1', String(Math.max(0,Math.round(Number(v)||0)))); }catch(e){} try{ chgUpdateHint(); }catch(e){} };
  /* EMIs whose due date has passed and are NOT yet fully covered by cleared payments. */
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
    var emiOf=function(i){ return (i<n)?emi:Math.max(0,total-emi*(n-1)); };
    var paidBase=Number(l.paidBase)||0;
    var clearedTot=Math.max(0,(l.payments||[]).filter(function(p){return p.status==='Cleared';}).reduce(function(a,p){return a+(Number(p.amount)||0);},0)-paidBase);
    if(paidBase>0){ for(var w=1;w<=n;w++) alloc[w]=Math.max(0,Math.min(emiOf(w), clearedTot-emi*(w-1))); return alloc; }
    var keyToIdx={}; for(var i2=1;i2<=n;i2++){ var dk=_ymKey(emiDueDate(l,i2)); if(dk && keyToIdx[dk]==null) keyToIdx[dk]=i2; }
    var earliestUnfull=function(){ for(var j=1;j<=n;j++){ if(alloc[j] < emiOf(j)-0.001) return j; } return 0; };
    var pays=(l.payments||[]).filter(function(p){return p.status==='Cleared' && (Number(p.amount)||0)>0;})
      .map(function(p){return {date:p.date||'', amt:Number(p.amount)||0};})
      .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
    pays.forEach(function(p){
      var remaining=p.amt, pk=_ymKey(p.date), target=(pk!=null)?keyToIdx[pk]:null;
      if(target!=null && alloc[target] < emiOf(target)-0.001){ var room=emiOf(target)-alloc[target], put=Math.min(room,remaining); alloc[target]+=put; remaining-=put; }
      while(remaining>0.001){ var e=earliestUnfull(); if(!e) break; var room2=emiOf(e)-alloc[e], put2=Math.min(room2,remaining); alloc[e]+=put2; remaining-=put2; }
    });
    return alloc;
  }
  window.emiPaidByIndex=emiPaidByIndex;
  function overdueEmiIdxs(l){
    if(!l) return [];
    var n=Math.max(0,Math.round(Number(l.tenure)||0)), emi=Math.round(Number(l.emi)||0), t=todayISO();
    var total=(l.baseOut!=null)?Math.max(0,Number(l.baseOut)):((Number(l.tpay)>0)?Number(l.tpay):emi*n);
    var emiOf=function(i){ return (i<n)?emi:Math.max(0,total-emi*(n-1)); };
    var alloc=emiPaidByIndex(l);
    var out=[]; for(var i=1;i<=n;i++){ var d=emiDueDate(l,i); if(d && d<t && alloc[i] < emiOf(i)-0.001) out.push({i:i,due:d}); } return out;
  }
  window.overdueEmiIdxs=overdueEmiIdxs;
  function chgTypeChange(){ var t=($('chg_type')||{}).value; if($('chg_chequeWrap')) $('chg_chequeWrap').style.display=(t==='Cheque bounce')?'block':'none'; chgUpdateHint(); }
  function chgUpdateHint(){
    if($('lateFeeRate') && document.activeElement!==$('lateFeeRate')) $('lateFeeRate').value=getLateFeeRate();
    var hint=$('lateFeeHint'); if(!hint) return;
    var l=loans.find(function(x){return x.id===(($('chg_loan')||{}).value);});
    if(!l){ hint.textContent=''; return; }
    var idxs=overdueEmiIdxs(l), rate=getLateFeeRate();
    var already=(l.charges||[]).filter(function(c){return c&&c.type==='Late fee'&&c.emiIdx;}).length;
    var pending=Math.max(0, idxs.length-already);
    hint.innerHTML = idxs.length ? (esc(l.name)+' is '+idxs.length+' month(s) overdue · '+(pending>0?('<b>'+pending+' late fee(s) pending = '+inr(rate*pending)+'</b>'):'late fees up to date')) : (esc(l.name)+' has no overdue EMIs.');
    if(($('chg_type')||{}).value==='Late fee' && $('chg_amt') && !$('chg_amt').value && pending>0){ $('chg_amt').value = rate*pending; }
  }
  window.chgLoanChange=function(){ if($('chg_amt')) $('chg_amt').value=''; chgUpdateHint(); };
  /* One-click: apply a ₹rate late fee for every overdue month not already charged
     (keyed by EMI number so repeated clicks never double-charge). Sticky charges. */
  window.applyLateFees=function(id){
    var l=loans.find(function(x){return x.id===id;}); if(!l){ toast('Choose a borrower first'); return; }
    var rate=getLateFeeRate(); if(rate<=0){ toast('Set a late-fee rate (₹/month) above zero first.'); return; }
    if(!Array.isArray(l.charges)) l.charges=[];
    var idxs=overdueEmiIdxs(l), added=0;
    idxs.forEach(function(o){ var exists=l.charges.some(function(c){return c&&c.type==='Late fee'&&c.emiIdx===o.i;}); if(!exists){ l.charges.unshift({ id:'C'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), date:o.due, type:'Late fee', amount:rate, emiIdx:o.i, note:'Late fee — EMI #'+o.i+' overdue' }); added++; } });
    if(added){ try{ recomputeLoan(l); }catch(e){} save(); try{ logAudit('Late Fees Applied', added+' month(s) × '+inr(rate)+' — '+(l.name||'')+' ('+(l.acno||'')+')'); }catch(e){} renderChargeList(); chgUpdateHint(); try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){} toast(added+' late fee(s) applied — '+inr(rate*added)); }
    else { toast('Late fees already up to date for '+(l.name||'this borrower')); }
  };
  window.applyLateFeesSelected=function(){ applyLateFees(($('chg_loan')||{}).value); };
  /* One-click undo: remove ALL late-fee charges for the selected borrower (individual
     charges can still be deleted from the list below). Recomputes so the outstanding,
     schedule, reminders and reports drop the fees immediately. */
  window.waiveLateFees=function(id){
    var l=loans.find(function(x){return x.id===id;}); if(!l){ toast('Choose a borrower first'); return; }
    var late=(l.charges||[]).filter(function(c){return c&&c.type==='Late fee';});
    if(!late.length){ toast('No late fees to remove for '+(l.name||'this borrower')+'.'); return; }
    var tot=late.reduce(function(a,c){return a+(Number(c.amount)||0);},0);
    if(!confirm('Remove all '+late.length+' late fee(s) ('+inr(tot)+') for '+(l.name||'')+'?\n\nThis clears them from the outstanding, schedule, reminders and reports.')) return;
    l.charges=(l.charges||[]).filter(function(c){return !(c&&c.type==='Late fee');});
    try{ recomputeLoan(l); }catch(e){} save();
    try{ logAudit('Late Fees Removed', late.length+' late fee(s) ('+inr(tot)+') — '+(l.name||'')+' ('+(l.acno||'')+')'); }catch(e){}
    renderChargeList(); chgUpdateHint(); try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}
    toast(late.length+' late fee(s) removed');
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
        save();
        logAudit('Charge Edited', type+' '+inr(amt)+' \u2014 '+(l.name||'')+' ('+(l.acno||'')+')');
        _editCharge=null; clearChargeForm();
        renderChargeList();
        toast('Charge updated');
        return;
      }
      _editCharge=null;
    }
    var charge={ id:'C'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), date:date, type:type, amount:amt, cheque:cheque, note:note };
    if(!Array.isArray(l.charges)) l.charges=[];
    l.charges.unshift(charge);
    save();
    logAudit('Charge Recorded', type+' '+inr(amt)+' \u2014 '+(l.name||'')+' ('+(l.acno||'')+')'+(charge.cheque?(' cheque '+charge.cheque):''));
    clearChargeForm();
    renderChargeList();
    toast(type+' of '+inr(amt)+' recorded');
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
    if(!rows.length){ host.innerHTML='<p style="color:var(--muted);font-size:13px;">No charges recorded yet.</p>'; return; }
    host.innerHTML='<div style="font-weight:600;font-size:13px;margin-bottom:6px;">Recent charges</div>'+rows.slice(0,30).map(function(r){
      var col=r.c.type==='Cheque bounce'?'#b42318':(r.c.type==='Late fee'?'#b26a00':'#475467');
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-bottom:6px;font-size:13px;"><span><b style="color:'+col+';">'+esc(r.c.type)+'</b> '+inr(r.c.amount)+' \u2014 '+esc(r.name||'')+' ('+esc(r.acno||'')+')'+(r.c.cheque?(' \u00b7 chq '+esc(r.c.cheque)):'')+(r.c.note?(' \u00b7 '+esc(r.c.note)):'')+'</span><span style="display:flex;align-items:center;gap:12px;white-space:nowrap;"><span style="color:var(--muted);">'+fmtDate(r.c.date)+'</span><a href="#" onclick="editCharge(\''+r.loanId+'\',\''+r.c.id+'\');return false;" style="color:#2563EB;text-decoration:none;font-weight:600;">Edit</a><a href="#" onclick="deleteCharge(\''+r.loanId+'\',\''+r.c.id+'\');return false;" style="color:#b42318;text-decoration:none;font-weight:600;">Delete</a></span></div>';
    }).join('');
  }
  function deleteCharge(loanId, chargeId){
    var l=loans.find(function(x){return x.id===loanId;}); if(!l||!Array.isArray(l.charges)) return;
    var c=l.charges.find(function(x){return x.id===chargeId;}); if(!c) return;
    if(!confirm('Delete this '+(c.type||'charge')+' of '+inr(c.amount)+' for '+(l.name||'')+'?')) return;
    l.charges=l.charges.filter(function(x){return x.id!==chargeId;});
    save();
    logAudit('Charge Deleted', (c.type||'')+' '+inr(c.amount)+' \u2014 '+(l.name||'')+' ('+(l.acno||'')+')');
    if(_editCharge&&_editCharge.chargeId===chargeId){ _editCharge=null; clearChargeForm(); }
    renderChargeList();
    toast('Charge deleted');
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
  function _clLoan(v){ if(window._certLang!=='hi') return v; return v==='personal loan'?'व्यक्तिगत ऋण':(v==='housing loan'?'आवास ऋण':(v==='product loan'?'उत्पाद ऋण':v)); }
  function _clMode(v){ if(window._certLang!=='hi') return v; return v==='Cash'?'नकद':(v==='Cheque'?'चेक':v); }
  function _clRel(t){ if(window._certLang!=='hi') return t; return t==='son of'?'पुत्र':(t==='daughter of'?'पुत्री':(t==='wife of'?'पत्नी':t)); }
  function updateCert(){
    applyFirmToDocs();
    const name=$('f_name').value.trim(), relt=$('f_reltype').value, relname=$('f_relname').value.trim();
    const addr=$('f_addr').value.trim(), loan=_clLoan($('f_loan').value), mode=_clMode($('f_mode').value);
    const ref=$('f_ref').value.trim(), date=fmtDate($('f_date').value);
    const hi=(window._certLang==='hi');
    $('c_ref').textContent=ref||"______"; $('c_ref2').textContent=ref||"______"; $('c_date').textContent=date||"______";
    $('c_name').textContent=name||dash; $('c_addr').textContent=addr||dash; $('c_loan').textContent=loan; $('c_mode').textContent=mode;
    if($('c_rel')) $('c_rel').textContent=relname?(", "+_clRel(relt)+" "+relname):"";
    $('c_t_name').textContent=name||"—"; $('c_t_addr').textContent=addr||"—"; $('c_t_mode').textContent=mode;
    $('r_ref').textContent=ref||"______"; $('r_date').textContent=date||"______";
    $('r_name').textContent=name||dash;
    $('r_rel').textContent=relname?(_clRel(relt)+" "+relname):_clRel(relt)+" "+dash;
    $('r_addr').textContent=addr||dash; $('r_loan').textContent=loan;
    $('r_t_name').textContent=name||"—"; $('r_t_addr').textContent=addr||"—"; $('r_t_loan').textContent=hi?loan:loanCap(loan);
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
        el.innerHTML = esc(f.address)+'<br>Mobile: '+esc(f.phones)+'<br>GSTIN: '+esc(f.gstin)+' &nbsp;|&nbsp; Udyam Reg. No.: '+esc(f.udyam);
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
