/* ===========================================================================
 * src/app/29-bulk-entry.js
 *
 * Two tools for entering history quickly — built on top of the ordinary payment
 * record, so everything they create is an ORDINARY payment (receipts, schedule,
 * statement, reminders and reports all behave exactly as hand-typed entries).
 *
 *  1) BULK ENTRY — pick a borrower and a month range; the app lays out one row
 *     per month pre-filled with that month's due date and the EMI. EVERY row's
 *     date and amount stays editable, each row can be ticked/unticked or marked
 *     interest-only, and one "Save all" writes them together. Months that
 *     already have a payment are flagged and left unticked so nothing doubles.
 *     The batch is tagged so it can be undone in one click.
 *
 *  2) RAPID ENTRY — pressing Enter in the Record-a-Payment form saves the
 *     payment; with "Rapid entry" ticked it then rolls the date forward a month
 *     and re-fills the EMI, so a year of payments is a run of Enter presses.
 *
 * Public: openBulkEntry / closeBulkEntry / bulkBuild / bulkApplyAmount /
 *         bulkApplyDates / bulkTickAll / bulkEdit / bulkSave / bulkUndo
 * ======================================================================== */
(function () {
  var BR = [];                 // preview rows for the chosen borrower/range
  var _lastBatch = null;       // { loanId, batch, n } — for one-click undo

  function _$(id){ return document.getElementById(id); }
  function _loans(){ return (typeof loans !== 'undefined' && Array.isArray(loans)) ? loans : []; }
  function _loan(){ var s=_$('bulk_loan'); if(!s||!s.value) return null; return _loans().find(function(x){return String(x.id)===String(s.value);})||null; }
  function _rs(v){ return (typeof inr==='function')?inr(v):('₹'+(Math.round(Number(v)||0))); }

  /* ---------- small month helpers (YYYY-MM) ---------- */
  function _ym(iso){ var m=String(iso||'').match(/^(\d{4})-(\d{2})/); return m?(m[1]+'-'+m[2]):''; }
  function _ymAdd(ym, n){
    var p=String(ym||'').split('-'); if(p.length<2) return '';
    var y=+p[0], mo=(+p[1])-1+n;
    var ny=y+Math.floor(mo/12), nm=((mo%12)+12)%12;
    return ny+'-'+(nm+1<10?'0':'')+(nm+1);
  }
  function _ymDiff(a,b){ // months from a to b
    var pa=String(a||'').split('-'), pb=String(b||'').split('-');
    if(pa.length<2||pb.length<2) return 0;
    return ((+pb[0])-(+pa[0]))*12 + ((+pb[1])-(+pa[1]));
  }
  function _daysIn(y,m){ return new Date(y, m, 0).getDate(); }          // m = 1-12
  function _dateIn(ym, day){
    var p=String(ym||'').split('-'); if(p.length<2) return '';
    var y=+p[0], m=+p[1], d=Math.min(Math.max(1,day|0), _daysIn(y,m));
    return y+'-'+(m<10?'0':'')+m+'-'+(d<10?'0':'')+d;
  }
  function _dueDay(l){
    try{
      if(typeof emiDueDate==='function'){
        var d=emiDueDate(l,1); var m=String(d||'').match(/^\d{4}-\d{2}-(\d{2})/);
        if(m) return +m[1];
      }
    }catch(e){}
    var s=String(l&&(l.due||l.disb)||''); var mm=s.match(/^\d{4}-\d{2}-(\d{2})/);
    return mm?(+mm[1]):1;
  }
  function _todayYM(){ return _ym((typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10)); }

  /* Amount already received in a given calendar month (any status) — so months
     that are already recorded can be flagged and left unticked. */
  function _paidInMonth(l, ym){
    return (l.payments||[]).filter(function(p){ return p && _ym(p.date)===ym; })
      .reduce(function(a,p){ return a+(Number(p.amount)||0); }, 0);
  }

  /* ---------- open / close ---------- */
  window.openBulkEntry = function(){
    var sel=_$('bulk_loan');
    if(sel){
      var cur=sel.value;
      var list=_loans().slice().sort(function(a,b){ return String(a.name||'').localeCompare(String(b.name||'')); });
      sel.innerHTML='<option value="">— Select a borrower —</option>'+list.map(function(l){
        return '<option value="'+l.id+'">'+(typeof esc==='function'?esc(l.name):l.name)+' ('+(typeof esc==='function'?esc(l.acno||''):(l.acno||''))+')</option>';
      }).join('');
      if(cur) sel.value=cur;
      // carry over the borrower chosen on the Record-a-Payment form, if any
      if(!sel.value){ var pb=_$('payb_loan'); if(pb&&pb.value) sel.value=pb.value; }
    }
    var ov=_$('bulkOverlay'); if(ov) ov.style.display='flex';
    bulkDefaults();
    window.bulkBuild();
  };
  window.closeBulkEntry = function(){ var ov=_$('bulkOverlay'); if(ov) ov.style.display='none'; };

  /* Sensible defaults for the chosen loan: first EMI month → last month gone by. */
  function bulkDefaults(){
    var l=_loan(); if(!l) return;
    var first='', last=_todayYM();
    try{ first=_ym(emiDueDate(l,1)); }catch(e){}
    if(!first) first=_ymAdd(_ym(l.disb||l.due||''),1);
    var f=_$('bulk_from'), tt=_$('bulk_to'), a=_$('bulk_amt'), dr=_$('bulk_dayrule');
    if(f && !f.value) f.value=first;
    if(tt && !tt.value) tt.value=last;
    if(a && !a.value) a.value=Math.round(Number(l.emi)||0)||'';
    if(dr && !dr.value) dr.value='due';
  }

  /* ---------- build the editable preview ---------- */
  window.bulkBuild = function(){
    var body=_$('bulkBody'); if(!body) return;
    var l=_loan();
    BR=[];
    if(!l){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:18px;">Select a borrower to lay out the months.</td></tr>'; bulkSummary(); return; }
    bulkDefaults();
    var from=(_$('bulk_from')||{}).value||'', to=(_$('bulk_to')||{}).value||'';
    if(!from||!to||_ymDiff(from,to)<0){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:18px;">Choose a valid month range.</td></tr>'; bulkSummary(); return; }
    var months=_ymDiff(from,to)+1;
    if(months>240) months=240;                       // safety bound
    var amt=Math.round(Number((_$('bulk_amt')||{}).value)||0) || Math.round(Number(l.emi)||0);
    var rule=(_$('bulk_dayrule')||{}).value||'due';
    var dd=_dueDay(l);
    for(var i=0;i<months;i++){
      var ym=_ymAdd(from,i);
      var day=(rule==='due')?dd:(parseInt(rule,10)||dd);
      var already=_paidInMonth(l,ym);
      BR.push({ ym:ym, date:_dateIn(ym,day), amount:amt, use:(already<=0.5), intOnly:false, already:already });
    }
    bulkRender();
  };

  function bulkRender(){
    var body=_$('bulkBody'); if(!body) return;
    body.innerHTML=BR.map(function(r,i){
      var lbl=(function(){ var p=r.ym.split('-'); var mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][(+p[1])-1]||''; return mn+' '+p[0]; })();
      var note=(r.already>0.5)?('<span class="bulk-note">already recorded '+_rs(r.already)+'</span>'):'';
      return '<tr'+((r.already>0.5)?' class="bulk-dim"':'')+'>'
        +'<td><input type="checkbox" '+(r.use?'checked':'')+' onchange="bulkEdit('+i+',\'use\',this.checked)"></td>'
        +'<td class="bulk-mon">'+lbl+'</td>'
        +'<td><input class="bulk-in" type="date" value="'+r.date+'" onchange="bulkEdit('+i+',\'date\',this.value)"></td>'
        +'<td class="right"><input class="bulk-in num" type="number" min="0" value="'+(r.amount||'')+'" onchange="bulkEdit('+i+',\'amount\',this.value)" oninput="bulkEdit('+i+',\'amount\',this.value,1)"></td>'
        +'<td style="text-align:center;"><input type="checkbox" '+(r.intOnly?'checked':'')+' onchange="bulkEdit('+i+',\'intOnly\',this.checked)" title="Only the month\'s interest was paid — the EMI defers"></td>'
        +'<td>'+note+'</td>'
        +'</tr>';
    }).join('');
    bulkSummary();
  }

  window.bulkEdit = function(i, field, val, quiet){
    var r=BR[i]; if(!r) return;
    if(field==='amount') r.amount=Math.max(0, Math.round(Number(val)||0));
    else if(field==='date') r.date=String(val||'');
    else r[field]=!!val;
    bulkSummary();
    if(!quiet && field==='use'){ /* keep the row markup in sync for dimming only */ }
  };

  function bulkSummary(){
    var el=_$('bulkSummary'); if(!el) return;
    var picked=BR.filter(function(r){ return r.use && Number(r.amount)>0; });
    var tot=picked.reduce(function(a,r){ return a+Number(r.amount||0); },0);
    var l=_loan();
    var extra='';
    if(l){
      var out=Number(l.outstanding)||0;
      extra=' &nbsp;·&nbsp; outstanding now '+_rs(out)+' → '+_rs(Math.max(0,out-tot))+' after';
      if(tot>out+0.5) extra+=' &nbsp;<span class="bulk-warn">⚠ that is '+_rs(tot-out)+' more than is owed</span>';
    }
    el.innerHTML='<b>'+picked.length+'</b> month(s) ticked &nbsp;·&nbsp; total <b>'+_rs(tot)+'</b>'+extra;
  }

  window.bulkApplyAmount = function(){
    var amt=Math.round(Number((_$('bulk_amt')||{}).value)||0);
    if(amt<=0) return;
    BR.forEach(function(r){ r.amount=amt; });
    bulkRender();
  };
  window.bulkApplyDates = function(){
    var l=_loan(); if(!l) return;
    var rule=(_$('bulk_dayrule')||{}).value||'due';
    var dd=_dueDay(l);
    BR.forEach(function(r){ var day=(rule==='due')?dd:(parseInt(rule,10)||dd); r.date=_dateIn(r.ym,day); });
    bulkRender();
  };
  window.bulkTickAll = function(v){ BR.forEach(function(r){ r.use=!!v; }); bulkRender(); };

  /* ---------- save / undo ---------- */
  window.bulkSave = function(){
    var l=_loan(); if(!l){ if(typeof toast==='function') toast('Choose a borrower first'); return; }
    var picked=BR.filter(function(r){ return r.use && Number(r.amount)>0 && r.date; });
    if(!picked.length){ if(typeof toast==='function') toast('Nothing ticked to save'); return; }
    var tot=picked.reduce(function(a,r){ return a+Number(r.amount||0); },0);
    var _out=Number(l.outstanding)||0;
    if(tot>_out+0.5 && !confirm('Careful: these '+picked.length+' payment(s) total '+_rs(tot)+', which is '+_rs(tot-_out)+' MORE than the '+_rs(_out)+' still owed by '+(l.name||'')+'.\n\nRecord them anyway?')) return;
    if(!confirm('Record '+picked.length+' payment(s) totalling '+_rs(tot)+' for '+(l.name||'')+'?\n\nThey are saved as ordinary payments and can be edited or removed individually afterwards.')) return;
    var mode=(_$('bulk_mode')||{}).value||'Cash';
    var batch='B'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    if(!Array.isArray(l.payments)) l.payments=[];
    var added=0, skipped=0;
    picked.forEach(function(r){
      var p={ pid:(typeof newPayId==='function'?newPayId():('P'+Date.now().toString(36)+Math.random().toString(36).slice(2,8))),
              date:r.date, mode:mode, amount:Math.round(Number(r.amount)||0),
              cheque:'', bank:'', ref:'', status:'Cleared', bulkId:batch };
      if(r.intOnly){ p.intOnly=true; p.type='Interest'; }
      try{ if(typeof isDuplicatePayment==='function' && isDuplicatePayment(l,p)){ skipped++; return; } }catch(e){}
      l.payments.push(p); added++;
    });
    if(added){
      try{ recomputeLoan(l); }catch(e){}
      try{ save(); }catch(e){}
      try{ logAudit('Bulk Payments Added', added+' payment(s) '+_rs(tot)+' — '+(l.name||'')+' ('+(l.acno||'')+')'); }catch(e){}
      _lastBatch={ loanId:l.id, batch:batch, n:added };
      var ub=_$('bulkUndoBtn'); if(ub) ub.style.display='';
    }
    try{ renderPayReg(); }catch(e){}
    try{ refreshPayLoanDropdown(); }catch(e){}
    try{ if(typeof updateRegCards==='function') updateRegCards(); }catch(e){}
    try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}
    window.bulkBuild();                                   // re-flag the months now recorded
    if(typeof toast==='function') toast(added+' payment(s) recorded'+(skipped?(' — '+skipped+' skipped as duplicates'):''), 5000);
  };

  window.bulkUndo = function(){
    if(!_lastBatch){ if(typeof toast==='function') toast('Nothing to undo'); return; }
    var l=_loans().find(function(x){ return String(x.id)===String(_lastBatch.loanId); });
    if(!l){ _lastBatch=null; return; }
    if(!confirm('Remove the '+_lastBatch.n+' payment(s) added in the last bulk entry for '+(l.name||'')+'?')) return;
    var b=_lastBatch.batch;
    l.payments=(l.payments||[]).filter(function(p){ return !(p && p.bulkId===b); });
    try{ recomputeLoan(l); }catch(e){}
    try{ save(); }catch(e){}
    try{ logAudit('Bulk Payments Undone', _lastBatch.n+' payment(s) — '+(l.name||'')); }catch(e){}
    _lastBatch=null;
    var ub=_$('bulkUndoBtn'); if(ub) ub.style.display='none';
    try{ renderPayReg(); }catch(e){}
    try{ if(typeof updateRegCards==='function') updateRegCards(); }catch(e){}
    try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}
    window.bulkBuild();
    if(typeof toast==='function') toast('Bulk entry undone');
  };

  /* ================= RAPID ENTRY (Enter saves) ================= */
  function _addMonthISO(iso, n){
    var m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m) return iso;
    var y=+m[1], mo=+m[2], d=+m[3];
    var idx=(mo-1)+n, ny=y+Math.floor(idx/12), nm=((idx%12)+12)%12;
    var day=Math.min(d, _daysIn(ny, nm+1));
    return ny+'-'+(nm+1<10?'0':'')+(nm+1)+'-'+(day<10?'0':'')+day;
  }
  function _rapidAdvance(){
    var sel=_$('payb_loan'); if(!sel||!sel.value) return;
    var l=_loans().find(function(x){ return String(x.id)===String(sel.value); }); if(!l) return;
    var d=_$('payb_date'); if(d&&d.value) d.value=_addMonthISO(d.value,1);
    var a=_$('payb_amt');
    if(a){ var e=Math.round(Number(l.emi)||0); a.value=e>0?e:''; try{ a.focus(); a.select(); }catch(err){} }
  }
  // Enter anywhere in the Record-a-Payment form saves it. If "Rapid entry" is on,
  // the date then rolls forward a month and the EMI is re-filled, ready for the next.
  window.payEnterSave = function(){
    var a=_$('payb_amt'); var before=a?String(a.value):'';
    if(before===''){ if(typeof toast==='function') toast('Enter a payment amount'); return; }
    // The form keeps a short double-click guard. When Enter is pressed faster than that,
    // QUEUE the save instead of dropping it — otherwise a rapid entry would silently vanish.
    try{
      if(typeof recordPayTab==='function' && recordPayTab._busy){
        if(window.payEnterSave._q) return;
        window.payEnterSave._q=setTimeout(function(){ window.payEnterSave._q=null; window.payEnterSave(); }, 430);
        return;
      }
    }catch(e){}
    try{ recordPayTab(); }catch(e){ return; }
    var after=a?String(a.value):'';
    if(after===''){                                     // recordPayTab clears it only on success
      var rp=_$('payb_rapid');
      if(rp && rp.checked) _rapidAdvance();
    }
  };
  document.addEventListener('keydown', function(e){
    if(e.key!=='Enter' || e.shiftKey) return;
    var t=e.target; if(!t || !t.closest) return;
    if(t.tagName==='BUTTON' || t.tagName==='TEXTAREA') return;
    // 1) the Record-a-Payment form → save
    if(t.closest('#sec-pay .pay-form')){ e.preventDefault(); window.payEnterSave(); return; }
    // 2) inside the bulk grid → move down the same column
    var cell=t.closest && t.closest('#bulkBody td');
    if(cell && t.closest('#bulkBody')){
      e.preventDefault();
      var tr=cell.parentNode, col=Array.prototype.indexOf.call(tr.children, cell);
      var nxt=tr.nextElementSibling;
      if(nxt && nxt.children[col]){ var inp=nxt.children[col].querySelector('input'); if(inp){ inp.focus(); try{ inp.select(); }catch(err){} } }
    }
  });
})();
