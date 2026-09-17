/* ===== Restructure / Prepayment ===== */
(function(){
  var L=null; /* the loan being restructured */
  function monthsLeft(l){ var e=Number(l.emi)||0, o=outstandingOf(l); if(e<=0) return Number(l.tenure)||0; return Math.max(1, Math.round(o/e)); }
  function outstandingOf(l){ return Math.max(0, (Number(l.tpay)||0) - (Number(l.paid)||0)); }
  /* Remaining PRINCIPAL only (interest already paid is NOT carried forward).
     Flat loan: each EMI = (principal ÷ tenure) + (interest ÷ tenure). A payment covers that
     EMI's INTEREST first, then its principal — so a part-payment that only covers interest
     reduces no principal. We walk the cleared payments EMI-by-EMI and subtract the principal
     actually covered. (This matches how the schedule is read: ₹6,250 principal per full EMI,
     the ₹6,000 interest slice first.) Interest-only loans keep the full principal. */
  function remPrincipalOf(l){
    var P=Number(l.principal)||0; if(P<=0) return 0;
    if(l.interestOnly){ var b=Number(l.outstanding); return Math.max(0, Math.min(P, (b>0?b:P))); }
    var n=Math.round(Number(l.tenure)||0);
    var tp=Number(l.tpay)||0, out=outstandingOf(l);
    var cleared=Math.max(0, tp-out);                 // total cleared against the schedule
    if(n<=0 || tp<=0){ return Math.max(0, Math.min(P, out)); }
    var I=Number(l.tint); if(!(I>0)) I=Math.max(0, tp-P);
    var intPerEmi=I/n, prinPerEmi=P/n;
    var rem=cleared, prinPaid=0;
    for(var i=0;i<n && rem>0.0001;i++){
      var payInt=Math.min(rem, intPerEmi); rem-=payInt;              // interest slice first
      if(rem<=0.0001) break;
      var payPrin=Math.min(rem, prinPerEmi); prinPaid+=payPrin; rem-=payPrin;   // then principal
    }
    return Math.max(0, Math.min(P, Math.round(P - prinPaid)));
  }
  function _normName(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
  /* Other still-open loans belonging to the SAME borrower name (user ticks which to merge —
     names can repeat for different people, so selection is always manual). */
  function _rsSiblings(){ if(!L) return []; var n=_normName(L.name); return (loans||[]).filter(function(x){ return x && x.id!==L.id && _normName(x.name)===n && x.status!=='Closed' && outstandingOf(x)>0; }); }
  function _rsCombinePicked(){ var out=[]; var box=document.getElementById('rsCombineList'); if(!box) return out; [].forEach.call(box.querySelectorAll('input[type=checkbox][data-id]'), function(cb){ if(cb.checked && !cb.disabled){ var l=(loans||[]).find(function(x){return x.id===cb.getAttribute('data-id');}); if(l) out.push(l); } }); return out; }
  function _rsCombineActive(){ var on=document.getElementById('rsCombineOn'); return !!(on&&on.checked) && _rsCombinePicked().length>=1; }
  function _rsFillCombine(){
    var cb=document.getElementById('rsCombine'), cl=document.getElementById('rsCombineList'); if(!cb||!cl) return;
    var sibs=_rsSiblings();
    var on=document.getElementById('rsCombineOn'); if(on) on.checked=false;
    if(!sibs.length){ cb.style.display='none'; cl.innerHTML=''; return; }
    cb.style.display='block';
    cl.innerHTML=[L].concat(sibs).map(function(x){ var isCur=(x.id===L.id);
      return '<label style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;'+(isCur?'opacity:.8;':'cursor:pointer;')+'">'
        +'<span><input type="checkbox" data-id="'+esc(x.id)+'" '+(isCur?'checked disabled':'')+' onchange="calcRestructure()"> '+esc(x.acno||'')+(isCur?' <span class="ph-sub">(this loan)</span>':'')+'</span>'
        +'<span class="ph-sub">bal '+inr(outstandingOf(x))+' &middot; principal left '+inr(remPrincipalOf(x))+'</span></label>';
    }).join('');
  }
  window.openRestructure=function(id){
    var lid = id || (typeof editId!=='undefined' ? editId : null);
    if(!lid){ toast('Open or save a loan first, then restructure it'); return; }
    L=loans.find(function(x){return x.id===lid;}); if(!L){ toast('Loan not found'); return; }
    $('rs_amt').value=''; $('rs_ref').value=''; $('rs_memi').value=''; $('rs_mmonths').value='';
    $('rs_date').value=todayISO(); if($('rs_rate')) $('rs_rate').value=(L.rate!=null?L.rate:'');
    $('rs_mode').value='Cash';
    var r=document.querySelector('input[name="rsMode"][value="emi"]'); if(r) r.checked=true;
    $('rsManual').style.display='none';
    $('rsCurrent').innerHTML=
      '<div class="rs-who">'+esc(L.name||'')+' &nbsp;&middot;&nbsp; '+esc(L.acno||'')+'</div>'+
      '<div class="rs-stat"><div class="k">Outstanding</div><div class="v">'+inr(outstandingOf(L))+'</div></div>'+
      '<div class="rs-stat"><div class="k">EMI</div><div class="v">'+inr(L.emi||0)+'</div></div>'+
      '<div class="rs-stat"><div class="k">Months left</div><div class="v">'+monthsLeft(L)+'</div></div>'+
      '<div class="rs-stat"><div class="k">Rate p.m.</div><div class="v">'+(L.rate!=null?(L.rate+'%'):'&mdash;')+'</div></div>';
    // reset pending-dues list
    window._rsPending=[];
    if($('rsp_amt')) $('rsp_amt').value=''; if($('rsp_ref')) $('rsp_ref').value='';
    rsPendRender();
    _rsFillCombine();
    calcRestructure();
    $('rsOverlay').classList.add('show');
  };
  /* ---- pending / post-dated payments added during a restructure ---- */
  window._rsPending=window._rsPending||[];
  function rsPendRender(){
    var box=$('rsPendList'); if(!box) return; var arr=window._rsPending||[];
    if(!arr.length){ box.innerHTML=''; return; }
    box.innerHTML=arr.map(function(p,i){ return '<div class="rs-pend-row"><span><b>'+inr(p.amount)+'</b>'+(p.note?(' &middot; '+esc(p.note)):'')+' <span class="ph-sub">(added to the EMIs)</span></span><button class="rs-del" title="Remove" onclick="rsPendRemove('+i+')">&times;</button></div>'; }).join('');
  }
  window.rsPendRender=rsPendRender;
  window.rsPendAdd=function(){
    var amt=Math.round(Number(($('rsp_amt')||{}).value)||0);
    if(amt<=0){ toast('Enter a pending amount first'); return; }
    var note=(($('rsp_ref')||{}).value||'').trim();
    window._rsPending=window._rsPending||[];
    window._rsPending.push({amount:amt, note:note});
    if($('rsp_amt')) $('rsp_amt').value=''; if($('rsp_ref')) $('rsp_ref').value='';
    rsPendRender(); calcRestructure();
  };
  window.rsPendRemove=function(i){ if(window._rsPending){ window._rsPending.splice(i,1); rsPendRender(); calcRestructure(); } };
  window.closeRestructure=function(){ $('rsOverlay').classList.remove('show'); L=null; };
  window.rsManualEmi=function(){ if($('rs_memi').value) $('rs_mmonths').value=''; calcRestructure(); };
  window.rsManualMonths=function(){ if($('rs_mmonths').value) $('rs_memi').value=''; calcRestructure(); };

  function compute(){
    if(!L) return null;
    // Combine mode: merge the ticked loans — carry only each loan's remaining PRINCIPAL into
    // one new loan. Otherwise it's an ordinary single-loan restructure on the outstanding.
    var combine=_rsCombineActive();
    var combLoans=null, combinedPrincipal=0, principalPaid=0, totalPaid=0;
    var oldOut=outstandingOf(L);
    var base;
    if(combine){
      combLoans=[L].concat(_rsCombinePicked());
      combLoans.forEach(function(x){ var rp=remPrincipalOf(x); combinedPrincipal+=rp; principalPaid+=Math.max(0,(Number(x.principal)||0)-rp); totalPaid+=(Number(x.paid)||0); });
      base=combinedPrincipal;
    } else {
      base=oldOut;
    }
    var lumpEntered=Math.max(0, Number($('rs_amt').value)||0);
    /* A lump-sum can never exceed what is owed. Before this cap, an over-payment REWROTE the
       contract (tpay was inflated to paid+0) so the books claimed the customer owed more than
       the agreement — the excess must be handled as a separate refund/advance, not absorbed. */
    var lump=Math.min(lumpEntered, base);
    var overpay=Math.max(0, lumpEntered-base);
    var newOut=Math.max(0, base - lump);
    var mode=(document.querySelector('input[name="rsMode"]:checked')||{}).value||'emi';
    $('rsManual').style.display = (mode==='manual')?'grid':'none';
    var mLeft = combine ? Math.max.apply(null, [1].concat(combLoans.map(function(x){return monthsLeft(x);}))) : monthsLeft(L);
    var newEmi, newMonths;
    if(newOut<=0){ newEmi=0; newMonths=0; }
    else if(mode==='emi'){ newMonths=mLeft; newEmi=Math.ceil(newOut/mLeft); }
    else if(mode==='tenure'){ newEmi=Number(L.emi)||0; if(newEmi<=0) newEmi=Math.ceil(newOut/mLeft); newMonths=Math.ceil(newOut/newEmi); }
    else { /* manual */
      var mE=Number($('rs_memi').value)||0, mM=Number($('rs_mmonths').value)||0;
      if(mE>0){ newEmi=mE; newMonths=Math.ceil(newOut/mE); }
      else if(mM>0){ newMonths=mM; newEmi=Math.ceil(newOut/mM); }
      else { newMonths=mLeft; newEmi=Math.ceil(newOut/mLeft); }
    }
    // Optional FRESH interest. The remaining balance already contains the original
    // (flat) interest, so by default we add nothing — just re-spread the balance. But
    // if a rate is entered, charge fresh flat interest on the balance over the new
    // tenure (balance is treated as the new principal): interest = balance × rate × months.
    var raw=($('rs_rate')?String($('rs_rate').value):'');
    var freshRate=(raw==='')?0:Math.max(0, Number(raw)||0);
    var interest=0, newTotal=newOut;
    if(freshRate>0 && newMonths>0 && newOut>0){
      interest=Math.round(newOut*(freshRate/100)*newMonths);
      newTotal=newOut+interest;
      newEmi=Math.ceil(newTotal/newMonths);   // spread principal + fresh interest over the tenure
    }
    // Pending dues (e.g. unpaid interest for previous months) are ADDED to the new loan and
    // spread across the EMIs — so whether the tenure is 48 or 36, each EMI carries its share.
    var pendingTotal=(window._rsPending||[]).reduce(function(a,p){return a+(Number(p.amount)||0);},0);
    if(pendingTotal>0){
      if(newMonths<=0) newMonths=(mLeft>0?mLeft:1);
      newTotal=newTotal+pendingTotal;
      newEmi=Math.ceil(newTotal/newMonths);
    }
    var lastEmi = (newMonths>0) ? (newTotal - newEmi*(newMonths-1)) : 0;
    if(lastEmi<0) lastEmi=0;
    var newRate=(raw==='')?L.rate:freshRate;   // blank keeps the old rate label; a value sets it
    return { oldOut:oldOut, lump:lump, lumpEntered:lumpEntered, overpay:overpay, newOut:newOut, interest:interest, newTotal:newTotal, newEmi:newEmi, newMonths:newMonths, lastEmi:lastEmi, newRate:newRate, freshRate:freshRate, mode:mode,
      combine:combine, combLoans:combLoans, combinedPrincipal:combinedPrincipal, principalPaid:principalPaid, totalPaid:totalPaid, base:base, pendingTotal:pendingTotal };
  }
  window.calcRestructure=function(){
    var c=compute(); if(!c) return;
    var overLine = c.overpay>0 ? '<div style="color:#b00020;font-weight:700;margin-top:4px;">⚠ Amount entered exceeds the outstanding by '+inr(c.overpay)+'. Only '+inr(c.lump)+' will be applied — the excess must be returned to the customer (or recorded separately).</div>' : '';
    var lastLine = (c.newMonths>1 && c.lastEmi!==c.newEmi && c.lastEmi>0) ? '<div class="rs-row"><span>Final (last) EMI</span><span>'+inr(c.lastEmi)+'</span></div>' : '';
    var closed = c.newOut<=0 ? '<div style="color:#0b7a4b;font-weight:700;margin-top:4px;">This payment clears the loan — it will be marked closed.</div>' : '';
    // Plain-language breakdown so it's clear the EMIs paid so far AND this lump-sum are
    // already accounted for (outstanding = original total payable − everything paid).
    var interestOnlyLine = (c.interest>0) ? '<div class="rs-row"><span>Add: fresh interest @ '+c.freshRate+'% p.m. × '+c.newMonths+' months</span><span>+ '+inr(c.interest)+'</span></div>' : '';
    var pendLine = (c.pendingTotal>0) ? '<div class="rs-row"><span>Add: pending dues (spread across the EMIs)</span><span>+ '+inr(c.pendingTotal)+'</span></div>' : '';
    var totalLine = (c.interest>0 || c.pendingTotal>0) ? '<div class="rs-row"><span><b>New total payable</b></span><span class="rs-new">'+inr(c.newTotal)+'</span></div>' : '';
    var interestLines = interestOnlyLine + pendLine + totalLine;
    if(c.combine){
      var combHead='<b>Combining '+c.combLoans.length+' loans into one</b>'
        +'<div class="rs-row"><span>Combined remaining principal</span><span class="rs-new">'+inr(c.combinedPrincipal)+'</span></div>'
        +'<div class="rs-row"><span>Principal already repaid (all loans)</span><span>'+inr(c.principalPaid)+'</span></div>'
        +'<div class="rs-row"><span>Total amount paid so far (all loans)</span><span>'+inr(c.totalPaid)+'</span></div>'
        +'<div style="border-top:1px dashed #bcd;margin:8px 0;"></div>';
      $('rsAfter').innerHTML=combHead+
        (c.lump>0?'<div class="rs-row"><span>Less: lump-sum paid now ('+($('rs_mode').value)+')</span><span>− '+inr(c.lump)+'</span></div>':'')+
        '<div class="rs-row"><span><b>New combined loan principal</b></span><span class="rs-new">'+inr(c.newOut)+'</span></div>'+
        interestLines +
        '<div class="rs-row"><span>New EMI'+(c.interest>0?'':' (no fresh interest added)')+'</span><span class="rs-new">'+inr(c.newEmi)+'</span></div>'+
        '<div class="rs-row"><span>Months</span><span class="rs-new">'+c.newMonths+'</span></div>'+
        lastLine + overLine +
        '<div style="color:#0b7a4b;font-weight:600;margin-top:6px;">The '+c.combLoans.length+' old loans will be closed and one new combined loan will be created.</div>';
      return;
    }
    $('rsAfter').innerHTML='<b>After restructuring</b>'+
      '<div class="rs-row"><span>Current outstanding (interest already included)</span><span>'+inr(c.oldOut)+'</span></div>'+
      (c.lump>0?'<div class="rs-row"><span>Less: lump-sum paid now ('+($('rs_mode').value)+')</span><span>− '+inr(c.lump)+'</span></div>':'')+
      '<div class="rs-row"><span><b>Balance to re-plan</b></span><span class="rs-new">'+inr(c.newOut)+'</span></div>'+
      interestLines +
      '<div class="rs-row"><span>New EMI'+(c.interest>0?'':' (no fresh interest added)')+'</span><span class="rs-new">'+inr(c.newEmi)+'</span></div>'+
      '<div class="rs-row"><span>Months remaining</span><span class="rs-new">'+c.newMonths+'</span></div>'+
      lastLine + overLine + closed;
  };
  function applyCombine(c){
    if(!c||!L||!c.combLoans||c.combLoans.length<2){ toast('Select at least one more loan to combine'); return; }
    var acnos=c.combLoans.map(function(x){return x.acno||'';}).filter(Boolean);
    if(!confirm('Combine '+c.combLoans.length+' loans ('+acnos.join(', ')+') into ONE new loan?\n\nCombined principal: '+inr(c.newOut)+'\nNew EMI: '+inr(c.newEmi)+' × '+c.newMonths+' months'+(c.interest>0?('\nFresh interest: '+inr(c.interest)):'')+'\n\nThe old loans will be closed and a new combined loan created.')) return;
    var rsDate=$('rs_date').value||todayISO();
    try{ if(typeof snapBefore==='function') snapBefore('Before combine: '+acnos.join(',')); }catch(e){}
    var newAcno=(typeof nextLoanAcno==='function')?nextLoanAcno():('SE-'+Date.now());
    var due=(typeof repAddMonths==='function')?repAddMonths(rsDate,1):rsDate;
    // Carry the borrower's identity from the primary loan into the new combined loan.
    var COPY=['name','reltype','relname','phone','addr','ids','idproof','pan','type','secured','gname','gphone','coname','cophone','corel','coid','coaddr','age','residence','occupation','designation','officeaddr','propdesc','propaddr','proparea','propvalue','bN','bS','bE','bW','title','dealer','officer'];
    var rec={ id:'L'+Date.now()+Math.random().toString(36).slice(2,6), acno:newAcno };
    COPY.forEach(function(k){ if(L[k]!=null) rec[k]=L[k]; });
    rec.principal=Math.max(0, Math.round(c.newOut));
    rec.rate=(c.newRate!=null?c.newRate:0);
    rec.disb=rsDate; rec.due=due; rec.tenure=c.newMonths;
    rec.tint=Math.max(0, Math.round(c.interest||0));
    rec.tpay=Math.max(0, Math.round(c.newTotal));
    rec.emi=c.newEmi;
    rec.paid=0; rec.outstanding=rec.tpay; rec.status='Active';
    rec.payments=[]; rec.charges=[]; rec.interestOnly=false;
    rec.deductions=0; rec.downpay=0;
    rec.product=(L.product||'Combined loan');
    rec.combinedFrom=acnos.slice();
    rec.tint=Math.max(0, rec.tpay-rec.principal);   // interest = fresh interest + any pending dues folded in
    rec.remarks=('Combined from: '+acnos.join(', ')+(c.lump>0?(' | Prepaid at merge: '+inr(c.lump)):'')+(c.pendingTotal>0?(' | Pending dues added: '+inr(c.pendingTotal)):'')+((L.remarks)?(' | '+L.remarks):''));
    rec.createdAt=todayISO();
    try{ recomputeLoan(rec); }catch(e){}
    loans.unshift(rec);
    // Close every source loan by settling its remaining balance (the leftover interest not
    // carried forward is written off; only the principal moves into the new loan).
    c.combLoans.forEach(function(x){
      try{ recomputeLoan(x); }catch(e){}
      var settle=Math.max(0, Number(x.outstanding)||outstandingOf(x));
      x.payments=Array.isArray(x.payments)?x.payments:[];
      if(settle>0) x.payments.push({ pid:newPayId(), date:rsDate, mode:'Adjustment', amount:settle, status:'Cleared', note:'Merged into '+newAcno });
      x.mergedInto=newAcno;
      x.remarks=((x.remarks?x.remarks+' | ':'')+'Merged into '+newAcno+' on '+rsDate);
      try{ recomputeLoan(x); }catch(e){}
      x.status='Closed'; x.outstanding=0; x.arrears=0;
      loans=loans.map(function(y){return y.id===x.id?x:y;});
    });
    save();
    try{ logAudit('Loans Combined', acnos.join(', ')+' → '+newAcno+' · principal '+inr(rec.principal)+', EMI '+inr(rec.emi)+' × '+rec.tenure+'m'); }catch(e){}
    try{ renderLoans(); }catch(e){}
    try{ if(typeof renderDash==='function') renderDash(); }catch(e){}
    var snap=Object.assign({}, rec, {_c:c});
    closeRestructure(); try{ closeLoan(); }catch(e){}
    toast('Combined into new loan '+newAcno);
    if(confirm('Combined successfully into '+newAcno+'. Print the schedule for the new loan?')){
      try{ printSchedule(snap, { newOut:rec.principal, newTotal:rec.tpay, newEmi:rec.emi, newMonths:rec.tenure, lastEmi:(rec.tpay-rec.emi*(rec.tenure-1)), newRate:rec.rate, lump:0 }); }catch(e){}
    }
  }
  window.applyRestructure=function(){
    if(typeof can==='function' && !can('edit')){ toast('⚠ You do not have permission to restructure loans. Ask an administrator.'); return; }
    var c=compute(); if(!c||!L) return;
    if(c.combine){ return applyCombine(c); }
    var _pendN=(window._rsPending||[]).length;
    if(c.lump<=0 && c.newEmi===(Number(L.emi)||0) && _pendN===0){ toast('Nothing to change — add a payment, a new EMI/tenure, or a pending payment'); return; }
    if(c.overpay>0 && !confirm('The amount entered is '+inr(c.overpay)+' MORE than the outstanding balance.\n\nOnly '+inr(c.lump)+' will be recorded against this loan and it will be closed. The excess '+inr(c.overpay)+' is NOT recorded here — return it to the customer or record it separately.\n\nContinue?')) return;
    var rsDate=$('rs_date').value||todayISO();
    snapBefore('Before restructure: '+(L.acno||''));
    L.payments=L.payments||[];
    /* Preserve the ORIGINAL contract terms the first time the loan is ever restructured —
       reports (e.g. interest share = tint/tpay) and any future dispute need the signed figures. */
    if(L.tpay0==null){ L.tpay0=Number(L.tpay)||0; L.tint0=Number(L.tint)||0; L.tenure0=Number(L.tenure)||0; L.rate0=(L.rate!=null?L.rate:null); L.emi0=Number(L.emi)||0; }
    /* Append to a permanent restructure ledger — every event, not just the last date. */
    L.restructures=Array.isArray(L.restructures)?L.restructures:[];
    L.restructures.push({ date:rsDate, oldOut:c.oldOut, lump:c.lump, overpayRejected:c.overpay||0, newOut:c.newOut,
      oldEmi:Number(L.emi)||0, newEmi:c.newEmi, oldTenure:Number(L.tenure)||0, newTenure:c.newMonths,
      oldRate:(L.rate!=null?L.rate:null), newRate:(c.newRate!=null?c.newRate:null),
      arrearsAtRestructure:Number(L.arrears)||0, by:(typeof currentUser!=='undefined'&&currentUser&&currentUser.name)||'' });
    if(c.lump>0){
      L.payments.push({ pid:newPayId(), date:rsDate, mode:$('rs_mode').value, amount:c.lump, status:'Cleared', ref:$('rs_ref').value.trim(), note:'Prepayment (restructure)' });
      L.paid=(Number(L.paid)||0)+c.lump;
    }
    if(c.newRate!=null) L.rate=c.newRate;
    L.emi=c.newEmi;
    L.tenure=c.newMonths;
    // Rebase the going-forward schedule from today so the new (lower) EMI is spread over the remaining
    // months on the new outstanding — old payments no longer mark future installments as "Paid".
    L.baseDate=rsDate;
    L.baseOut=Math.max(0,c.newTotal);
    L.paidBase=Number(L.paid)||0;
    L.tpay=(Number(L.paid)||0)+Math.max(0,c.newTotal);   // total payable = paid so far + re-planned balance (+ any fresh interest)
    L.dueManual=false;
    L.deductions=Number(L.deductions)||0;
    L.outstanding=Math.max(0, c.newTotal);
    if(L.outstanding<=0) L.status='Closed';
    L.restructuredAt=rsDate;
    recomputeLoan(L);
    loans=loans.map(function(x){return x.id===L.id?L:x;});
    save(); logAudit('Loan Restructured', (L.name||'')+' ('+(L.acno||'')+') → EMI '+inr(c.newEmi)+', '+c.newMonths+'m'+(c.lump>0?', prepaid '+inr(c.lump):''));
    renderLoans(); if(typeof renderDash==='function') renderDash();
    var snap=Object.assign({}, L, {_c:c});
    closeRestructure(); closeLoan();
    toast('Loan restructured');
    if(confirm('Restructured successfully. Print a revised schedule for the customer?')) printSchedule(snap, c);
  };
  function printSchedule(l, c){
    var rows='', bal=c.newOut, d=new Date(($('rs_date')&&$('rs_date').value)||todayISO());
    for(var i=1;i<=c.newMonths;i++){
      d=new Date(d.getFullYear(), d.getMonth()+1, d.getDate());
      var pay=(i===c.newMonths)?c.lastEmi:c.newEmi; bal=Math.max(0,bal-pay);
      rows+='<tr><td>'+i+'</td><td>'+d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})+'</td><td style="text-align:right;">₹'+(pay).toLocaleString('en-IN')+'</td><td style="text-align:right;">₹'+bal.toLocaleString('en-IN')+'</td></tr>';
    }
    var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+_docFileName(l.name,l.acno,'Revised_Schedule')+'</title><style>'+
      (typeof docBrandCSS==='function'?docBrandCSS():'')+
      'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141414;margin:32px;line-height:1.6;}'+
      '.name{font-size:24px;font-weight:bold;letter-spacing:1px;text-align:center;color:#0b1f4b;}'+
      '.addr{text-align:center;font-size:11px;color:#444;margin:4px 0 2px;}'+
      '.rule{border-bottom:2px solid #c8a02a;margin:8px 0 18px;}'+
      'h2{text-align:center;font-size:16px;margin:14px 0;text-decoration:underline;letter-spacing:.5px;}'+
      '.meta{font-size:12.5px;margin:6px 0;}.meta b{color:#0b1f4b;} table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;}'+
      'th,td{border:1px solid #bbb;padding:6px 10px;} th{background:#0b1f4b;color:#fff;text-align:left;}'+
      '.foot{margin-top:24px;font-size:11px;color:#555;font-style:italic;text-align:center;border-top:1px solid #c8a02a;padding-top:6px;}'+
      '</style></head><body>'+
      (typeof docBrandHTML==='function'?docBrandHTML(false):'')+
      '<div class="name">'+esc(FIRM().name)+'</div>'+
      '<div class="addr">'+esc(firmAddrLine())+'<br>'+esc(firmRegLine())+'</div>'+
      '<div class="rule"></div><h2>Revised Repayment Schedule</h2>'+
      '<div class="meta"><b>Borrower:</b> '+(l.name||'')+'</div>'+
      '<div class="meta"><b>Loan A/c:</b> '+(l.acno||'')+'</div>'+
      '<div class="meta"><b>Date of revision:</b> '+new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})+'</div>'+
      (c.lump>0?'<div class="meta"><b>Payment received:</b> ₹'+c.lump.toLocaleString('en-IN')+' ('+($('rs_mode').value)+')</div>':'')+
      '<div class="meta"><b>Revised outstanding:</b> ₹'+c.newOut.toLocaleString('en-IN')+' &nbsp;|&nbsp; <b>EMI:</b> ₹'+c.newEmi.toLocaleString('en-IN')+' &nbsp;|&nbsp; <b>Tenure:</b> '+c.newMonths+' months'+(c.newRate!=null?' &nbsp;|&nbsp; <b>Rate:</b> '+c.newRate+'% p.m.':'')+'</div>'+
      '<table><thead><tr><th>#</th><th>Due date</th><th>EMI</th><th>Balance</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="foot">This is a computer-generated revised schedule. For Shivam Enterprises.</div>'+
      '</body></html>';
    var f=document.createElement('iframe'); f.style.position='fixed'; f.style.right='0'; f.style.bottom='0'; f.style.width='0'; f.style.height='0'; f.style.border='0';
    document.body.appendChild(f);
    var doc=f.contentWindow.document; doc.open(); doc.write(html); doc.close();
    setTimeout(function(){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} setTimeout(function(){ f.remove(); }, 1500); }, 350);
  }
  window._printSchedule=printSchedule;
})();
