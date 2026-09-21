  /* ---------------- EMI SCHEDULE ---------------- */
  function repSchedule(){
    var opts=loans.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''))
      .map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' &mdash; '+esc(l.acno||'')+'</option>').join('');
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>EMI Schedule</h3>'
      +'<p>Month-by-month installment plan for one loan &mdash; due date, EMI, running balance and payment status.</p></div>'
      +'<div class="actions"><button class="btn" onclick="repScheduleCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repSchedulePrint()">Print</button></div></div>'
      +'<div class="form-grid" style="grid-template-columns:420px; margin-bottom:14px;">'
      +'<div class="fg"><label>Borrower / Loan A/C</label><select id="scLoan" onchange="repScheduleFill()">'
      +'<option value="">&mdash; Select a borrower &mdash;</option>'+opts+'</select></div></div>'
      +'<div id="scBody"></div></div>';
    repScheduleFill();
  }
  function repScheduleLoan(){ var id=($('scLoan')||{}).value; if(!id) return null; return loans.find(l=>String(l.id)===String(id))||null; }
  function repScheduleData(l){
    var n=Math.max(0,Math.round(Number(l.tenure)||0));
    var emi=Math.round(Number(l.emi)||0);
    var paidBase=Number(l.paidBase)||0;
    var total=(l.baseOut!=null)?Math.max(0,Number(l.baseOut)):(Number(l.tpay)>0?Number(l.tpay):emi*n); // true amount payable (forward of any restructure)
    var _isInt=function(p){ return p && (p.intOnly===true || p.type==='Interest'); };
    /* Only CLEARED money counts — same rule as recomputeLoan. Interest-only payments are
       excluded (they service the month's interest, not the EMI/principal). */
    var cleared=Math.max(0,(l.payments||[]).filter(p=>p.status==='Cleared' && !_isInt(p)).reduce((a,p)=>a+(Number(p.amount)||0),0)-paidBase);
    // Interest-only months push the whole schedule forward and show as their own rows.
    var intPays=(l.payments||[]).filter(function(p){return p.status==='Cleared' && _isInt(p) && (Number(p.amount)||0)>0;}).slice().sort(function(a,b){return String(a.date||'').localeCompare(String(b.date||''));});
    var shift=intPays.length;
    var t=todayISO();
    // Applied late-fee charges, mapped to the EMI month they were charged for.
    var lateByIdx={}, totalLate=0;
    (l.charges||[]).forEach(function(c){ if(c && c.type==='Late fee'){ var amt=Number(c.amount)||0; totalLate+=amt; if(c.emiIdx) lateByIdx[c.emiIdx]=(lateByIdx[c.emiIdx]||0)+amt; } });
    // Each cleared payment is credited to the MONTH it was actually received (see
    // emiPaidByIndex) — so a skipped month stays unpaid instead of being back-filled from
    // the running total, and the schedule matches the payment register.
    var alloc=(typeof emiPaidByIndex==='function')?emiPaidByIndex(l):null;
    var rows=[]; var paidCount=0; var cumLate=0; var cumAlloc=0;
    for(var i=1;i<=n;i++){
      var dueD = emiDueDate(l,i); if(dueD && shift) dueD=repAddMonths(dueD, shift);   // interest months defer the schedule
      // last installment absorbs any rounding so the schedule sums exactly to the payable
      var thisEmi = (i<n) ? emi : Math.max(0, total-emi*(n-1));
      // amount credited to THIS installment (date-matched), with a safe waterfall fallback
      var allocated = alloc ? Math.round(alloc[i]||0) : Math.max(0, Math.min(thisEmi, cleared-emi*(i-1)));
      cumAlloc += allocated;
      var lf=lateByIdx[i]||0; cumLate+=lf;                       // late fee charged for this month
      var bal=Math.max(0, total-cumAlloc) + cumLate;            // balance reflects date-matched payments + accrued late fees
      var st;
      if(allocated>=thisEmi && thisEmi>0){ st='Paid'; paidCount++; }
      else if(allocated>0){ st='Partial'; }
      else if(dueD && dueD<t){ st='Overdue'; }
      else if(dueD && repDaysBetween(t,dueD)<=7){ st='Due soon'; }
      else { st='Upcoming'; }
      var dueAmt=Math.max(0, thisEmi-allocated);   // shortfall still owed for THIS installment
      rows.push({i:i,due:dueD,emi:thisEmi,paid:allocated,lateFee:lf,bal:bal,st:st,dueAmt:dueAmt});
    }
    // interest-only months, interleaved by date
    var intIncome=0;
    intPays.forEach(function(p){ var a=Number(p.amount)||0; intIncome+=a; rows.push({i:'',due:(p.date||''),emi:a,paid:a,lateFee:0,bal:null,st:'Interest',isInt:true}); });
    if(shift) rows.sort(function(a,b){ return String(a.due||'').localeCompare(String(b.due||'')); });
    return {rows:rows,emi:emi,n:n,total:total,cleared:cleared,paidCount:paidCount,totalLate:totalLate,intCount:shift,intIncome:intIncome};
  }
  function repScheduleFill(){
    var l=repScheduleLoan(); var host=$('scBody'); if(!host) return;
    if(!l){ host.innerHTML='<p style="color:var(--grey);">Select a borrower to view their EMI schedule.</p>'; return; }
    var D=repScheduleData(l);
    if(!D.n){ host.innerHTML='<p style="color:var(--grey);">This loan has no tenure set, so a schedule cannot be generated.</p>'; return; }
    var paidCount=D.paidCount;
    var tiles='<div class="pay-tiles" style="margin-bottom:14px;">'
      +repTile('EMI',inr(D.emi))+repTile('Tenure',D.n+' months')
      +repTile('Total of installments',inr(D.total))
      +(D.totalLate>0?repTile('Late fees',inr(D.totalLate),'bad'):'')
      +((D.intCount>0)?repTile('Interest serviced',D.intCount+' mo · '+inr(D.intIncome)):'')
      +repTile('Paid / scheduled',paidCount+' / '+D.n,'ok')+'</div>';
    var body=D.rows.map(function(r){
      if(r.isInt) return '<tr><td>·</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td class="right">'+inr(r.emi)+'</td><td class="right">'+inr(r.emi)+'</td><td class="right">&mdash;</td><td class="right" style="color:#9aa3b2;">&mdash;</td><td style="color:#4338ca;font-weight:600;">Interest paid</td></tr>';
      var stTxt=r.st+(((r.st==='Partial'||r.st==='Overdue') && r.dueAmt>0)?(' &middot; <span style="font-weight:600;">'+inr(r.dueAmt)+' due</span>'):'');
      return '<tr><td>'+r.i+'</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td class="right">'+inr(r.emi)+'</td><td class="right">'+(r.paid>0?inr(r.paid):'&mdash;')+'</td><td class="right" style="color:'+(r.lateFee>0?'#b26a00':'inherit')+';">'+(r.lateFee>0?('+'+inr(r.lateFee)):'&mdash;')+'</td><td class="right">'+inr(r.bal)+'</td><td style="color:'+repStColor(r.st)+';font-weight:600;white-space:nowrap;">'+stTxt+'</td></tr>';
    }).join('');
    host.innerHTML = '<div style="font-weight:600; margin-bottom:8px;">'+esc(l.name)+' &mdash; A/C '+esc(l.acno||'')+'</div>'+tiles
      +'<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Due Date</th>'
      +'<th class="right">EMI</th><th class="right">Paid</th><th class="right">Late Fee</th><th class="right">Balance After</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table></div>';
  }
  function repScheduleCSV(){
    var l=repScheduleLoan(); if(!l){ toast('Select a borrower first'); return; }
    var D=repScheduleData(l); if(!D.n){ toast('No tenure set'); return; }
    var data=D.rows.map(r=>[r.isInt?'·':r.i,fmtDate(r.due),r.emi,(r.isInt?0:r.paid),(r.isInt?'—':(r.dueAmt||0)),(r.isInt?'—':r.bal),r.isInt?'Interest paid':r.st]);
    repCSV('EMI_Schedule_'+(l.acno||l.name||'loan')+'.csv', ['Installment','Due Date','EMI','Paid','Due','Balance After','Status'], data);
  }
  function repSchedulePrint(){
    var l=repScheduleLoan(); if(!l){ toast('Select a borrower first'); return; }
    var D=repScheduleData(l); if(!D.n){ toast('No tenure set'); return; }
    var t='<table><thead><tr><th>#</th><th>Due Date</th><th class="r">EMI</th><th class="r">Paid</th><th class="r">Due</th><th class="r">Balance After</th><th>Status</th></tr></thead><tbody>'
      + D.rows.map(r=> r.isInt
          ? '<tr><td>&middot;</td><td>'+(r.due?fmtDate(r.due):'-')+'</td><td class="r">'+inr(r.emi)+'</td><td class="r">'+inr(r.emi)+'</td><td class="r">&mdash;</td><td class="r">&mdash;</td><td>Interest paid</td></tr>'
          : '<tr><td>'+r.i+'</td><td>'+(r.due?fmtDate(r.due):'-')+'</td><td class="r">'+inr(r.emi)+'</td><td class="r">'+(r.paid>0?inr(r.paid):'-')+'</td><td class="r">'+((r.dueAmt>0)?inr(r.dueAmt):'-')+'</td><td class="r">'+inr(r.bal)+'</td><td>'+r.st+((r.dueAmt>0&&(r.st==="Partial"||r.st==="Overdue"))?(' ('+inr(r.dueAmt)+' due)'):'')+'</td></tr>').join('')
      + '</tbody></table>';
    var paidCount=D.paidCount;
    printReport('EMI Schedule', l.name+'  (A/C '+(l.acno||'')+')',
      [['EMI',inr(D.emi)],['Tenure',D.n+' months'],['Total of installments',inr(D.total)],['Paid / scheduled',paidCount+' / '+D.n],['Outstanding',inr(Number(l.outstanding)||0)]], t, _docFileName(l.name,l.acno,'EMI_Schedule'))
  }

