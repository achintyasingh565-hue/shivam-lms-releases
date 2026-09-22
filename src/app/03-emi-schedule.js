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
    // Charges are attached to the installment they belong to. Auto charges carry an emiIdx, so we
    // map those BY INSTALLMENT NUMBER — that stays correct even when interest-only payments defer
    // (shift) the schedule. Charges added by hand (no emiIdx) map by their calendar month instead.
    var lateByIdx={}, intByIdx={}, chgByIdx={};
    var lateByMonth={}, intByMonth={}, chgByMonth={}, totalLate=0, totalInt=0, totalChg=0, latestChargeKey=null, latestChargeIdx=0;
    (l.charges||[]).forEach(function(c){
      if(!c) return; var amt=Number(c.amount)||0; if(!amt) return;
      totalChg+=amt;
      if(c.type==='Late fee') totalLate+=amt;
      if(c.type==='Overdue interest') totalInt+=amt;
      if(c.emiIdx){
        var ix=c.emiIdx; if(ix>latestChargeIdx) latestChargeIdx=ix;
        if(c.type==='Late fee') lateByIdx[ix]=(lateByIdx[ix]||0)+amt;
        if(c.type==='Overdue interest') intByIdx[ix]=(intByIdx[ix]||0)+amt;
        chgByIdx[ix]=(chgByIdx[ix]||0)+amt;
      } else {
        var mk=_mkE(c.date);
        if(c.type==='Late fee'){ if(mk) lateByMonth[mk]=(lateByMonth[mk]||0)+amt; }
        if(c.type==='Overdue interest'){ if(mk) intByMonth[mk]=(intByMonth[mk]||0)+amt; }
        if(mk){ chgByMonth[mk]=(chgByMonth[mk]||0)+amt; if(latestChargeKey==null||mk>latestChargeKey) latestChargeKey=mk; }
      }
    });
    var lateAt=function(i,mk){ return (lateByIdx[i]||0)+(mk?(lateByMonth[mk]||0):0); };
    var intAt=function(i,mk){ return (intByIdx[i]||0)+(mk?(intByMonth[mk]||0):0); };
    var chgAt=function(i,mk){ return (chgByIdx[i]||0)+(mk?(chgByMonth[mk]||0):0); };
    var _mk=_mkE, todayKey=_mkE(t);
    var grace=(typeof getLateGraceDays==='function')?getLateGraceDays():7;
    var _dl=function(iso){ return (typeof _lfAddDays==='function')?_lfAddDays(iso,grace):iso; };
    var rows=[]; var paidCount=0; var intIncome=0; var cumPaid=0; var cumChg=0; var carry=0; var extCount=0; var emisPlaced=0;

    /* Restructured loans (a reset baseline) keep the simple in-place schedule — no auto-defer. */
    if(paidBase>0){
      var allocR=(typeof emiPaidByIndex==='function')?emiPaidByIndex(l):null;
      for(var ri=1;ri<=n;ri++){
        var dR=emiDueDate(l,ri); if(dR&&shift) dR=repAddMonths(dR,shift);
        var teR=(ri<n)?emi:Math.max(0,total-emi*(n-1));
        var alR=allocR?Math.round(allocR[ri]||0):0; cumPaid+=alR;
        var rkR=_mk(dR); cumChg+=chgAt(ri,rkR);
        var stR=(alR>=teR-0.5&&teR>0)?'Paid':(alR>0?'Partial':(dR&&dR<t?'Overdue':(dR&&repDaysBetween(t,dR)<=7?'Due soon':'Upcoming')));
        if(stR==='Paid') paidCount++;
        rows.push({i:ri,due:dR,emi:teR,paid:alR,lateFee:lateAt(ri,rkR),intFee:intAt(ri,rkR),charge:chgAt(ri,rkR),bal:Math.max(0,total-cumPaid)+cumChg,st:stR,dueAmt:Math.max(0,teR-alR)});
      }
      intPays.forEach(function(p){ var a=Number(p.amount)||0; intIncome+=a; rows.push({i:'',due:(p.date||''),emi:a,paid:a,lateFee:0,intFee:0,charge:0,bal:null,st:'Interest',isInt:true}); });
      if(shift) rows.sort(function(a,b){return String(a.due||'').localeCompare(String(b.due||''));});
      var advR=Math.max(0,Math.round(cleared-cumPaid));
      return {rows:rows,emi:emi,n:n,total:total,cleared:cleared,paidCount:paidCount,totalLate:totalLate,totalInt:totalInt,totalChg:totalChg,intCount:intPays.length,intIncome:intIncome,advance:advR,extCount:0};
    }

    /* ---- MONTH-BY-MONTH SIMULATION (the lender's deferral model) ----
       Walk the calendar from disbursement. Each month is exactly ONE row:
        • EMI paid (full/partial)      -> an installment is consumed (Paid / Partial).
        • interest-only paid           -> DEFERRED: interest is income, the EMI moves forward.
        • nothing paid & past grace    -> DEFERRED: only interest + late fee are charged, EMI moves forward.
        • a future month with nothing  -> the next installment falls due here (Upcoming / Due soon).
       So there are always exactly `tenure` EMIs; deferrals simply push them to later months, and the
       tenure visibly extends by the number of deferred months. Once all EMIs are placed, any further
       months accrue interest only until the balance is cleared. */
    var emiPayByMonth={}, intOnlyByMonth={};
    (l.payments||[]).forEach(function(p){ if(!p||p.status!=='Cleared')return; var a=Number(p.amount)||0; if(a<=0)return; var k=_mk(p.date); if(!k)return; if(_isInt(p)) intOnlyByMonth[k]=(intOnlyByMonth[k]||0)+a; else emiPayByMonth[k]=(emiPayByMonth[k]||0)+a; });
    var kk=0, SAFETY=n+480;
    // Phase 1 — place all n EMIs (deferrals push them forward).
    while(emisPlaced<n && kk<SAFETY){
      kk++;
      var dueD=emiDueDate(l,kk); var key=_mk(dueD);
      var io=intOnlyByMonth[key]||0, ep=emiPayByMonth[key]||0;
      var chgM=chgAt(kk,key), lfM=lateAt(kk,key), intM=intAt(kk,key);
      if(io>0){ intIncome+=io; cumChg+=chgM; rows.push({i:'',due:dueD,emi:io,paid:io,lateFee:lfM,intFee:intM,charge:chgM,bal:Math.max(0,total-cumPaid)+cumChg,st:'Interest',isInt:true,defer:true}); continue; }
      var future=( _dl(dueD) >= t );
      if(ep>0.5 || future){
        emisPlaced++;
        var te=(emisPlaced<n)?emi:Math.max(0,total-emi*(n-1));
        var avail=ep+carry; var al=Math.min(te,avail); carry=Math.max(0,avail-te);
        cumPaid+=al; cumChg+=chgM;
        var st=(al>=te-0.5&&te>0)?'Paid':(al>0?'Partial':(dueD&&dueD<t?'Overdue':(dueD&&repDaysBetween(t,dueD)<=7?'Due soon':'Upcoming')));
        if(st==='Paid') paidCount++;
        rows.push({i:emisPlaced,due:dueD,emi:te,paid:al,lateFee:lfM,intFee:intM,charge:chgM,bal:Math.max(0,total-cumPaid)+cumChg,st:st,dueAmt:Math.max(0,te-al)});
      } else {
        // missed & past grace → deferral (interest + late fee only), EMI pushed forward
        cumChg+=chgM;
        rows.push({i:'',due:dueD,emi:0,paid:0,lateFee:lfM,intFee:intM,charge:chgM,bal:Math.max(0,total-cumPaid)+cumChg,st:'Deferred',defer:true,missed:true,dueAmt:Math.max(0,Math.round(chgM))});
      }
    }
    // Phase 2 — interest-accrual months after the last EMI, up to today / last payment / last charge.
    var horizonKey=todayKey;
    Object.keys(emiPayByMonth).forEach(function(k){ if(k>horizonKey) horizonKey=k; });
    Object.keys(intOnlyByMonth).forEach(function(k){ if(k>horizonKey) horizonKey=k; });
    if(latestChargeKey && latestChargeKey>horizonKey) horizonKey=latestChargeKey;
    while(kk<SAFETY){
      kk++;
      var dD=emiDueDate(l,kk); var mKey=_mk(dD);
      if(mKey && horizonKey && mKey>horizonKey && kk>latestChargeIdx) break;
      var io2=intOnlyByMonth[mKey]||0, ep2=emiPayByMonth[mKey]||0;
      var chg2=chgAt(kk,mKey), lf2=lateAt(kk,mKey), int2=intAt(kk,mKey);
      var owedNow=Math.max(0,total-cumPaid);
      if(owedNow<=0.5 && !(io2>0) && !(ep2>0) && !(chg2>0)){ if(mKey&&horizonKey&&mKey>=horizonKey&&kk>=latestChargeIdx) break; else continue; }
      if(io2>0){ intIncome+=io2; cumChg+=chg2; rows.push({i:'',due:dD,emi:io2,paid:io2,lateFee:lf2,intFee:int2,charge:chg2,bal:Math.max(0,total-cumPaid)+cumChg,st:'Interest',isInt:true,defer:true}); extCount++; continue; }
      var got=ep2+carry; var cr=Math.min(got,owedNow); carry=Math.max(0,got-owedNow);
      cumPaid+=cr; cumChg+=chg2;
      var bal2=Math.max(0,total-cumPaid)+cumChg;
      var st2=bal2<=0.5?'Paid':(ep2>0?'Partial':(chg2>0?'Overdue':(dD&&dD<t?'Overdue':'Upcoming')));
      rows.push({i:kk,due:dD,emi:0,paid:ep2,lateFee:lf2,intFee:int2,charge:chg2,bal:bal2,st:st2,dueAmt:Math.max(0,Math.round(chg2-ep2)),ext:true,accrual:true});
      extCount++;
      if(mKey&&horizonKey&&mKey>=horizonKey&&kk>=latestChargeIdx) break;
    }
    // Safety: fold any charge that never landed on a row into the final balance so it reconciles.
    var _lostChg=Math.round(totalChg-cumChg);
    if(_lostChg>0){ for(var zi=rows.length-1; zi>=0; zi--){ if(!rows[zi].isInt){ rows[zi].bal=(Number(rows[zi].bal)||0)+_lostChg; break; } } cumChg+=_lostChg; }
    var advance=Math.max(0, Math.round(carry));
    var deferCount=rows.filter(function(r){return r.missed;}).length;
    return {rows:rows,emi:emi,n:n,total:total,cleared:cleared,paidCount:paidCount,totalLate:totalLate,totalInt:totalInt,totalChg:totalChg,intCount:intPays.length,intIncome:intIncome,advance:advance,extCount:extCount,deferCount:deferCount};
  }
  /* A plain-language legend + reconciliation so a customer can understand the schedule at a glance.
     `pr` = print styling (smaller, letterhead colours) vs on-screen styling. */
  function repSchedLegend(D, l, pr){
    var monthInt = (typeof overdueMonthlyInterest==='function') ? overdueMonthlyInterest(l) : 0;
    var cleared = Number(D.cleared)||0, out=Number(l.outstanding)||0;
    var C = pr ? {wrap:'margin-top:9px;font-size:8.8px;line-height:1.38;color:#333;border-top:1px solid #c8a02a;padding-top:6px;',
                  h:'font-weight:700;color:#0b1f4b;font-size:10px;margin:0 0 3px;', b:'#0b1f4b',
                  sum:'margin-top:6px;padding:6px 9px;background:#faf7ef;border:1px solid #efe4c6;border-radius:6px;font-size:9px;'}
                : {wrap:'margin-top:16px;font-size:12.5px;line-height:1.6;color:var(--muted,#475467);',
                  h:'font-weight:700;color:var(--bnavy,#0b1f4b);font-size:13.5px;margin:0 0 6px;', b:'var(--bnavy,#0b1f4b)',
                  sum:'margin-top:10px;padding:10px 13px;background:#faf7ef;border:1px solid #efe4c6;border-radius:9px;font-size:12.5px;color:#3a2f10;'};
    var pt=function(term,desc){ return '<div style="margin:'+(pr?'1px':'2px')+' 0;"><b style="color:'+C.b+';">'+term+'</b> &mdash; '+desc+'</div>'; };
    var body=''
      + pt('EMI', 'the fixed monthly instalment of '+inr(D.emi)+'. This loan has '+D.n+' EMIs, '+inr(D.total)+' in all.')
      + pt('Paid / Partial', 'the instalment for that month was received in full / in part.')
      + pt('Deferred &middot; EMI moved forward', 'nothing was paid that month, so only that month&rsquo;s interest'+(monthInt>0?(' ('+inr(monthInt)+')'):'')+' and a late fee were added, and the instalment was pushed to a later month &mdash; the loan simply takes longer to close.')
      + pt('Upcoming / Due soon', 'an instalment that is still to fall due.')
      + pt('Charges column', 'shows two things for a month: <b>Late fee</b> &mdash; a flat penalty for a missed/late month; and <b>Interest</b> &mdash; that month&rsquo;s byaj on the balance. Both are added to the balance.')
      + pt('Balance', 'the total amount still owed after that month.');
    var sum = '<div style="'+C.sum+'"><b>How the outstanding of '+inr(out)+' is reached:</b><br>'
      + 'Total of '+D.n+' instalments '+inr(D.total)
      + (D.totalLate>0?(' &nbsp;+&nbsp; late fees '+inr(D.totalLate)):'')
      + (D.totalInt>0?(' &nbsp;+&nbsp; overdue interest '+inr(D.totalInt)):'')
      + ' &nbsp;&minus;&nbsp; amount paid '+inr(cleared)
      + ' &nbsp;=&nbsp; <b>Outstanding '+inr(out)+'</b>.'
      + (D.deferCount>0?('<br><span style="opacity:.85;">'+D.deferCount+' month'+(D.deferCount>1?'s were':' was')+' deferred, so the schedule runs beyond the original '+D.n+' months.</span>'):'')
      + '</div>';
    return '<div style="'+C.wrap+'"><div style="'+C.h+'">How to read this schedule</div>'+body+sum+'</div>';
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
      +(D.totalInt>0?repTile('Overdue interest',inr(D.totalInt),'bad'):'')
      +((D.intCount>0)?repTile('Interest serviced',D.intCount+' mo · '+inr(D.intIncome)):'')
      +((D.advance>0)?repTile('Advance / unscheduled',inr(D.advance)):'')
      +((D.extCount>0)?repTile('Beyond tenure',D.extCount+' month'+(D.extCount>1?'s':''),'bad'):'')
      +repTile('Paid / scheduled',paidCount+' / '+D.n,'ok')+'</div>';
    var chgCell=function(r){
      if(!(r.charge>0)) return '&mdash;';
      var parts=[];
      if(r.lateFee>0) parts.push('<span style="color:#8a5a00;">Late fee '+inr(r.lateFee)+'</span>');
      if(r.intFee>0) parts.push('<span style="color:#3f3d8f;">Interest '+inr(r.intFee)+'</span>');
      var extra=(r.charge-(r.lateFee||0)-(r.intFee||0)); if(extra>0.5) parts.push('Other '+inr(extra));
      return '<span style="font-size:11.5px;line-height:1.35;">'+parts.join('<br>')+'</span>';
    };
    var body=D.rows.map(function(r){
      if(r.isInt) return '<tr><td>·</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td class="right">'+inr(r.emi)+'</td><td class="right">'+inr(r.emi)+'</td><td class="right">'+(r.charge>0?chgCell(r):'&mdash;')+'</td><td class="right" style="color:#9aa3b2;">'+inr(r.bal)+'</td><td style="color:#4338ca;font-weight:600;">Interest paid &middot; EMI deferred</td></tr>';
      if(r.missed) return '<tr style="background:#fff7ed;"><td>·</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td class="right">&mdash;</td><td class="right">&mdash;</td><td class="right" style="color:'+(r.charge>0?'#b26a00':'inherit')+';">'+chgCell(r)+'</td><td class="right">'+inr(r.bal)+'</td><td style="color:#b26a00;font-weight:600;white-space:nowrap;">Deferred &middot; EMI moved forward</td></tr>';
      var stTxt=r.st+(((r.st==='Partial'||r.st==='Overdue') && r.dueAmt>0)?(' &middot; <span style="font-weight:600;">'+inr(r.dueAmt)+' due</span>'):'');
      var numCell=r.ext?(r.i+' <span style="font-size:10px;color:#b26a00;font-weight:600;">ext</span>'):r.i;
      var rowStyle=r.ext?' style="background:#fbf6e8;"':'';
      return '<tr'+rowStyle+'><td>'+numCell+'</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td class="right">'+(r.emi>0?inr(r.emi):'&mdash;')+'</td><td class="right">'+(r.paid>0?inr(r.paid):'&mdash;')+'</td><td class="right" style="color:'+(r.charge>0?'#b26a00':'inherit')+';">'+chgCell(r)+'</td><td class="right">'+inr(r.bal)+'</td><td style="color:'+repStColor(r.st)+';font-weight:600;white-space:nowrap;">'+stTxt+'</td></tr>';
    }).join('');
    var extNote=repSchedLegend(D,l,false);
    var coName=(l.gname||l.coborrower||'').toString().trim();
    var coLine=coName?('<div style="font-size:12.5px;color:var(--muted,#64748b);margin:-4px 0 8px;">Co-applicant / Guarantor: <b style="color:var(--bnavy,#0b1f4b);">'+esc(coName)+'</b></div>'):'';
    host.innerHTML = '<div style="font-weight:600; margin-bottom:8px;">'+esc(l.name)+' &mdash; A/C '+esc(l.acno||'')+'</div>'+coLine+tiles
      +'<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Due Date</th>'
      +'<th class="right">EMI</th><th class="right">Paid</th><th class="right">Charges</th><th class="right">Balance After</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table></div>'+extNote;
  }
  function repScheduleCSV(){
    var l=repScheduleLoan(); if(!l){ toast('Select a borrower first'); return; }
    var D=repScheduleData(l); if(!D.n){ toast('No tenure set'); return; }
    var data=D.rows.map(r=>[r.isInt?'·':(r.i+(r.ext?' (ext)':'')),fmtDate(r.due),r.emi,(r.isInt?0:r.paid),(r.isInt?0:(r.lateFee||0)),(r.isInt?0:(r.intFee||0)),(r.isInt?'—':(r.dueAmt||0)),(r.isInt?'—':r.bal),r.isInt?'Interest paid':r.st]);
    repCSV('EMI_Schedule_'+(l.acno||l.name||'loan')+'.csv', ['Installment','Due Date','EMI','Paid','Late Fee','Overdue Interest','Due','Balance After','Status'], data);
  }
  function repSchedulePrint(){
    var l=repScheduleLoan(); if(!l){ toast('Select a borrower first'); return; }
    var D=repScheduleData(l); if(!D.n){ toast('No tenure set'); return; }
    var _chg=function(r){ var parts=[]; if(r.lateFee>0) parts.push('Late fee '+inr(r.lateFee)); if(r.intFee>0) parts.push('Interest '+inr(r.intFee)); var extra=(Number(r.charge)||0)-(Number(r.lateFee)||0)-(Number(r.intFee)||0); if(extra>0.5) parts.push('Other '+inr(extra)); return parts.length?parts.join('<br>'):'&mdash;'; };
    var t='<table class="sched-tbl"><thead><tr><th>#</th><th>Due Date</th><th class="r">EMI</th><th class="r">Paid</th><th class="r">Charges (late fee / interest)</th><th class="r">Balance</th><th>Status</th></tr></thead><tbody>'
      + D.rows.map(function(r){
          if(r.isInt) return '<tr class="r-int"><td>&middot;</td><td>'+(r.due?fmtDate(r.due):'-')+'</td><td class="r">&mdash;</td><td class="r">'+inr(r.emi)+'</td><td class="r">'+_chg(r)+'</td><td class="r">'+inr(r.bal)+'</td><td>Interest paid (EMI deferred)</td></tr>';
          if(r.missed) return '<tr class="r-def"><td>&middot;</td><td>'+(r.due?fmtDate(r.due):'-')+'</td><td class="r">&mdash;</td><td class="r">&mdash;</td><td class="r">'+_chg(r)+'</td><td class="r">'+inr(r.bal)+'</td><td>Deferred (moved forward)</td></tr>';
          var stx=r.st+((r.dueAmt>0&&(r.st==="Partial"||r.st==="Overdue"))?(' — '+inr(r.dueAmt)+' due'):'');
          var cls=(r.st==='Paid')?'r-paid':((r.st==='Overdue')?'r-od':'');
          return '<tr'+(cls?(' class="'+cls+'"'):'')+'><td>'+r.i+(r.ext?'e':'')+'</td><td>'+(r.due?fmtDate(r.due):'-')+'</td><td class="r">'+(r.emi>0?inr(r.emi):'-')+'</td><td class="r">'+(r.paid>0?inr(r.paid):'-')+'</td><td class="r">'+_chg(r)+'</td><td class="r">'+inr(r.bal)+'</td><td>'+stx+'</td></tr>'; }).join('')
      + '</tbody></table>';
    // Fit everything on ONE page: shrink the table's type & row padding as the number of rows grows.
    var nRows=D.rows.length;
    var fs, pad;
    if(nRows<=16){ fs='11px'; pad='5px 9px'; }
    else if(nRows<=24){ fs='9.6px'; pad='3px 8px'; }
    else if(nRows<=34){ fs='8.4px'; pad='2.5px 7px'; }
    else if(nRows<=46){ fs='7.4px'; pad='2px 6px'; }
    else { fs='6.4px'; pad='1.5px 5px'; }
    var fit='<style>#reportPrint .sched-tbl{table-layout:fixed;width:100%;border-collapse:collapse;}'
      +'#reportPrint .sched-tbl th,#reportPrint .sched-tbl td{font-size:'+fs+'!important;padding:'+pad+'!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      +'#reportPrint .sched-tbl tbody tr:nth-child(even){background:#faf7ef;}'
      +'#reportPrint .sched-tbl tr.r-def td{color:#8a6d1f;background:#fbf4e0;font-style:italic;}'
      +'#reportPrint .sched-tbl tr.r-int td{color:#3f3d8f;background:#eef0fb;}'
      +'#reportPrint .sched-tbl tr.r-paid td:last-child{color:#0b7a4b;font-weight:600;}'
      +'#reportPrint .sched-tbl tr.r-od td:last-child{color:#b42318;font-weight:600;}'
      +'#reportPrint .sched-tbl td:nth-child(1),#reportPrint .sched-tbl th:nth-child(1){width:6%;}'
      +'#reportPrint .sched-tbl td:nth-child(2),#reportPrint .sched-tbl th:nth-child(2){width:13%;}'
      +'#reportPrint .sched-tbl td:nth-child(3),#reportPrint .sched-tbl th:nth-child(3){width:13%;}'
      +'#reportPrint .sched-tbl td:nth-child(4),#reportPrint .sched-tbl th:nth-child(4){width:13%;}'
      +'#reportPrint .sched-tbl td:nth-child(5),#reportPrint .sched-tbl th:nth-child(5){width:18%;white-space:normal;}'
      +'#reportPrint .sched-tbl td:nth-child(6),#reportPrint .sched-tbl th:nth-child(6){width:14%;}'
      +'#reportPrint .sched-tbl td:nth-child(7),#reportPrint .sched-tbl th:nth-child(7){width:23%;white-space:normal;}'
      +'@page{size:A4 portrait;margin:0;}</style>';
    var paidCount=D.paidCount;
    var coName=(l.gname||l.coborrower||'').toString().trim();
    var meta=[];
    if(coName) meta.push(['Co-applicant / Guarantor',coName]);
    meta.push(['EMI',inr(D.emi)],['Tenure',D.n+' months'],['Total of installments',inr(D.total)],['Paid / scheduled',paidCount+' / '+D.n]);
    if(D.totalLate>0) meta.push(['Late fees',inr(D.totalLate)]);
    if(D.totalInt>0) meta.push(['Overdue interest',inr(D.totalInt)]);
    if(D.extCount>0) meta.push(['Beyond tenure',D.extCount+' mo']);
    meta.push(['Outstanding',inr(Number(l.outstanding)||0)]);
    printReport('EMI Schedule', l.name+'  (A/C '+(l.acno||'')+')', meta, fit+t+repSchedLegend(D,l,true), _docFileName(l.name,l.acno,'EMI_Schedule'));
  }

