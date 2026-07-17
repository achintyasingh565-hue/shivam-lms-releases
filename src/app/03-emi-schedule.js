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
    /* Only CLEARED money counts — same rule as recomputeLoan. (Was status!=='Pending', which
       would also count bounced/cancelled entries and disagree with the loan's own balance.) */
    var cleared=Math.max(0,(l.payments||[]).filter(p=>p.status==='Cleared').reduce((a,p)=>a+(Number(p.amount)||0),0)-paidBase);
    var t=todayISO();
    var rows=[]; var paidCount=0;
    for(var i=1;i<=n;i++){
      var dueD = emiDueDate(l,i);
      // last installment absorbs any rounding so the schedule sums exactly to the payable
      var thisEmi = (i<n) ? emi : Math.max(0, total-emi*(n-1));
      var prevCum = emi*(i-1);
      var cumThis = (i<n) ? emi*i : total;
      // portion of total cleared payments allocated to THIS installment
      var allocated=Math.max(0, Math.min(thisEmi, cleared-prevCum));
      var bal=Math.max(0, total-Math.min(cleared, cumThis));
      var st;
      if(allocated>=thisEmi && thisEmi>0){ st='Paid'; paidCount++; }
      else if(allocated>0){ st='Partial'; }
      else if(dueD && dueD<t){ st='Overdue'; }
      else if(dueD && repDaysBetween(t,dueD)<=7){ st='Due soon'; }
      else { st='Upcoming'; }
      rows.push({i:i,due:dueD,emi:thisEmi,paid:Math.round(allocated),bal:bal,st:st});
    }
    return {rows:rows,emi:emi,n:n,total:total,cleared:cleared,paidCount:paidCount};
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
      +repTile('Paid / scheduled',paidCount+' / '+D.n,'ok')+'</div>';
    var body=D.rows.map(r=>'<tr><td>'+r.i+'</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td class="right">'+inr(r.emi)+'</td><td class="right">'+(r.paid>0?inr(r.paid):'&mdash;')+'</td><td class="right">'+inr(r.bal)+'</td><td style="color:'+repStColor(r.st)+';font-weight:600;">'+r.st+'</td></tr>').join('');
    host.innerHTML = '<div style="font-weight:600; margin-bottom:8px;">'+esc(l.name)+' &mdash; A/C '+esc(l.acno||'')+'</div>'+tiles
      +'<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Due Date</th>'
      +'<th class="right">EMI</th><th class="right">Paid</th><th class="right">Balance After</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table></div>';
  }
  function repScheduleCSV(){
    var l=repScheduleLoan(); if(!l){ toast('Select a borrower first'); return; }
    var D=repScheduleData(l); if(!D.n){ toast('No tenure set'); return; }
    var data=D.rows.map(r=>[r.i,fmtDate(r.due),r.emi,r.bal,r.st]);
    repCSV('EMI_Schedule_'+(l.acno||l.name||'loan')+'.csv', ['Installment','Due Date','EMI','Balance After','Status'], data);
  }
  function repSchedulePrint(){
    var l=repScheduleLoan(); if(!l){ toast('Select a borrower first'); return; }
    var D=repScheduleData(l); if(!D.n){ toast('No tenure set'); return; }
    var t='<table><thead><tr><th>#</th><th>Due Date</th><th class="r">EMI</th><th class="r">Balance After</th><th>Status</th></tr></thead><tbody>'
      + D.rows.map(r=>'<tr><td>'+r.i+'</td><td>'+(r.due?fmtDate(r.due):'-')+'</td><td class="r">'+inr(r.emi)+'</td><td class="r">'+inr(r.bal)+'</td><td>'+r.st+'</td></tr>').join('')
      + '</tbody></table>';
    var paidCount=D.paidCount;
    printReport('EMI Schedule', l.name+'  (A/C '+(l.acno||'')+')',
      [['EMI',inr(D.emi)],['Tenure',D.n+' months'],['Total of installments',inr(D.total)],['Paid / scheduled',paidCount+' / '+D.n],['Outstanding',inr(Number(l.outstanding)||0)]], t, _docFileName(l.name,l.acno,'EMI_Schedule'))
  }

