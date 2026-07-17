  /* ---------- loan table ---------- */
  function renderLoans(){
    /* Loan records live inside Customers & Loans: refresh the borrower list and the open profile */
    try{ renderCustomers(); }catch(e){}
    try{
      if(currentCust && buildCustomers().some(function(x){return x.key===currentCust;})) openCustomer(encodeURIComponent(currentCust));
      else custBack();
    }catch(e){}
  }

  /* ---------- modal CRUD ---------- */
  function openLoan(id){
    editId = id||null;
    $('modalTitle').textContent = id?'Edit Loan Record':'New Loan Record';
    // ID numbers open masked every time (Aadhaar/PAN privacy) — eye toggle reveals.
    try{ ['m_idproof','m_coid'].forEach(function(x){ var e=$(x); if(e) e.classList.add('id-masked'); }); }catch(_){}
    const f = id ? loans.find(l=>l.id===id) : {};
    $('m_name').value=f.name||''; $('m_acno').value=f.acno||(id?'':'SE-'+(loans.length+1).toString().padStart(4,'0'));
    $('m_reltype').value=f.reltype||'son of'; $('m_relname').value=f.relname||'';
    $('m_phone').value=f.phone||''; $('m_addr').value=f.addr||''; $('m_idproof').value=f.idproof||'';
    $('m_type').value=f.type||'Personal'; $('m_principal').value=f.principal||''; $('m_rate').value=f.rate||'';
    $('m_disb').value=f.disb||''; $('m_tenure').value=f.tenure||''; $('m_tint').value=f.tint||''; $('m_tpay').value=f.tpay||'';
    $('m_emi').value=f.emi||''; $('m_due').value=f.due||'';
    $('m_status').value=f.status||'Active'; $('m_gname').value=f.gname||''; $('m_gphone').value=f.gphone||''; if($('m_coname'))$('m_coname').value=f.coname||''; if($('m_cophone'))$('m_cophone').value=f.cophone||''; if($('m_corel'))$('m_corel').value=f.corel||''; if($('m_coid'))$('m_coid').value=f.coid||''; if($('m_coaddr'))$('m_coaddr').value=f.coaddr||''; $('m_remarks').value=f.remarks||'';
    $('m_age').value=f.age||''; $('m_residence').value=f.residence||''; $('m_occupation').value=f.occupation||''; $('m_designation').value=f.designation||''; $('m_officeaddr').value=f.officeaddr||''; $('m_idtype').value=f.idtype||'';
    $('m_caseno').value=f.caseno||''; $('m_refno').value=f.refno||''; $('m_product').value=f.product||''; $('m_dealer').value=f.dealer||''; $('m_downpay').value=f.downpay||''; $('m_officer').value=f.officer||'';
    $('m_deductions').value=f.deductions!=null?f.deductions:0; $('m_remaining').value=Math.max(0,(Number(f.principal)||0)-(Number(f.deductions)||0));
    $('m_propdesc').value=f.propdesc||''; $('m_propaddr').value=f.propaddr||''; $('m_proparea').value=f.proparea||''; $('m_propvalue').value=f.propvalue||''; $('m_bN').value=f.bN||''; $('m_bS').value=f.bS||''; $('m_bE').value=f.bE||''; $('m_bW').value=f.bW||''; $('m_title').value=f.title||'';
    modalPayments = Array.isArray(f.payments)? f.payments.map(p=>({...p})) : [];
    if(!modalPayments.length && Number(f.paid)>0){ modalPayments=[{date:f.disb||todayISO(), mode:'Cash', amount:Number(f.paid), cheque:'', bank:'', status:'Cleared'}]; }
    if($('pay_date')) $('pay_date').value=todayISO();
    if($('pay_mode')){ $('pay_mode').value='Cash'; payModeUI(); }
    renderPayments();
    // Restructure/Prepay lives in the Repayments tab. It's always VISIBLE so the
    // option is discoverable, but it only works on a SAVED loan — so on a brand-new
    // record the button is disabled with a hint telling the user to save first.
    try{
      var _isEdit=!!editId, _b=$('rsInFormBtn'), _h=$('rsInFormHint');
      if(_b){ _b.disabled=!_isEdit; _b.style.background=_isEdit?'#0b7a4b':'#9aa3b2'; _b.style.opacity=_isEdit?'1':'.7'; _b.style.cursor=_isEdit?'pointer':'not-allowed'; }
      if(_h){ _h.textContent=_isEdit ? "Record a lump-sum payment and re-plan this loan's EMI or tenure." : "Save this loan first, then reopen it to record a prepayment or restructure."; }
    }catch(e){}
    // Always open on the first tab; refresh the pinned summary + required-field dots.
    try{ loanTab('borrower'); }catch(e){}
    try{ if(!window._loanDotsWired){ window._loanDotsWired=true; ['m_name','m_acno'].forEach(function(id){ var e=$(id); if(e) e.addEventListener('input', function(){ try{ updateLoanTabDots(); }catch(_){}}); }); } }catch(e){}
    try{ if(window._loanRefresh) window._loanRefresh(); }catch(e){}
    $('loanOverlay').classList.add('show');
  }
  function closeLoan(){ $('loanOverlay').classList.remove('show'); }
  /* Aadhaar/PAN privacy: the input holds the REAL value but is visually masked
     (like a password); the eye button toggles reveal. Saving always uses the
     real value, so masking never affects the stored data. */
  window.toggleIdReveal=function(btn){ try{ var inp=btn.parentNode.querySelector('input'); if(inp){ var masked=inp.classList.toggle('id-masked'); btn.textContent = masked ? '👁' : '🙈'; } }catch(e){} };

  /* ---- Loan form tabs (Borrower / Loan Terms / Property / Co-applicant / Repayments) ----
     Pure UI: every field keeps its id, so saving and all EMI/interest maths are unchanged.
     The tabs just decide which group of fields is visible at a time. */
  window.loanTab=function(name){
    try{
      document.querySelectorAll('#loanTabs .loan-tab').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-ltab')===name); });
      document.querySelectorAll('#loanOverlay .loan-panel').forEach(function(p){ p.classList.toggle('active', p.id==='ltab-'+name); });
      var body=document.querySelector('#loanOverlay .modal-body'); if(body) body.scrollTop=0;
    }catch(e){}
  };
  var LOAN_TAB_OF={ m_name:'borrower',m_acno:'borrower',m_reltype:'borrower',m_relname:'borrower',m_phone:'borrower',m_addr:'borrower',m_idproof:'borrower',m_type:'borrower',m_age:'borrower',m_residence:'borrower',m_occupation:'borrower',m_designation:'borrower',m_officeaddr:'borrower',m_idtype:'borrower',
    m_caseno:'terms',m_refno:'terms',m_product:'terms',m_dealer:'terms',m_downpay:'terms',m_officer:'terms',m_principal:'terms',m_deductions:'terms',m_remaining:'terms',m_rate:'terms',m_disb:'terms',m_tenure:'terms',m_tint:'terms',m_tpay:'terms',m_emi:'terms',m_due:'terms',
    m_propdesc:'property',m_propaddr:'property',m_proparea:'property',m_propvalue:'property',m_bN:'property',m_bS:'property',m_bE:'property',m_bW:'property',m_title:'property',
    m_coname:'coapp',m_cophone:'coapp',m_corel:'coapp',m_coid:'coapp',m_coaddr:'coapp',m_gname:'coapp',m_gphone:'coapp',m_remarks:'coapp',
    m_status:'repay' };
  /* saveLoan focuses a field on a validation error — jump to that field's tab first. */
  window.focusLoanField=function(id){ try{ var t=LOAN_TAB_OF[id]; if(t) loanTab(t); var el=$(id); if(el){ setTimeout(function(){ try{ el.focus(); }catch(_){} }, 20); } }catch(e){} };
  /* Pinned summary (visible on every tab) + a red dot on any tab with a missing required field. */
  function updateLoanSummary(){ try{ var emi=Number($('m_emi').value)||0, tpay=Number($('m_tpay').value)||0, paid=Number($('m_paid').value)||0, out=Math.max(0,tpay-paid);
    if($('sum_emi')) $('sum_emi').textContent=inr(emi); if($('sum_tpay')) $('sum_tpay').textContent=inr(tpay); if($('sum_out')) $('sum_out').textContent=inr(out); }catch(e){} }
  function updateLoanTabDots(){ try{
    var bMiss = !((($('m_name')||{}).value||'').trim()) || !((($('m_acno')||{}).value||'').trim());
    var tMiss = !(Number(($('m_principal')||{}).value)>0) || !(Number(($('m_tenure')||{}).value)>0) || ((($('m_rate')||{}).value||'').trim()==='');
    if($('dot-borrower')) $('dot-borrower').classList.toggle('show', !!bMiss);
    if($('dot-terms')) $('dot-terms').classList.toggle('show', !!tMiss);
  }catch(e){} }
  window._loanRefresh=function(){ updateLoanSummary(); updateLoanTabDots(); };
  function recalc(){
    const p=Number($('m_principal').value)||0, r=Number($('m_rate').value)||0, n=Number($('m_tenure').value)||0;
    if(p>0 && r>=0 && n>0){
      const _t=calcLoanTotals(p,r,n); const tint=_t.tint, tpay=_t.tpay, emi=_t.emi;
      $('m_tint').value=tint; $('m_tpay').value=tpay; $('m_emi').value=emi;
      if(!$('m_due').value && $('m_disb').value){ const d=new Date($('m_disb').value); d.setMonth(d.getMonth()+1); $('m_due').value=d.toISOString().slice(0,10); }
    }
    const ded=Number($('m_deductions').value)||0;
    $('m_remaining').value=Math.max(0,p-ded);
    const tpayV=Number($('m_tpay').value)||0, paid=Number($('m_paid').value)||0;
    const out=Math.max(0,tpayV-paid);
    $('m_out').value=out;
    const today=todayISO();
    $('m_status').value = (out<=0 && tpayV>0) ? 'Closed' : (($('m_due').value && $('m_due').value<today)?'Overdue':'Active');
    updatePaySummary(out);
    try{ if(window._loanRefresh) window._loanRefresh(); }catch(e){}
  }
  function updatePaySummary(out){
    const cleared=Number($('m_paid').value)||0;
    const pending=(modalPayments||[]).filter(p=>p.status==='Pending').reduce((a,p)=>a+(Number(p.amount)||0),0);
    if($('m_recv')) $('m_recv').textContent=inr(cleared);
    if($('m_pend')) $('m_pend').textContent=inr(pending);
    if($('m_outTxt')) $('m_outTxt').textContent=inr(out!=null?out:(Number($('m_out').value)||0));
  }
  function payModeUI(){ const m=$('pay_mode').value; const cq=$('pay_chequeRow'); const on=$('pay_onlineRow'); if(cq) cq.style.display=(m==='Cheque')?'flex':'none'; if(on) on.style.display=(m==='Online')?'flex':'none'; }
  function addPayment(){
    const amt=Number($('pay_amt').value)||0;
    if(amt<=0){ toast('Enter a payment amount'); return; }
    const mode=$('pay_mode').value;
    const p={ pid:newPayId(), date:$('pay_date').value||todayISO(), mode, amount:amt,
      cheque: mode==='Cheque'?$('pay_cheqno').value.trim():'',
      bank: mode==='Cheque'?$('pay_bank').value.trim():'',
      ref: mode==='Online'?$('pay_ref').value.trim():'',
      status: mode==='Cheque'?$('pay_status').value:'Cleared' };
    if(isDuplicatePayment({payments:modalPayments}, p) && !confirm('An identical payment of '+inr(amt)+' ('+mode+') on '+fmtDate(p.date)+' is already in this list.\n\nAdd it again anyway?')){ toast('Duplicate payment not added'); return; }
    modalPayments.push(p);
    $('pay_amt').value=''; $('pay_cheqno').value=''; $('pay_bank').value=''; if($('pay_ref'))$('pay_ref').value='';
    renderPayments();
  }
  function removePayment(i){ modalPayments.splice(i,1); renderPayments(); }
  function togglePayStatus(i){ const p=modalPayments[i]; if(!p||p.mode!=='Cheque') return; p.status=(p.status==='Cleared')?'Pending':'Cleared'; renderPayments(); }
  function renderPayments(){
    const cleared=(modalPayments||[]).filter(p=>p.status==='Cleared').reduce((a,p)=>a+(Number(p.amount)||0),0);
    $('m_paid').value=cleared;
    const rows=(modalPayments||[]).map((p,i)=>{
      const chq=p.mode==='Cheque'?` · Chq ${esc(p.cheque||'—')}${p.bank?(' / '+esc(p.bank)):''}`:(p.mode==='Online'?` · Ref ${esc(p.ref||'—')}`:'');
      const badge=p.status==='Cleared'?'<span class="pp ok">Cleared</span>':'<span class="pp pend">Pending</span>';
      const tog=p.mode==='Cheque'?`<button type="button" class="lnk" onclick="togglePayStatus(${i})">${p.status==='Cleared'?'mark pending':'mark cleared'}</button>`:'';
      return `<div class="pay-item"><div class="pay-info"><b>${inr(p.amount)}</b> <span class="muted">${esc(p.mode)}${chq} · ${fmtDate(p.date)}</span></div><div class="pay-act">${badge}${tog}<button type="button" class="lnk del" onclick="removePayment(${i})">remove</button></div></div>`;
    }).join('');
    $('payList').innerHTML = rows || '<div class="pay-empty">No payments recorded yet.</div>';
    recalc();
  }
  /* Total payable / EMI are editable fields. If they are blank or zero (cleared by hand, or
     pasted values that never triggered recalc), fall back to the real formula so a loan can
     never be stored with zero money on it. */
  function _safeTotals(){
    const p=Number($('m_principal').value)||0, r=Number($('m_rate').value)||0, n=Number($('m_tenure').value)||0;
    let tpay=Number($('m_tpay').value)||0, emi=Number($('m_emi').value)||0;
    const calc=calcLoanTotals(p,r,n);
    if(!(tpay>0)) tpay=calc.tpay;
    if(!(emi>0))  emi=calc.emi;
    return {tpay:tpay, emi:emi};
  }
  async function saveLoan(){
    if(typeof can==='function' && !can('edit')){ toast('⚠ You do not have permission to add or edit loans. Ask an administrator.'); return; }
    const name=$('m_name').value.trim(), acno=$('m_acno').value.trim();
    const principal=Number($('m_principal').value)||0;
    if(!name){ toast('\u26a0 Please enter the borrower name.'); focusLoanField('m_name'); return; }
    if(!acno){ toast('\u26a0 Please enter the account number (A/C no.).'); focusLoanField('m_acno'); return; }
    if(loans.some(function(l){ return l.acno && acno && l.acno.toLowerCase()===acno.toLowerCase() && l.id!==editId; })){ toast('\u26a0 Account number "'+acno+'" already belongs to another borrower. Please use a unique A/C number.'); focusLoanField('m_acno'); return; }
    var _idt=($('m_idtype')&&$('m_idtype').value)||'', _idv=(($('m_idproof')&&$('m_idproof').value)||'').trim().toUpperCase();
    if(_idv){
      if(/PAN/i.test(_idt) && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(_idv)){ toast('\u26a0 PAN should look like ABCDE1234F (5 letters, 4 digits, 1 letter).'); focusLoanField('m_idproof'); return; }
      if(/Aadhaar/i.test(_idt)){ var _aa=_idv.replace(/[\s-]/g,''); if(!/^\d{12}$/.test(_aa)){ toast('\u26a0 Aadhaar should be 12 digits.'); focusLoanField('m_idproof'); return; } if(/^[01]/.test(_aa) || /^(\d)\1{11}$/.test(_aa)){ toast('\u26a0 That Aadhaar number does not look valid (it cannot start with 0 or 1, or be the same digit repeated).'); focusLoanField('m_idproof'); return; } }
    }
    var _ph=normPhone($('m_phone').value||'');
    if(_ph && !/^[6-9]\d{9}$/.test(_ph)){ toast('\u26a0 Phone number should be 10 digits starting with 6-9 (e.g. 9839125800).'); focusLoanField('m_phone'); return; }
    if(!_ph && !confirm('No phone number entered.\n\nWithout it you will not be able to send this borrower reminders or notices on WhatsApp.\n\nSave anyway?')){ focusLoanField('m_phone'); return; }
    var badNum=null;
    [['m_principal','Loan amount'],['m_rate','Interest rate'],['m_tpay','Total payable'],['m_emi','EMI'],['m_tenure','Tenure'],['m_paid','Amount paid'],['m_deductions','Deductions']].forEach(function(f){ var v=($(f[0])?$(f[0]).value:'').trim(); if(v!=='' && isNaN(Number(v)) && !badNum) badNum=f[1]+' ("'+v+'")'; });
    if(badNum){ toast('\u26a0 '+badNum+' is not a valid number. Please enter digits only.'); return; }
    if(principal<=0){ toast('\u26a0 Please enter the loan amount (principal) \u2014 it must be greater than zero.'); focusLoanField('m_principal'); return; }
    var _tenureV=Number($('m_tenure').value)||0;
    if(_tenureV<=0 || Math.round(_tenureV)!==_tenureV){ toast('\u26a0 Tenure must be a whole number of months greater than zero.'); focusLoanField('m_tenure'); return; }
    if((Number($('m_rate').value)||0)<0){ toast('\u26a0 Interest rate cannot be negative.'); focusLoanField('m_rate'); return; }
    if((Number($('m_emi').value)||0)<0 || (Number($('m_tpay').value)||0)<0 || (Number($('m_paid').value)||0)<0 || (Number($('m_deductions').value)||0)<0){ toast('\u26a0 Amounts cannot be negative. Please check EMI, total payable, paid and deductions.'); return; }
    /* sensible upper bounds \u2014 catch typos (extra zeros) before they reach the ledger */
    if(principal>1000000000){ toast('\u26a0 The loan amount looks too large \u2014 please check (limit \u20b9100 crore).'); focusLoanField('m_principal'); return; }
    if((Number($('m_rate').value)||0)>100){ toast('\u26a0 The interest rate looks too high \u2014 please check (over 100%).'); focusLoanField('m_rate'); return; }
    if(_tenureV>600){ toast('\u26a0 The tenure looks too long \u2014 please check (over 600 months / 50 years).'); focusLoanField('m_tenure'); return; }
    const out=Math.max(0,(Number($('m_tpay').value)||0)-(Number($('m_paid').value)||0));
    const rec = {
      id: editId||('L'+Date.now()),
      name, acno, reltype:$('m_reltype').value, relname:$('m_relname').value.trim(),
      phone:normPhone($('m_phone').value), addr:$('m_addr').value.trim(), idproof:$('m_idproof').value.trim(),
      type:$('m_type').value, principal:Number($('m_principal').value)||0, rate:Number($('m_rate').value)||0,
      disb:$('m_disb').value, tenure:Number($('m_tenure').value)||0, tint:Number($('m_tint').value)||0,
      tpay:_safeTotals().tpay, emi:_safeTotals().emi, due:$('m_due').value,
      paid:Number($('m_paid').value)||0, outstanding:out, status:$('m_status').value, payments:(modalPayments||[]).map(p=>({...p})),
      gname:$('m_gname').value.trim(), gphone:$('m_gphone').value.trim(), coname:($('m_coname')||{}).value?.trim()||'', cophone:($('m_cophone')||{}).value?.trim()||'', corel:($('m_corel')||{}).value?.trim()||'', coid:($('m_coid')||{}).value?.trim()||'', coaddr:($('m_coaddr')||{}).value?.trim()||'', remarks:$('m_remarks').value.trim(),
      age:$('m_age').value, residence:$('m_residence').value, occupation:$('m_occupation').value.trim(), designation:$('m_designation').value.trim(), officeaddr:$('m_officeaddr').value.trim(), idtype:$('m_idtype').value,
      caseno:$('m_caseno').value.trim(), refno:$('m_refno').value.trim(), product:$('m_product').value.trim(), dealer:$('m_dealer').value.trim(), downpay:Number($('m_downpay').value)||0, deductions:Number($('m_deductions').value)||0, officer:$('m_officer').value.trim(),
      propdesc:$('m_propdesc').value.trim(), propaddr:$('m_propaddr').value.trim(), proparea:$('m_proparea').value.trim(), propvalue:Number($('m_propvalue').value)||0, bN:$('m_bN').value.trim(), bS:$('m_bS').value.trim(), bE:$('m_bE').value.trim(), bW:$('m_bW').value.trim(), title:$('m_title').value.trim(),
      createdAt: editId ? (loans.find(l=>l.id===editId)||{}).createdAt||todayISO() : todayISO()
    };
    /* two-device safety: if this loan was changed on another device since we opened it,
       warn before overwriting instead of silently winning (last-write-wins). */
    if(editId && typeof window.cloudGuardSave==='function'){
      var _g=null; try{ _g=await window.cloudGuardSave(editId); }catch(e){ _g={ok:true}; }
      if(_g && _g.ok===false){
        var _when='recently'; try{ if(_g.at) _when=new Date(_g.at).toLocaleString(); }catch(e){}
        if(!confirm('⚠ This loan was also changed on another device ('+_when+').\n\nSaving now will OVERWRITE that change.\n\nOK = overwrite with your version.\nCancel = keep the other device’s version (it will load in a moment).')){
          try{ if(typeof window.cloudPullNow==='function') window.cloudPullNow(); }catch(e){}
          closeLoan(); toast('Save cancelled — loading the other device’s version.'); return;
        }
      }
    }
    if(editId){ loans = loans.map(l=>l.id===editId?rec:l); } else { loans.unshift(rec); }
    // (c) If the user typed a Next Due Date that differs from the auto-computed one, keep it as a manual override.
    var _formDue=rec.due; rec.dueManual=false;
    recomputeLoan(rec);
    if(_formDue && _formDue!==rec.due){ rec.due=_formDue; rec.dueManual=true; }
    logAudit(editId?'Loan Modified':'Loan Created', name+' ('+acno+')'); save(); closeLoan(); renderLoans(); var _w=[]; var _tp=Number($('m_tpay')?$('m_tpay').value:0)||0, _emi=Number($('m_emi')?$('m_emi').value:0)||0; if(_tp>0 && _tp<principal) _w.push('total payable is less than the loan amount'); if(_emi<=0) _w.push('EMI is zero'); if(!($('m_disb')&&$('m_disb').value)) _w.push('no disbursement date'); if(_w.length) toast('Saved \u2014 but please check: '+_w.join(', ')+'.'); else toast(editId?'Record updated':'Loan record added');
  }
  function snapBefore(reason){ try{ localStorage.setItem('shivam_backup_snapshot', JSON.stringify({at:Date.now(), reason:reason||'', data:loans})); }catch(e){} }
  const RECYCLE_STORE='shivam_recycle_v1';
  function recycleLoad(){ try{ return JSON.parse(localStorage.getItem(RECYCLE_STORE)||'[]')||[]; }catch(e){ return []; } }
  function recycleSave(arr){ try{ localStorage.setItem(RECYCLE_STORE, JSON.stringify(arr)); }catch(e){} }
  function recyclePurgeOld(){ const cut=Date.now()-30*24*60*60*1000; let arr=recycleLoad(); const keep=arr.filter(x=>(x.deletedAt||0)>=cut); if(keep.length!==arr.length) recycleSave(keep); return keep; }
  function delLoan(id){
    if(typeof can==='function' && !can('delete')){ toast('⚠ Only an administrator can delete loan records.'); return; }
    const l=loans.find(x=>x.id===id);
    if(confirm('Move loan record for '+ (l?l.name:'this borrower') +' to the Recycle Bin? You can restore it within 30 days from Administration.')){
      snapBefore('Before delete: '+(l?l.acno:''));
      if(l){ const bin=recyclePurgeOld(); bin.unshift(Object.assign({}, l, {deletedAt:Date.now(), deletedBy:(currentUser&&currentUser.user)||'system'})); recycleSave(bin); }
      logAudit('Loan Deleted (to Recycle Bin)', (l?l.name:'')+' ('+(l?l.acno:'')+')'); loans=loans.filter(x=>x.id!==id); save(); try{ if(typeof cloudDelete==='function') cloudDelete(id, l); }catch(_){ } renderLoans(); if(typeof renderRecycle==='function') renderRecycle(); toast('Moved to Recycle Bin — restorable for 30 days');
    }
  }
  function renderRecycle(){
    const host=$('recycleList'); if(!host) return;
    const bin=recyclePurgeOld();
    if(!bin.length){ host.innerHTML='<p style="color:var(--muted);font-size:13px;margin:6px 0;">Recycle Bin is empty. Deleted loans appear here and can be restored for 30 days.</p>'; return; }
    host.innerHTML=bin.map(function(l){
      const days=Math.max(0, 30-Math.floor((Date.now()-(l.deletedAt||0))/(24*60*60*1000)));
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-bottom:6px;">'+
        '<div style="font-size:13px;"><b>'+esc(l.name||'')+'</b> &middot; '+esc(l.acno||'')+' <span style="color:var(--muted);">— deleted '+new Date(l.deletedAt).toLocaleDateString('en-IN')+', '+days+' day'+(days===1?'':'s')+' left</span></div>'+
        '<div style="display:flex;gap:6px;"><button class="btn btn-sm btn-primary" onclick="restoreFromRecycle(\''+l.id+'\')">Restore</button>'+
        '<button class="btn btn-sm btn-ghost" onclick="purgeFromRecycle(\''+l.id+'\')">Delete forever</button></div></div>';
    }).join('');
  }
  function openRecycleBin(){
    if(currentUser && currentUser.role!=='admin'){ toast('Only an administrator can open the Recycle Bin'); return; }
    go('backup');
    setTimeout(function(){
      try{ renderRecycle(); }catch(e){}
      var el=$('recycleList'); if(!el) return;
      try{ el.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){ try{ el.scrollIntoView(); }catch(_){} }
      el.style.transition='outline-color .3s'; el.style.outline='2px solid var(--accent,#2563EB)'; el.style.outlineOffset='4px'; el.style.borderRadius='8px';
      setTimeout(function(){ el.style.outline='2px solid transparent'; }, 1800);
    }, 140);
  }
  window.openRecycleBin=openRecycleBin;
  function restoreFromRecycle(id){
    let bin=recyclePurgeOld(); const item=bin.find(x=>x.id===id); if(!item){ toast('Not found in Recycle Bin'); return; }
    if(loans.some(x=>x.acno && item.acno && x.acno.toLowerCase()===item.acno.toLowerCase())){ toast('\u26a0 A loan with A/C "'+item.acno+'" already exists. Change or remove it first, then restore.'); return; }
    const clean=Object.assign({}, item); delete clean.deletedAt; delete clean.deletedBy;
    loans.unshift(clean); try{recomputeAll();}catch(e){} save(); bin=bin.filter(x=>x.id!==id); recycleSave(bin);
    logAudit('Loan Restored from Recycle Bin', (item.name||'')+' ('+(item.acno||'')+')');
    renderRecycle(); if(typeof renderLoans==='function') renderLoans(); if(typeof renderDash==='function') renderDash(); toast('Loan restored');
  }
  function purgeFromRecycle(id){
    if(!confirm('Permanently delete this record? This cannot be undone.')) return;
    let bin=recyclePurgeOld(); const item=bin.find(x=>x.id===id); bin=bin.filter(x=>x.id!==id); recycleSave(bin);
    logAudit('Loan Permanently Deleted', item?((item.name||'')+' ('+(item.acno||'')+')'):id);
    renderRecycle(); toast('Permanently deleted');
  }

