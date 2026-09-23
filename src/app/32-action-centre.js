/* ===========================================================================
 * src/app/32-action-centre.js
 *
 * "What needs doing today" — a work queue pinned to the top of the Dashboard.
 *
 * Four buckets, each a button that opens the actual list underneath, and every
 * row takes you straight to the place you'd act:
 *
 *   Overdue          → open that borrower
 *   Due this week    → open that borrower
 *   Pending cheques  → Payments ▸ register, filtered to pending
 *   Charges to apply → Payments ▸ Charges, with the borrower pre-selected
 *
 * It WRAPS renderDash rather than editing it, so the existing dashboard keeps
 * rendering exactly as before and this simply draws on top.
 * ======================================================================== */
(function () {
  var OPEN = null;                 // which bucket is expanded

  function _$(id){ return document.getElementById(id); }
  function _esc(s){ return (typeof esc==='function')?esc(s):String(s==null?'':s); }
  function _rs(v){ return (typeof inr==='function')?inr(v):String(v); }
  function _st(l){ return (typeof autoStatus==='function')?autoStatus(l):(l.status||''); }
  function _days(a,b){ if(!a||!b) return 0; return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000); }

  /* ---------- the four buckets ---------- */
  function _buckets(){
    var today=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);
    var all=(typeof loans!=='undefined'&&Array.isArray(loans))?loans:[];
    var overdue=[], soon=[], cheques=[], toCharge=[];

    all.forEach(function(l){
      var st=_st(l);
      if(st==='Closed') return;
      var out=Number(l.outstanding)||0;
      if(st==='Overdue'){
        overdue.push({ id:l.id, name:l.name||'', acno:l.acno||'', amt:out,
                       sub:(l.due?('due '+((typeof fmtDate==='function')?fmtDate(l.due):l.due)):'') });
      } else if(l.due){
        var d=_days(today,l.due);
        if(d>=0 && d<=7) soon.push({ id:l.id, name:l.name||'', acno:l.acno||'', amt:Math.round(Number(l.emi)||0),
                                     sub:(d===0?'due today':('in '+d+' day'+(d===1?'':'s'))) });
      }
      // cheques still to clear
      (l.payments||[]).forEach(function(p,idx){
        if(p && p.status==='Pending'){
          cheques.push({ id:l.id, name:l.name||'', acno:l.acno||'', amt:Number(p.amount)||0,
                         sub:'chq '+(p.cheque||'—')+(p.bank?(' · '+p.bank):'')+' · '+((typeof fmtDate==='function')?fmtDate(p.date):p.date), idx:idx });
        }
      });
      // overdue months that have not had their late fee raised yet
      try{
        if(typeof overdueEmiIdxs==='function'){
          var n=overdueEmiIdxs(l).length;
          var have=(l.charges||[]).filter(function(c){ return c&&c.type==='Late fee'&&c.emiIdx; }).length;
          var pend=n-have;
          if(pend>0) toCharge.push({ id:l.id, name:l.name||'', acno:l.acno||'', amt:0,
                                     sub:pend+' month'+(pend===1?'':'s')+' not yet charged' });
        }
      }catch(e){}
    });

    overdue.sort(function(a,b){ return b.amt-a.amt; });
    soon.sort(function(a,b){ return String(a.sub).localeCompare(String(b.sub)); });
    return { overdue:overdue, soon:soon, cheques:cheques, toCharge:toCharge };
  }

  /* ---------- actions ---------- */
  function _openBorrower(loanId){
    var all=(typeof loans!=='undefined')?loans:[];
    var l=all.find(function(x){ return String(x.id)===String(loanId); }); if(!l) return;
    try{ if(typeof go==='function') go('cust'); }catch(e){}
    try{ if(typeof renderCustomers==='function') renderCustomers(); }catch(e){}
    try{
      if(typeof custKeyOf==='function' && typeof openCustomer==='function'){
        openCustomer(encodeURIComponent(custKeyOf(l)));
      }
    }catch(e){}
  }
  window.acOpenBorrower=_openBorrower;
  window.acOpenCheques=function(){
    try{ if(typeof go==='function') go('pay'); }catch(e){}
    setTimeout(function(){
      var f=_$('payRegFilter'); if(f){ f.value='Pending'; }
      try{ if(typeof openPayRegister==='function') openPayRegister(); }catch(e){}
    }, 120);
  };
  window.acOpenCharges=function(loanId){
    try{ if(typeof go==='function') go('pay'); }catch(e){}
    setTimeout(function(){
      var s=_$('chg_loan');
      if(s){ s.value=String(loanId); try{ if(typeof chgLoanChange==='function') chgLoanChange(); }catch(e){}
             try{ s.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){} }
    }, 140);
  };
  window.acToggle=function(which){ OPEN=(OPEN===which)?null:which; render(); };

  /* ---------- render ---------- */
  function _rows(list, kind){
    if(!list.length) return '<div class="ac-none">Nothing here — all clear.</div>';
    return list.slice(0,12).map(function(r){
      var act = (kind==='cheques') ? 'acOpenCheques()'
              : (kind==='toCharge') ? ('acOpenCharges(\''+r.id+'\')')
              : ('acOpenBorrower(\''+r.id+'\')');
      return '<button type="button" class="ac-row" onclick="'+act+'">'
        +'<span class="ac-rn">'+_esc(r.name)+'<span class="ac-rs">'+_esc(r.acno)+(r.sub?(' · '+_esc(r.sub)):'')+'</span></span>'
        +(r.amt>0?('<span class="ac-ra">'+_rs(r.amt)+'</span>'):'')
        +'<span class="ac-go">→</span></button>';
    }).join('') + (list.length>12?('<div class="ac-none">…and '+(list.length-12)+' more</div>'):'');
  }

  function render(){
    var host=_$('dashMain'); if(!host) return;
    var main=_$('dashMain');
    if(main && main.style.display==='none'){ var ex0=_$('actionCentre'); if(ex0) ex0.remove(); return; }

    var b=_buckets();
    var total=b.overdue.length+b.soon.length+b.cheques.length+b.toCharge.length;

    var el=_$('actionCentre');
    if(!el){
      el=document.createElement('div');
      el.id='actionCentre'; el.className='panel ac-panel';
      host.insertBefore(el, host.firstChild);
    }
    if(!total){
      el.innerHTML='<div class="panel-head"><div class="t"><h3>Action Centre</h3>'
        +'<p>Nothing needs attention right now — no overdue accounts, no dues this week, no pending cheques.</p></div></div>';
      return;
    }
    var tile=function(key,label,list,tone){
      var amt=list.reduce(function(a,r){ return a+(Number(r.amt)||0); },0);
      return '<button type="button" class="ac-tile'+(OPEN===key?' open':'')+' '+tone+'" onclick="acToggle(\''+key+'\')">'
        +'<span class="ac-n">'+list.length+'</span>'
        +'<span class="ac-l">'+label+'</span>'
        +(amt>0?('<span class="ac-a">'+_rs(amt)+'</span>'):'<span class="ac-a">&nbsp;</span>')
        +'</button>';
    };
    el.innerHTML='<div class="panel-head"><div class="t"><h3>Action Centre</h3>'
      +'<p>What needs doing today. Click a box to see the list, then a row to go straight there.</p></div></div>'
      +'<div class="ac-tiles">'
      + tile('overdue','Overdue',b.overdue,'bad')
      + tile('soon','Due this week',b.soon,'warn')
      + tile('cheques','Pending cheques',b.cheques,'info')
      + tile('toCharge','Charges to apply',b.toCharge,'gold')
      +'</div>'
      + (OPEN?('<div class="ac-list">'+_rows(b[OPEN],OPEN)+'</div>'):'');
  }
  window.renderActionCentre=render;

  /* ---------- wrap renderDash so the queue refreshes with the dashboard ---------- */
  try{
    if(typeof renderDash==='function'){
      var _orig=renderDash;
      // eslint-disable-next-line no-global-assign
      renderDash=function(){
        var r=_orig.apply(this, arguments);
        try{ render(); }catch(e){}
        return r;
      };
    }
  }catch(e){}
})();
