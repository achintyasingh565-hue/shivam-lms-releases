/* ===== Restructure / Prepayment ===== */
(function(){
  var L=null; /* the loan being restructured */
  function monthsLeft(l){ var e=Number(l.emi)||0, o=outstandingOf(l); if(e<=0) return Number(l.tenure)||0; return Math.max(1, Math.round(o/e)); }
  function outstandingOf(l){ return Math.max(0, (Number(l.tpay)||0) - (Number(l.paid)||0)); }
  window.openRestructure=function(id){
    var lid = id || (typeof editId!=='undefined' ? editId : null);
    if(!lid){ toast('Open or save a loan first, then restructure it'); return; }
    L=loans.find(function(x){return x.id===lid;}); if(!L){ toast('Loan not found'); return; }
    $('rs_amt').value=''; $('rs_ref').value=''; $('rs_memi').value=''; $('rs_mmonths').value='';
    $('rs_date').value=todayISO(); $('rs_rate').value=(L.rate!=null?L.rate:'');
    $('rs_mode').value='Cash';
    var r=document.querySelector('input[name="rsMode"][value="emi"]'); if(r) r.checked=true;
    $('rsManual').style.display='none';
    $('rsCurrent').innerHTML='<b>Current loan</b> &nbsp; '+esc(L.name||'')+' &nbsp;·&nbsp; '+esc(L.acno||'')+
      '<div class="rs-row"><span>Outstanding</span><span>'+inr(outstandingOf(L))+'</span></div>'+
      '<div class="rs-row"><span>EMI</span><span>'+inr(L.emi||0)+'</span></div>'+
      '<div class="rs-row"><span>Months remaining (approx.)</span><span>'+monthsLeft(L)+'</span></div>'+
      '<div class="rs-row"><span>Interest rate</span><span>'+(L.rate!=null?L.rate+'% p.m.':'—')+'</span></div>';
    calcRestructure();
    $('rsOverlay').classList.add('show');
  };
  window.closeRestructure=function(){ $('rsOverlay').classList.remove('show'); L=null; };
  window.rsManualEmi=function(){ if($('rs_memi').value) $('rs_mmonths').value=''; calcRestructure(); };
  window.rsManualMonths=function(){ if($('rs_mmonths').value) $('rs_memi').value=''; calcRestructure(); };

  function compute(){
    if(!L) return null;
    var oldOut=outstandingOf(L);
    var lumpEntered=Math.max(0, Number($('rs_amt').value)||0);
    /* A lump-sum can never exceed what is owed. Before this cap, an over-payment REWROTE the
       contract (tpay was inflated to paid+0) so the books claimed the customer owed more than
       the agreement — the excess must be handled as a separate refund/advance, not absorbed. */
    var lump=Math.min(lumpEntered, oldOut);
    var overpay=Math.max(0, lumpEntered-oldOut);
    var newOut=Math.max(0, oldOut - lump);
    var mode=(document.querySelector('input[name="rsMode"]:checked')||{}).value||'emi';
    $('rsManual').style.display = (mode==='manual')?'grid':'none';
    var mLeft=monthsLeft(L);
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
    var lastEmi = (newMonths>0) ? (newOut - newEmi*(newMonths-1)) : 0;
    if(lastEmi<0) lastEmi=0;
    var newRate=$('rs_rate').value!==''?Number($('rs_rate').value):L.rate;
    if(newRate!=null && (!isFinite(Number(newRate)) || Number(newRate)<0)){ newRate=L.rate; } /* never accept a negative/garbage rate */
    return { oldOut:oldOut, lump:lump, lumpEntered:lumpEntered, overpay:overpay, newOut:newOut, newEmi:newEmi, newMonths:newMonths, lastEmi:lastEmi, newRate:newRate, mode:mode };
  }
  window.calcRestructure=function(){
    var c=compute(); if(!c) return;
    var overLine = c.overpay>0 ? '<div style="color:#b00020;font-weight:700;margin-top:4px;">⚠ Amount entered exceeds the outstanding by '+inr(c.overpay)+'. Only '+inr(c.lump)+' will be applied — the excess must be returned to the customer (or recorded separately).</div>' : '';
    var rateLine = (c.newRate!=L.rate) ? '<div class="rs-row"><span>Interest rate</span><span class="rs-new">'+(c.newRate!=null?c.newRate+'% p.m.':'—')+'</span></div>' : '';
    var lastLine = (c.newMonths>1 && c.lastEmi!==c.newEmi && c.lastEmi>0) ? '<div class="rs-row"><span>Final (last) EMI</span><span>'+inr(c.lastEmi)+'</span></div>' : '';
    var closed = c.newOut<=0 ? '<div style="color:#0b7a4b;font-weight:700;margin-top:4px;">This payment clears the loan — it will be marked closed.</div>' : '';
    $('rsAfter').innerHTML='<b>After restructuring</b>'+
      (c.lump>0?'<div class="rs-row"><span>Payment received</span><span>'+inr(c.lump)+' ('+($('rs_mode').value)+')</span></div>':'')+
      '<div class="rs-row"><span>New outstanding</span><span class="rs-new">'+inr(c.newOut)+'</span></div>'+
      '<div class="rs-row"><span>New EMI</span><span class="rs-new">'+inr(c.newEmi)+'</span></div>'+
      '<div class="rs-row"><span>Months remaining</span><span class="rs-new">'+c.newMonths+'</span></div>'+
      lastLine + rateLine + overLine + closed;
  };
  window.applyRestructure=function(){
    if(typeof can==='function' && !can('edit')){ toast('⚠ You do not have permission to restructure loans. Ask an administrator.'); return; }
    var c=compute(); if(!c||!L) return;
    if(c.lump<=0 && c.newEmi===(Number(L.emi)||0) && c.newRate===L.rate){ toast('Nothing to change — enter a payment, new EMI, tenure or rate'); return; }
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
    L.baseOut=c.newOut;
    L.paidBase=Number(L.paid)||0;
    L.tpay=(Number(L.paid)||0)+Math.max(0,c.newOut);
    L.dueManual=false;
    L.deductions=Number(L.deductions)||0;
    L.outstanding=Math.max(0, c.newOut);
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
      'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141414;margin:32px;line-height:1.6;}'+
      '.name{font-size:24px;font-weight:bold;letter-spacing:1px;text-align:center;color:#0b1f4b;}'+
      '.addr{text-align:center;font-size:11px;color:#444;margin:4px 0 2px;}'+
      '.rule{border-bottom:2px solid #c8a02a;margin:8px 0 18px;}'+
      'h2{text-align:center;font-size:16px;margin:14px 0;text-decoration:underline;letter-spacing:.5px;}'+
      '.meta{font-size:12.5px;margin:6px 0;}.meta b{color:#0b1f4b;} table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;}'+
      'th,td{border:1px solid #bbb;padding:6px 10px;} th{background:#0b1f4b;color:#fff;text-align:left;}'+
      '.foot{margin-top:24px;font-size:11px;color:#555;font-style:italic;text-align:center;border-top:1px solid #c8a02a;padding-top:6px;}'+
      '</style></head><body>'+
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
