  /* ---------- proposal form ---------- */
  function refreshPropDropdown(){
    const sel=$('loadProp'); const cur=sel.value;
    sel.innerHTML='<option value="">— Select a borrower —</option>'+loans.map(l=>`<option value="${l.id}">${esc(l.name)} (${esc(l.acno)})</option>`).join('');
    sel.value=cur;
  }
  function setText(id,v){ const e=$(id); if(e) e.textContent=v; }
  function updateProp(){
    const g=id=>($(id)?$(id).value.trim():'');
    setText('pv_case',g('p_case')); setText('pv_month',g('p_month'));
    setText('pv_product',g('p_product')); setText('pv_product2',g('p_product')); setText('pv_ref',g('p_ref'));
    setText('pv_dealer',g('p_dealer'));
    setText('pv_downpay', g('p_downpay')?inr(g('p_downpay')):''); setText('pv_financed', g('p_financed')?inr(g('p_financed')):'');
    setText('pv_interest', g('p_interest')?g('p_interest')+'%':'');
    setText('pv_date', fmtDate($('p_date').value)); setText('pv_date2', fmtDate($('p_date').value));
    setText('pv_name',g('p_name')); setText('pv_age',g('p_age')); setText('pv_father',g('p_father'));
    setText('pv_addr',g('p_addr')); setText('pv_tel',g('p_tel'));
    setText('pv_occ',g('p_occ')); setText('pv_desig',g('p_desig')); setText('pv_office',g('p_office'));
    setText('pv_id',g('p_id')); setText('pv_pan',g('p_pan')); setText('pv_guar',g('p_guarantor'));
    const r=$('p_res').value; const tick=(id,on)=>{ const e=$(id); if(e) e.textContent=on?'✓':''; };
    tick('pv_res_own', r==='Own'); tick('pv_res_rent', r==='Rental'); tick('pv_res_par', r==="Parent's / Spouse"); tick('pv_res_emp', r==='Employee Leased');
  }
  ['p_case','p_month','p_product','p_ref','p_dealer','p_downpay','p_financed','p_interest','p_name','p_age','p_father','p_addr','p_tel','p_occ','p_desig','p_office','p_id','p_pan','p_guarantor'].forEach(id=>{ const e=$(id); if(e) e.addEventListener('input',updateProp); });
  ['p_date','p_res'].forEach(id=>{ const e=$(id); if(e) e.addEventListener('change',updateProp); });

  function loadPropFromLoan(){
    const id=$('loadProp').value; if(!id) return;
    const l=loans.find(x=>x.id===id); if(!l) return;
    const set=(i,v)=>{ if($(i)) $(i).value=v||''; };
    set('p_case',l.caseno); set('p_ref',l.refno); set('p_product',l.product||l.type);
    set('p_dealer',l.dealer); set('p_downpay',l.downpay||''); set('p_financed',l.principal||'');
    set('p_interest',l.rate||'');
    set('p_name',l.name); set('p_age',l.age); set('p_father',l.relname);
    set('p_addr',l.addr); set('p_tel',l.phone); set('p_res',l.residence);
    set('p_occ',l.occupation); set('p_desig',l.designation); set('p_office',l.officeaddr);
    set('p_id', (l.idtype?l.idtype+' ':'')+(l.idproof||'')); set('p_guarantor',l.gname);
    updateProp(); toast('Proposal filled from '+l.name);
  }
  function resetProp(){
    ['p_case','p_month','p_product','p_ref','p_dealer','p_downpay','p_financed','p_interest','p_name','p_age','p_father','p_addr','p_tel','p_occ','p_desig','p_office','p_id','p_pan','p_guarantor'].forEach(id=>{ if($(id)) $(id).value=''; });
    $('p_res').value=''; $('p_date').value=todayISO(); $('loadProp').value=''; updateProp();
  }
  function printProposal(){ logAudit('Document Printed','Proposal Form'); var _pl=_propLoan(); window._docTitleBak=document.title; document.title=_docFileName(_pl?_pl.name:'', _pl?_pl.acno:'', 'Proposal'); document.body.classList.add('printing-proposal'); window.print(); }

  function proposalToLoan(){
    openLoan();
    const g=id=>($(id)?$(id).value.trim():'');
    $('m_name').value=g('p_name'); $('m_relname').value=g('p_father'); $('m_phone').value=g('p_tel');
    $('m_addr').value=g('p_addr'); $('m_age').value=g('p_age'); $('m_occupation').value=g('p_occ');
    $('m_designation').value=g('p_desig'); $('m_officeaddr').value=g('p_office'); $('m_residence').value=$('p_res').value;
    $('m_product').value=g('p_product'); $('m_dealer').value=g('p_dealer'); $('m_caseno').value=g('p_case');
    $('m_refno').value=g('p_ref'); $('m_gname').value=g('p_guarantor');
    $('m_downpay').value=g('p_downpay'); $('m_principal').value=g('p_financed'); $('m_rate').value=g('p_interest');
    recalc(); toast('Review and save the new loan record');
  }

