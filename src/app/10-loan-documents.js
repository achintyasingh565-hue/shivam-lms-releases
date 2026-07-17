  /* ---------- Loan Documents (mortgage) ---------- */
  function refreshHPDropdown(){
    const opts='<option value="">— Select a borrower —</option>'+loans.map(l=>`<option value="${l.id}">${esc(l.name)} (${esc(l.acno)})</option>`).join('');
    const sel=$('fileLoad'); if(sel){ const cur=sel.value; sel.innerHTML=opts; sel.value=cur; }
  }
  function hpVal(id){ const e=$(id); return e?e.value.trim():''; }
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  function updateHP(){
    const g=id=>hpVal(id);
    const name=g('h_name'), father=g('h_father'), addr=g('h_addr');
    const guar=g('h_guar'), gfather=g('h_guarfather'), gaddr=g('h_guaraddr');
    const code=g('h_code'), date=fmtDate($('h_date').value), ref=g('h_ref'), purpose=g('h_purpose');
    const pdesc=g('h_propdesc'), paddr=g('h_propaddr'), parea=g('h_proparea'), pval=Number(g('h_propvalue'))||0;
    const bN=g('h_bN'), bS=g('h_bS'), bE=g('h_bE'), bW=g('h_bW'), title=g('h_title');
    const loan=Number(g('h_loanamt'))||0, rate=g('h_rate'), emi=Number(g('h_emi'))||0, ninst=g('h_ninst');
    const total=Number(g('h_total'))||0, fine=Number(g('h_fine'))||0, from=fmtDate($('h_from').value), to=fmtDate($('h_to').value), place=g('h_place');
    const num=v=>v?Number(v).toLocaleString('en-IN'):'';
    let dd='',mm='',yy='';
    if($('h_date').value){ const d=new Date($('h_date').value); dd=String(d.getDate()); mm=MONTHS[d.getMonth()]; yy=String(d.getFullYear()).slice(2); }
    const S=(id,v)=>setText(id,v);
    // cover is filled independently via loadCover()
    // agreement
    S('av_day',dd); S('av_month',mm); S('av_year',yy);
    S('av_name',name); S('av_father',father); S('av_addr',addr); S('av_guar',guar); S('av_guarfather',gfather); S('av_guaraddr',gaddr);
    S('av_loan',num(loan)); S('av_loan2',num(loan)); S('av_rate',rate); S('av_rate2',rate);
    S('av_emi',num(emi)); S('av_emi2',num(emi)); S('av_ninst',ninst); S('av_ninst2',ninst);
    S('av_from',from); S('av_to',to); S('av_fine',num(fine)); S('av_fine2',num(fine)); S('av_total',num(total));
    S('av_pdesc',pdesc); S('av_paddr',paddr); S('av_parea',parea); S('av_bN',bN); S('av_bS',bS); S('av_bE',bE); S('av_bW',bW); S('av_title',title); S('av_pval',num(pval));
    // delivery + promissory
    S('dv_name',name); S('dv_name2',name); S('dv_date',date); S('dv_loan',num(loan));
    S('dv_pdesc',pdesc); S('dv_paddr',paddr); S('dv_parea',parea); S('dv_pval',num(pval));
    S('pn_loan',num(loan)); S('pn_loan2',num(loan)); S('pn_name',name); S('pn_father',father); S('pn_addr',addr);
    S('pn_guar',guar); S('pn_guarfather',gfather); S('pn_guaraddr',gaddr); S('pn_rate',rate); S('pn_place',place);
    S('pn_day',dd); S('pn_month',mm); S('pn_year',yy);
  }
  ['h_name','h_father','h_addr','h_guar','h_guarfather','h_guaraddr','h_code','h_ref','h_purpose','h_propdesc','h_propaddr','h_proparea','h_propvalue','h_bN','h_bS','h_bE','h_bW','h_title','h_loanamt','h_rate','h_emi','h_ninst','h_total','h_fine','h_place'].forEach(id=>{ const e=$(id); if(e) e.addEventListener('input',updateHP); });
  ['h_date','h_from','h_to'].forEach(id=>{ const e=$(id); if(e) e.addEventListener('change',updateHP); });

  function setHPDoc(v){
    if(v==='proposal'){ go('proposal'); return; }
    [...$('hpseg').children].forEach(b=>b.classList.toggle('active', b.dataset.hp===v));
    const map={cover:'hpCover',agreement:'hpAgreement',delivery:'hpDelivery'};
    Object.keys(map).forEach(k=>{ const d=$(map[k]); if(d){ d.classList.toggle('active', k===v); d.style.display=(k===v)?'flex':'none'; } });
  }
  if($('hpseg')) $('hpseg').addEventListener('click', e=>{ if(e.target.dataset.hp) setHPDoc(e.target.dataset.hp); });
  if($('propseg')) $('propseg').addEventListener('click', e=>{ const v=e.target.dataset.hp; if(!v) return; if(v==='proposal'){ go('proposal'); } else { go('hpfile'); setHPDoc(v); } });

  function loadAgrFrom(selId){
    const id=$(selId).value; if(!id) return; const l=loans.find(x=>x.id===id); if(!l) return;
    const set=(i,v)=>{ if($(i)) $(i).value=(v==null?'':v); };
    set('h_name',l.name); set('h_father',(l.reltype?l.reltype.replace(' of',' '):'')+(l.relname||'')); set('h_addr',l.addr);
    set('h_guar',l.gname); set('h_code',l.acno); set('h_date',l.disb||todayISO()); set('h_ref',l.refno||l.caseno); set('h_purpose',l.product||l.type);
    set('h_propdesc',l.propdesc); set('h_propaddr',l.propaddr); set('h_proparea',l.proparea); set('h_propvalue',l.propvalue||'');
    set('h_bN',l.bN); set('h_bS',l.bS); set('h_bE',l.bE); set('h_bW',l.bW); set('h_title',l.title);
    set('h_loanamt',l.principal||''); set('h_rate',l.rate||''); set('h_emi',l.emi||''); set('h_ninst',l.tenure||'');
    set('h_total',l.tpay||''); set('h_from',l.disb||'');
    if(!hpVal('h_fine')) set('h_fine', getLateFee());
    const other = selId==='agrLoad'?'delLoad':'agrLoad'; if($(other)) $(other).value=id;
    updateHP(); logAudit('Document Filled','Agreement/Security \u2014 '+l.name); toast('Document filled from '+l.name);
  }
  function loadCover(){
    const id=$('covLoad').value; if(!id) return; const l=loans.find(x=>x.id===id); if(!l) return;
    setText('cv_name',(l.name||'')+(l.addr?(', '+l.addr):'')); setText('cv_code',l.acno||''); setText('cv_amt',(Number(l.principal)||0).toLocaleString('en-IN')); setText('cv_date',fmtDate(l.disb||todayISO())); setText('cv_purpose',l.product||l.type||'');
    logAudit('Document Filled','Cover \u2014 '+l.name);
  }
  let lastDocLoan=null;
  function fillDocPhoto(l){
    const box=$('pf_photo'); if(!box || !l) return;
    const ck=custKeyOf(l);
    if(typeof vaultList!=='function'){ return; }
    vaultList(ck).then(docs=>{
      const imgs=(docs||[]).filter(x=>(x.type||'').indexOf('image')===0);
      const pick=imgs.filter(x=>x.category==='Photograph').sort((a,b)=>b.addedAt-a.addedAt)[0] || imgs.sort((a,b)=>b.addedAt-a.addedAt)[0];
      if(pick && pick.blob){
        try{ const url=URL.createObjectURL(pick.blob); box.innerHTML='<img src="'+url+'" alt="Photo" style="width:100%;height:100%;object-fit:cover;">'; box.dataset.has='1'; }catch(e){}
      } else { box.innerHTML='Affix<br>Photo'; box.dataset.has=''; }
    }).catch(()=>{});
  }
  function loadFile(id){
    if(!id){ return; }
    const l=loans.find(x=>x.id===id); if(!l) return;
    const set=(i,v)=>{ if($(i)) $(i).value=(v==null?'':v); };
    setText('cv_name',(l.name||'')+(l.addr?(', '+l.addr):'')); setText('cv_code',l.acno||''); setText('cv_amt',(Number(l.principal)||0).toLocaleString('en-IN')); setText('cv_date',fmtDate(l.disb||todayISO())); setText('cv_purpose',l.product||l.type||'');
    set('h_name',l.name); set('h_father',(l.reltype?l.reltype.replace(' of',' '):'')+(l.relname||'')); set('h_addr',l.addr);
    set('h_guar',l.gname); set('h_code',l.acno); set('h_date',l.disb||todayISO()); set('h_ref',l.refno||l.caseno); set('h_purpose',l.product||l.type);
    set('h_propdesc',l.propdesc); set('h_propaddr',l.propaddr); set('h_proparea',l.proparea); set('h_propvalue',l.propvalue||'');
    set('h_bN',l.bN); set('h_bS',l.bS); set('h_bE',l.bE); set('h_bW',l.bW); set('h_title',l.title);
    set('h_loanamt',l.principal||''); set('h_rate',l.rate||''); set('h_emi',l.emi||''); set('h_ninst',l.tenure||'');
    set('h_total',l.tpay||''); set('h_from',l.disb||'');
    if(!hpVal('h_fine')) set('h_fine', getLateFee());
    updateHP();
    set('p_case',l.caseno); set('p_ref',l.refno); set('p_product',l.product||l.type);
    set('p_dealer',l.dealer); set('p_downpay',l.downpay||''); set('p_financed',l.principal||'');
    set('p_interest',l.rate||''); set('p_name',l.name); set('p_age',l.age); set('p_father',l.relname);
    set('p_addr',l.addr); set('p_tel',l.phone); set('p_res',l.residence); set('p_occ',l.occupation);
    set('p_desig',l.designation); set('p_office',l.officeaddr); set('p_id',(l.idtype?l.idtype+' ':'')+(l.idproof||'')); set('p_guarantor',l.gname);
    updateProp(); lastDocLoan=l; fillDocPhoto(l);
    if($('fileLoad')) $('fileLoad').value=id; if($('loadProp')) $('loadProp').value=id;
    logAudit('Document Filled','Full file \u2014 '+l.name); toast('All documents filled from '+l.name);
  }
  function resetHP(){
    ['h_name','h_father','h_addr','h_guar','h_guarfather','h_guaraddr','h_code','h_ref','h_purpose','h_propdesc','h_propaddr','h_proparea','h_propvalue','h_bN','h_bS','h_bE','h_bW','h_title','h_loanamt','h_rate','h_emi','h_ninst','h_total','h_fine'].forEach(id=>{ if($(id)) $(id).value=''; });
    $('h_place').value='Lucknow'; $('h_date').value=todayISO(); $('h_from').value=''; $('h_to').value=''; if($('fileLoad')) $('fileLoad').value=''; ['cv_name','cv_code','cv_amt','cv_date','cv_purpose'].forEach(id=>setText(id,'')); updateHP();
  }
  function printHP(){ logAudit('Document Printed','Loan Documents (single page)'); var _hl=(typeof lastDocLoan!=='undefined'&&lastDocLoan)?lastDocLoan:null; window._docTitleBak=document.title; document.title=_docFileName(_hl?_hl.name:'', _hl?_hl.acno:'', 'Loan_Documents'); document.body.classList.add('printing-hp'); window.print(); }
  function printHPAll(){
    logAudit('Document Printed','Full loan file');
    { var _al=(typeof lastDocLoan!=='undefined'&&lastDocLoan)?lastDocLoan:null; window._docTitleBak=document.title; document.title=_docFileName(_al?_al.name:'', _al?_al.acno:'', 'Loan_Documents'); }
    const host=$('fullFilePrint');
    if(!host){ document.body.classList.add('printing-hp-all'); window.print(); return; }
    host.innerHTML='';
    ['hpCover','propPage','hpAgreement','hpDelivery'].forEach(id=>{
      const src=$(id); if(!src) return;
      const c=src.cloneNode(true); c.removeAttribute('id'); c.removeAttribute('style');
      c.classList.add('ff-page'); host.appendChild(c);
    });
    document.body.classList.add('printing-fullfile'); window.print();
  }
  function _dlBlob(blob, fn){ try{ const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=fn; document.body.appendChild(a); a.click(); setTimeout(()=>{ a.remove(); URL.revokeObjectURL(u); },1500); }catch(e){ console.error(e); } }
  async function _renderPagePng(el){
    if(!el) return null;
    const wrap=document.createElement('div'); wrap.style.cssText='position:fixed;left:-10000px;top:0;background:#fff;z-index:-1;';
    const clone=el.cloneNode(true); clone.style.display='block'; clone.style.margin='0'; clone.style.boxShadow='none'; clone.style.zoom='1';
    wrap.appendChild(clone); document.body.appendChild(wrap);
    let durl=null;
    try{ const cv=await html2canvas(clone,{scale:2, backgroundColor:'#ffffff', useCORS:true, logging:false}); durl=cv.toDataURL('image/png'); }catch(e){ console.error('render fail',e); }
    wrap.remove(); return durl;
  }
  function _drawFit(page, img, pw, ph){ const iw=img.width, ih=img.height; const sc=Math.min(pw/iw, ph/ih); const w=iw*sc, h=ih*sc; page.drawImage(img,{x:(pw-w)/2, y:(ph-h)/2, width:w, height:h}); }
  async function downloadCombinedPDF(){
    const l=lastDocLoan;
    if(!l){ toast('Pick a borrower in Loan Documents first'); return; }
    if(!window.PDFLib || !window.html2canvas){ toast('PDF engine unavailable in this browser'); return; }
    const btn=$('combinedBtn'); const orig=btn?btn.textContent:''; if(btn){ btn.disabled=true; btn.textContent='Building PDF…'; }
    toast('Building combined PDF…');
    try{
      const { PDFDocument } = PDFLib;
      const out=await PDFDocument.create(); const A4W=595.28, A4H=841.89;
      const map=[['hpCover','child'],['propPage','self'],['hpAgreement','child'],['hpDelivery','child']];
      for(const [id,mode] of map){
        const host=document.getElementById(id); if(!host) continue;
        const el=(mode==='self')?host:(host.firstElementChild||host);
        const durl=await _renderPagePng(el); if(!durl) continue;
        const png=await out.embedPng(durl); const pg=out.addPage([A4W,A4H]); _drawFit(pg,png,A4W,A4H);
      }
      let docs=[]; try{ docs=await vaultList(custKeyOf(l)); }catch(e){}
      let attached=0;
      for(const d of docs){ if(!d.blob) continue; const t=(d.type||'').toLowerCase();
        try{ const buf=await d.blob.arrayBuffer();
          if(t.indexOf('pdf')>=0){ const src=await PDFDocument.load(buf,{ignoreEncryption:true}); const cp=await out.copyPages(src, src.getPageIndices()); cp.forEach(p=>out.addPage(p)); attached++; }
          else if(t.indexOf('png')>=0){ const im=await out.embedPng(buf); const pg=out.addPage([A4W,A4H]); _drawFit(pg,im,A4W,A4H); attached++; }
          else if(t.indexOf('jpg')>=0||t.indexOf('jpeg')>=0){ const im=await out.embedJpg(buf); const pg=out.addPage([A4W,A4H]); _drawFit(pg,im,A4W,A4H); attached++; }
        }catch(e){ console.warn('skip vault doc',d&&d.name,e); }
      }
      const bytes=await out.save();
      window.__pdfInfo={pages:out.getPageCount(), size:bytes.length, attached, header:String.fromCharCode(bytes[0],bytes[1],bytes[2],bytes[3])};
      _dlBlob(new Blob([bytes],{type:'application/pdf'}), 'Loan_File_'+((l.name||'file').replace(/[^a-z0-9]+/ig,'_'))+'.pdf');
      logAudit('Combined PDF',(l.name||'')+' \u2014 '+out.getPageCount()+' pages, '+attached+' vault file(s)');
      toast('Combined PDF ready \u2014 '+out.getPageCount()+' pages');
    }catch(e){ console.error(e); toast('Could not build PDF: '+(e&&e.message||e)); }
    finally{ if(btn){ btn.disabled=false; btn.textContent=orig; } }
  }

