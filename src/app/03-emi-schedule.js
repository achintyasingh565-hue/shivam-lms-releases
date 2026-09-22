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
    var _mkE=function(iso){ return (typeof _ymKey==='function')?_ymKey(iso):(String(iso||'').slice(0,7)||null); };
    // Charges are mapped to the CALENDAR MONTH they belong to (by their date, or the EMI month
    // they were tagged with). This means a charge added by hand from the Payments page — a late
    // fee on any date, even after the tenure — shows on the right month row and is carried in the
    // balance, exactly like the one-click charges. Late fees also show in the Late Fee column;
    // ALL charge types accrue into the running balance so it matches the loan's outstanding.
    var lateByMonth={}, chgByMonth={}, totalLate=0, totalChg=0, latestChargeKey=null;
    (l.charges||[]).forEach(function(c){
      if(!c) return; var amt=Number(c.amount)||0; if(!amt) return;
      var mk=_mkE(c.date);
      if(!mk && c.emiIdx){ var dd=emiDueDate(l,c.emiIdx); if(dd&&shift) dd=repAddMonths(dd,shift); mk=_mkE(dd); }
      if(c.type==='Late fee'){ totalLate+=amt; if(mk) lateByMonth[mk]=(lateByMonth[mk]||0)+amt; }
      totalChg+=amt; if(mk){ chgByMonth[mk]=(chgByMonth[mk]||0)+amt; if(latestChargeKey==null||mk>latestChargeKey) latestChargeKey=mk; }
    });
    // Each cleared payment is credited to the MONTH it was actually received (see
    // emiPaidByIndex) — so a skipped month stays unpaid instead of being back-filled from
    // the running total, and the schedule matches the payment register.
    var alloc=(typeof emiPaidByIndex==='function')?emiPaidByIndex(l):null;
    var rows=[]; var paidCount=0; var cumLate=0; var cumChg=0; var cumAlloc=0;
    for(var i=1;i<=n;i++){
      var dueD = emiDueDate(l,i); if(dueD && shift) dueD=repAddMonths(dueD, shift);   // interest months defer the schedule
      // last installment absorbs any rounding so the schedule sums exactly to the payable
      var thisEmi = (i<n) ? emi : Math.max(0, total-emi*(n-1));
      // amount credited to THIS installment (date-matched), with a safe waterfall fallback
      var allocated = alloc ? Math.round(alloc[i]||0) : Math.max(0, Math.min(thisEmi, cleared-emi*(i-1)));
      cumAlloc += allocated;
      var rk=_mkE(dueD);
      var lf=lateByMonth[rk]||0; cumLate+=lf;                    // late fee for this month (display column)
      cumChg+=(chgByMonth[rk]||0);                              // ALL charges for this month accrue into balance
      var bal=Math.max(0, total-cumAlloc) + cumChg;            // balance reflects date-matched payments + accrued charges
      var st;
      if(allocated>=thisEmi && thisEmi>0){ st='Paid'; paidCount++; }
      else if(allocated>0){ st='Partial'; }
      else if(dueD && dueD<t){ st='Overdue'; }
      else if(dueD && repDaysBetween(t,dueD)<=7){ st='Due soon'; }
      else { st='Upcoming'; }
      var dueAmt=Math.max(0, thisEmi-allocated);   // shortfall still owed for THIS installment
      rows.push({i:i,due:dueD,emi:thisEmi,paid:allocated,lateFee:lf,bal:bal,st:st,dueAmt:dueAmt});
    }
    /* ---- EXTENSION MONTHS (loan still running after its tenure) ----
       If the loan hasn't been fully repaid by the last scheduled EMI, keep the schedule going
       month-by-month so that (a) the overrun is visible and (b) a payment made AFTER the tenure
       lands on its OWN month row and reduces the balance — instead of disappearing into an
       "advance". Missed months during the tenure stay flagged above; a later payment never
       back-fills them. */
    var cumExt=0, extCount=0;
    var _mk=_mkE;
    var lastSchedD = n>0 ? (function(){ var d=emiDueDate(l,n); if(d&&shift) d=repAddMonths(d,shift); return d; })() : '';
    var lastSchedKey=_mk(lastSchedD), todayKey=_mk(t);
    // cleared (non-interest) payments received AFTER the last scheduled month, grouped by month
    var postByMonth={}, lastPostKey=null;
    (l.payments||[]).forEach(function(p){
      if(!p || p.status!=='Cleared' || _isInt(p)) return; var a=Number(p.amount)||0; if(a<=0) return;
      var pk=_mk(p.date); if(!pk || !lastSchedKey || pk<=lastSchedKey) return;
      postByMonth[pk]=(postByMonth[pk]||0)+a; if(lastPostKey==null||pk>lastPostKey) lastPostKey=pk;
    });
    var owedAfterTenure=Math.max(0, total-cumAlloc);
    var hasPost=Object.keys(postByMonth).length>0;
    var hasChargeBeyond = latestChargeKey && lastSchedKey && latestChargeKey>lastSchedKey;   // a charge dated after the tenure
    var needExtend = n>0 && (hasPost || hasChargeBeyond || (owedAfterTenure>0.5 && lastSchedKey && todayKey && todayKey>lastSchedKey));
    if(needExtend){
      var horizonKey=todayKey; if(lastPostKey && lastPostKey>horizonKey) horizonKey=lastPostKey; if(latestChargeKey && latestChargeKey>horizonKey) horizonKey=latestChargeKey;
      var m=n;
      while(m-n<240){
        m++;
        var dD=emiDueDate(l,m); if(dD&&shift) dD=repAddMonths(dD,shift);
        var mKey=_mk(dD); if(mKey && horizonKey && mKey>horizonKey) break;
        var remOwed=Math.max(0, total-cumAlloc-cumExt);           // base payable still owed entering this month
        var chgThis=(chgByMonth[mKey]||0);
        if(remOwed<=0.5 && !(postByMonth[mKey]>0) && !(chgThis>0)) { if(mKey && horizonKey && mKey>=horizonKey) break; else continue; }
        var expectE=Math.min(emi, remOwed);                       // ideal catch-up EMI for the month
        var gotE=Math.round(postByMonth[mKey]||0);                // received this month (post-tenure)
        var creditE=Math.min(gotE, remOwed);                      // portion that pays down the loan
        cumExt+=creditE;
        var lfE=lateByMonth[mKey]||0; cumLate+=lfE; cumChg+=chgThis;
        var balE=Math.max(0, total-cumAlloc-cumExt)+cumChg;
        var stE;
        if(expectE<=0.5){ stE='Paid'; }
        else if(creditE>=expectE-0.5){ stE='Paid'; }
        else if(gotE>0){ stE='Partial'; }
        else if(dD && dD<t){ stE='Overdue'; }
        else { stE='Upcoming'; }
        var dueAmtE=Math.max(0, Math.round(expectE-creditE));
        rows.push({i:m,due:dD,emi:Math.round(expectE),paid:gotE,lateFee:lfE,bal:balE,st:stE,dueAmt:dueAmtE,ext:true});
        extCount++;
        if(mKey && horizonKey && mKey>=horizonKey) break;
      }
    }
    // interest-only months, interleaved by date
    var intIncome=0;
    intPays.forEach(function(p){ var a=Number(p.amount)||0; intIncome+=a; rows.push({i:'',due:(p.date||''),emi:a,paid:a,lateFee:0,bal:null,st:'Interest',isInt:true}); });
    if(shift) rows.sort(function(a,b){ return String(a.due||'').localeCompare(String(b.due||'')); });
    // Safety: fold any charge that didn't land on a visible month row (e.g. an odd date) into the
    // final balance so the schedule's last Balance After always equals the loan's outstanding.
    var _lostChg=Math.round(totalChg-cumChg);
    if(_lostChg>0){ for(var zi=rows.length-1; zi>=0; zi--){ if(!rows[zi].isInt){ rows[zi].bal=(Number(rows[zi].bal)||0)+_lostChg; break; } } cumChg+=_lostChg; }
    // Any cleared money still not tied to a scheduled OR extension month (a true advance /
    // overpayment beyond the whole payable) — shown separately, never merged into a past-due row.
    var advance=Math.max(0, Math.round(cleared - cumAlloc - cumExt));
    return {rows:rows,emi:emi,n:n,total:total,cleared:cleared,paidCount:paidCount,totalLate:totalLate,intCount:shift,intIncome:intIncome,advance:advance,extCount:extCount};
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
      +((D.advance>0)?repTile('Advance / unscheduled',inr(D.advance)):'')
      +((D.extCount>0)?repTile('Beyond tenure',D.extCount+' month'+(D.extCount>1?'s':''),'bad'):'')
      +repTile('Paid / scheduled',paidCount+' / '+D.n,'ok')+'</div>';
    var body=D.rows.map(function(r){
      if(r.isInt) return '<tr><td>·</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td class="right">'+inr(r.emi)+'</td><td class="right">'+inr(r.emi)+'</td><td class="right">&mdash;</td><td class="right" style="color:#9aa3b2;">&mdash;</td><td style="color:#4338ca;font-weight:600;">Interest paid</td></tr>';
      var stTxt=r.st+(((r.st==='Partial'||r.st==='Overdue') && r.dueAmt>0)?(' &middot; <span style="font-weight:600;">'+inr(r.dueAmt)+' due</span>'):'');
      var numCell=r.ext?(r.i+' <span style="font-size:10px;color:#b26a00;font-weight:600;">ext</span>'):r.i;
      var rowStyle=r.ext?' style="background:#fbf6e8;"':'';
      return '<tr'+rowStyle+'><td>'+numCell+'</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td class="right">'+(r.emi>0?inr(r.emi):'&mdash;')+'</td><td class="right">'+(r.paid>0?inr(r.paid):'&mdash;')+'</td><td class="right" style="color:'+(r.lateFee>0?'#b26a00':'inherit')+';">'+(r.lateFee>0?('+'+inr(r.lateFee)):'&mdash;')+'</td><td class="right">'+inr(r.bal)+'</td><td style="color:'+repStColor(r.st)+';font-weight:600;white-space:nowrap;">'+stTxt+'</td></tr>';
    }).join('');
    var extNote=(D.extCount>0)?'<p class="ph-sub" style="margin:10px 2px 0;">Rows marked <b style="color:#b26a00;">ext</b> are months beyond the original '+D.n+'-month tenure — the loan is still running. Payments made after the tenure appear on their own month here and reduce the balance; missed months inside the tenure stay flagged above.</p>':'';
    host.innerHTML = '<div style="font-weight:600; margin-bottom:8px;">'+esc(l.name)+' &mdash; A/C '+esc(l.acno||'')+'</div>'+tiles
      +'<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Due Date</th>'
      +'<th class="right">EMI</th><th class="right">Paid</th><th class="right">Late Fee</th><th class="right">Balance After</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table></div>'+extNote;
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
          : '<tr><td>'+r.i+(r.ext?' (ext)':'')+'</td><td>'+(r.due?fmtDate(r.due):'-')+'</td><td class="r">'+(r.emi>0?inr(r.emi):'-')+'</td><td class="r">'+(r.paid>0?inr(r.paid):'-')+'</td><td class="r">'+((r.dueAmt>0)?inr(r.dueAmt):'-')+'</td><td class="r">'+inr(r.bal)+'</td><td>'+r.st+((r.dueAmt>0&&(r.st==="Partial"||r.st==="Overdue"))?(' ('+inr(r.dueAmt)+' due)'):'')+'</td></tr>').join('')
      + '</tbody></table>';
    var paidCount=D.paidCount;
    printReport('EMI Schedule', l.name+'  (A/C '+(l.acno||'')+')',
      [['EMI',inr(D.emi)],['Tenure',D.n+' months'],['Total of installments',inr(D.total)],['Paid / scheduled',paidCount+' / '+D.n],['Outstanding',inr(Number(l.outstanding)||0)]], t, _docFileName(l.name,l.acno,'EMI_Schedule'))
  }

