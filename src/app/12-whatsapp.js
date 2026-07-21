  /* ---------- batch WhatsApp sender ---------- */
  let _batch={list:[],i:0};
  function startBatch(list){
    list=(list||[]).filter(x=>x && x.phone && intlPhone(x.phone));
    if(!list.length){ toast('No customers with a saved phone number'); return; }
    _batch={list:list, i:0};
    $('batchOverlay').classList.add('show'); batchStep();
  }
  function batchStep(){
    const {list,i}=_batch;
    if(i>=list.length){
      $('batchBody').innerHTML=`<div style="text-align:center;padding:14px 6px;"><div style="font-size:36px;color:var(--ok);line-height:1;">✓</div><p style="margin-top:10px;font-weight:600;font-size:15px;">All ${list.length} chats opened</p><p class="ph-sub" style="margin-top:5px;">Make sure you pressed <b>Send</b> in WhatsApp for each customer.</p></div>`;
      $('batchFoot').innerHTML=`<button class="btn btn-primary" onclick="closeBatch()">Done</button>`; return;
    }
    const c=list[i];
    $('batchBody').innerHTML=`<div class="batch-prog">Customer ${i+1} of ${list.length}</div>
      <div class="batch-name">${esc(c.name)} <span class="muted" style="font-weight:400;">· ${esc(c.phone)}</span></div>
      <div class="batch-msg">${esc(c.msg)}</div>
      <p class="ph-sub" style="margin-top:11px;margin-bottom:0;">Click <b>Open</b> to launch this chat in WhatsApp, press <b>Send</b> there, then return and continue to the next customer.</p>`;
    $('batchFoot').innerHTML=`<button class="btn btn-ghost" onclick="batchSkip()">Skip</button>
      <button class="btn" style="background:#25D366;color:#fff;" onclick="batchOpen()">Open in WhatsApp ▶</button>`;
  }
  function batchOpen(){ const c=_batch.list[_batch.i]; if(c) waSend(c.phone,c.msg); _batch.i++; batchStep(); }
  function batchSkip(){ _batch.i++; batchStep(); }
  function closeBatch(){ $('batchOverlay').classList.remove('show'); }
  /* ---------- WhatsApp review / approval / history ---------- */
  const WACFG_STORE="shivam_wacfg_v1", WAHIST_STORE="shivam_wamsg_v1";
  function loadWaCfg(){ try{ const c=JSON.parse(localStorage.getItem(WACFG_STORE)||'{}')||{}; return c; }catch(e){ return {}; } }
  /* A token is "present" whether it's the plaintext copy (browser) OR held in the
     Mac keychain / encrypted (desktop). The main process loads the keychain token
     itself when sending, so keychain-only still counts as configured for API send. */
  function waHasToken(c){ return !!(c && (c.token || c.tokenInKeychain || c.tokenEnc)); }
    function saveWaCfg(c){ try{ localStorage.setItem(WACFG_STORE, JSON.stringify(c)); }catch(e){} }
  function loadWaHist(){ try{ return JSON.parse(localStorage.getItem(WAHIST_STORE)||'[]'); }catch(e){ return []; } }
  function saveWaHist(h){ try{ localStorage.setItem(WAHIST_STORE, JSON.stringify(h.slice(-5000))); }catch(e){} }
  let _review={category:'', items:[]};
  function _rvFind(id){ return _review.items.find(x=>x.id===id); }
  function waPhoneState(item, allPhones){
    const raw=(item.phone||'').trim(); if(!raw) return {cls:'miss', label:'No number'};
    const d=intlPhone(raw); if(!d) return {cls:'bad', label:'Invalid'};
    if(allPhones.filter(p=>p===d).length>1) return {cls:'dup', label:'Duplicate'};
    return {cls:'ok', label:''};
  }
  function openReviewQueue(list, category){
    list=(list||[]).filter(x=>x);
    if(!list.length){ toast('Nothing to review \u2014 generate messages first'); return; }
    _review={category:category||'Message', items:list.map((x,i)=>({id:i, lang:x.lang||'en', name:x.name||'', phone:x.phone||'', acno:x.acno||'', cat:x.cat||category||'Message', msg:x.msg||'', vars:x.vars||{}, tpl:x.tpl||'', loanId:x.loanId||'', amt:(x.amt!=null?x.amt:null), sel:true}))};
    logAudit('WhatsApp Generated', _review.items.length+' message(s) \u00b7 '+(category||'Message'));
    const fs=$('reviewSearch'); if(fs) fs.value=''; const ff=$('reviewFilter'); if(ff){ ff.dataset.built=''; }
    renderReview(); $('reviewOverlay').classList.add('show');
  }
  function renderReview(){
    const q=($('reviewSearch')?$('reviewSearch').value:'').toLowerCase().trim();
    const f=$('reviewFilter')?$('reviewFilter').value:'all';
    var _wc=loadWaCfg(); var metaMode=!!(window.electronAPI && window.electronAPI.sendWhatsApp && _wc && waHasToken(_wc) && _wc.pnid);
    const allPhones=_review.items.map(it=>intlPhone(it.phone)).filter(Boolean);
    const fsel=$('reviewFilter');
    if(fsel && fsel.dataset.built!=='1'){ const cats=[...new Set(_review.items.map(it=>it.cat))]; fsel.innerHTML='<option value="all">All categories</option>'+cats.map(c=>'<option>'+esc(c)+'</option>').join(''); fsel.dataset.built='1'; }
    let rows=_review.items.filter(it=>{ if(f!=='all' && it.cat!==f) return false; if(q && !((it.name+' '+it.phone+' '+it.acno+' '+it.msg).toLowerCase().includes(q))) return false; return true; });
    const body=$('reviewBody');
    if(!rows.length){ body.innerHTML='<div class="pay-empty">No messages match.</div>'; }
    else body.innerHTML='<div class="table-wrap"><table class="data"><thead><tr><th style="width:34px;"></th><th>Borrower</th><th>Phone</th><th>Loan</th><th>Category</th><th>Message</th><th></th></tr></thead><tbody>'+
      rows.map(it=>{ const ps=waPhoneState(it, allPhones); const badge=ps.cls==='ok'?'':('<span class="wa-badge '+ps.cls+'">'+ps.label+'</span>');
        const hasAmt = it.amt!=null && /\{(emi|amount|outstanding)\}/.test(it.tpl||'');
        const hasDate = /\{due_date\}/.test(it.tpl||'');
        const _Ld = (typeof loans!=='undefined' && Array.isArray(loans)) ? loans.find(x=>x.id===it.loanId) : null;
        const dueISO = it.dueISO || (_Ld?(_Ld.due||''):'') || '';
        const amtInput = (hasAmt && window._rvEditId!==it.id) ? ('<div style="margin-bottom:5px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;"><span style="color:var(--grey);">\u20b9</span><input type="text" value="'+esc(inrPlain(it.amt))+'" onchange="waSetAmount('+it.id+', this.value)" title="Amount shown in this message" style="width:120px;border:1px solid var(--line);border-radius:6px;padding:4px 7px;font-size:11.5px;background:var(--field);color:var(--text);"><span style="color:var(--grey);font-size:10px;">amount that gets sent</span></div>') : '';
        const dateInput = (hasDate && window._rvEditId!==it.id) ? ('<div style="margin-bottom:5px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;"><span style="color:var(--grey);">\ud83d\udcc5</span><input type="date" value="'+esc(dueISO)+'" onchange="waSetDate('+it.id+', this.value)" title="Payment date shown in this message" style="border:1px solid var(--line);border-radius:6px;padding:4px 7px;font-size:11.5px;background:var(--field);color:var(--text);"><span style="color:var(--grey);font-size:10px;">payment date in message</span></div>') : '';
        return '<tr><td><input type="checkbox" '+(it.sel?'checked':'')+' onchange="waSel('+it.id+', this.checked)"></td>'+
          '<td class="name">'+esc(it.name||'\u2014')+'</td>'+
          '<td class="muted">'+esc(it.phone||'\u2014')+' '+badge+'</td>'+
          '<td class="muted">'+esc(it.acno||'\u2014')+'</td>'+
          '<td><span class="pp ok">'+esc(it.cat)+'</span></td>'+
          '<td class="muted" style="max-width:360px;font-size:11.5px;">'+(window._rvEditId===it.id?('<textarea id="rvEdit'+it.id+'" style="width:100%;min-height:74px;border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:11.5px;background:var(--field);color:var(--text);font-family:inherit;">'+esc(it.msg)+'</textarea><div style="margin-top:5px;"><button class="lnk" onclick="saveReviewEdit('+it.id+')">save</button> <button class="lnk del" onclick="cancelReviewEdit()">cancel</button></div>'):(amtInput+dateInput+esc(it.msg)))+'</td>'+
          '<td style="white-space:nowrap;">'+(metaMode?(hasAmt?'<span class="lnk" style="cursor:default;color:var(--grey);" title="Your message wording is fixed by the approved WhatsApp template. Change the amount in the &#8377; box.">wording fixed by template</span>':'<span style="color:var(--grey);font-size:11px;">template message</span>'):('<button class="lnk" onclick="editReview('+it.id+')">edit</button>'))+' <button class="lnk del" onclick="removeReview('+it.id+')">remove</button></td></tr>';
      }).join('')+'</tbody></table></div>';
    waUpdateCount();
  }
  function waUpdateCount(){ const n=_review.items.filter(it=>it.sel).length; const h=$('reviewCount'); if(h) h.textContent=n+' of '+_review.items.length+' selected'; }
  function waSel(id,v){ const it=_rvFind(id); if(it) it.sel=v; waUpdateCount(); }
  function reviewSelectAll(v){ _review.items.forEach(it=>it.sel=v); renderReview(); }
  function editReview(id){ window._rvEditId=id; renderReview(); }
  function saveReviewEdit(id){ const it=_rvFind(id); const ta=$('rvEdit'+id); if(it&&ta){ it.msg=ta.value; } window._rvEditId=null; renderReview(); }
  function _waRegen(it){
    if(!it) return;
    const l=(typeof loans!=='undefined' && Array.isArray(loans))?loans.find(x=>x.id===it.loanId):null;
    const ex={};
    if(it.amt!=null && (/\{emi\}/.test(it.tpl||'')||/\{amount\}/.test(it.tpl||''))){ const f=inr(it.amt); ex.emi=f; ex.amount=f; if(it.vars){ const p=inrPlain(it.amt); it.vars.emi=p; it.vars.amount=p; } }
    if(it.amt!=null && /\{outstanding\}/.test(it.tpl||'')){ ex.outstanding=inr(it.amt); if(it.vars){ it.vars.outstanding=inrPlain(it.amt); } }
    if(it.dueStr){ ex.due_date=it.dueStr; if(it.vars){ it.vars.due_date=it.dueStr; } }
    if(l && it.tpl){ it.msg=applyVars(it.tpl, l, ex); }
  }
  function waSetAmount(id, val){
    if(!_review||!_review.items) return;
    const it=_review.items.find(x=>x.id===id); if(!it) return;
    it.amt=Math.max(0, Math.round(Number(String(val).replace(/[^0-9.]/g,''))||0));
    _waRegen(it); renderReview();
  }
  window.waSetAmount=waSetAmount;
  function waSetDate(id, iso){
    if(!_review||!_review.items) return;
    const it=_review.items.find(x=>x.id===id); if(!it) return;
    it.dueISO = iso||'';
    it.dueStr = iso ? fmtDate(iso) : '';
    _waRegen(it); renderReview();
  }
  window.waSetDate=waSetDate;
  function cancelReviewEdit(){ window._rvEditId=null; renderReview(); }
  function removeReview(id){ _review.items=_review.items.filter(x=>x.id!==id); renderReview(); }
  function closeReview(){ $('reviewOverlay').classList.remove('show'); }
  function openVerify(){
    const sel=_review.items.filter(it=>it.sel && intlPhone(it.phone));
    if(!sel.length){ toast('Select at least one recipient with a valid number'); return; }
    const cfg=loadWaCfg(); const num=cfg.bnumber||'(not set \u2014 add under WhatsApp Settings)';
    const uniq=new Set(sel.map(it=>intlPhone(it.phone))).size; const cats=[...new Set(sel.map(it=>it.cat))].join(', '); const now=new Date();
    $('verifyBody').innerHTML='<div class="vrow"><span>Total messages</span><b>'+sel.length+'</b></div>'+
      '<div class="vrow"><span>Unique recipients</span><b>'+uniq+'</b></div>'+
      '<div class="vrow"><span>Category</span><b>'+esc(cats||'\u2014')+'</b></div>'+
      '<div class="vrow"><span>WhatsApp Business number</span><b>'+esc(num)+'</b></div>'+
      '<div class="vrow"><span>Generated by</span><b>'+esc((currentUser&&(currentUser.name||currentUser.user))||'\u2014')+'</b></div>'+
      '<div class="vrow"><span>Date &amp; time</span><b>'+now.toLocaleDateString('en-GB')+' '+now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</b></div>'+
      '<p class="ph-sub" style="margin-top:12px;">Please verify recipient details before sending. '+sel.length+' message(s) will open in WhatsApp for you to send.</p>';
    $('verifyFoot').innerHTML='<button class="btn btn-ghost" onclick="closeVerify()">Cancel</button><button class="btn btn-primary" id="verifyApprove" onclick="approveAndSend()">Approve &amp; Send</button>'; $('verifyOverlay').classList.add('show');
  }
  function closeVerify(){ $('verifyOverlay').classList.remove('show'); }
  function buildTplComponents(it, tpl){
    const keys=(tpl.vars||'').split(',').map(x=>x.trim()).filter(Boolean);
    if(!keys.length) return [];
    const params=keys.map(k=>({type:'text', text:String((it.vars&&it.vars[k]!=null)?it.vars[k]:'')}));
    return [{type:'body', parameters:params}];
  }
  async function approveAndSend(){
    if(currentUser && currentUser.role==='staff'){ toast('You do not have permission to approve & send'); return; }
    const sel=_review.items.filter(it=>it.sel && intlPhone(it.phone));
    if(!sel.length){ toast('No valid recipients'); return; }
    const by=(currentUser&&(currentUser.name||currentUser.user))||'\u2014'; const cfg=loadWaCfg(); const tpls=loadWaTpl();
    const apiReady=!!(window.electronAPI && window.electronAPI.sendWhatsApp && waHasToken(cfg) && cfg.pnid);
    const hist=loadWaHist(); const now=Date.now();
    if(!apiReady){
      sel.forEach(it=>{ hist.push({id:'wm'+now+Math.random().toString(36).slice(2,7), name:it.name, phone:it.phone, acno:it.acno||'', category:it.cat, content:it.msg, at:now, by, status:'Opened in app'}); });
      saveWaHist(hist);
      logAudit('WhatsApp Approved (manual send)', sel.length+' message(s) \u00b7 '+[...new Set(sel.map(s=>s.cat))].join(', ')+' \u00b7 by '+by);
      closeVerify(); closeReview();
      startBatch(sel.map(it=>({name:it.name, phone:it.phone, msg:it.msg})));
      return;
    }
    const ab=$('verifyApprove'); if(ab) ab.disabled=true;
    let okc=0, failc=0; const total=sel.length;
    for(let i=0;i<sel.length;i++){
      const it=sel[i]; const vb=$('verifyBody');
      if(vb) vb.innerHTML='<div style="text-align:center;padding:20px;">Sending <b>'+(i+1)+'</b> of '+total+'\u2026<div class="ph-sub" style="margin-top:6px;">'+esc(it.name||it.phone)+'</div></div>';
      const tpl=tpls[it.cat]; let res;
      if(!tpl || !tpl.name){ res={ok:false, error:'No approved template mapped for "'+it.cat+'"'}; }
      else { try{ res=await window.electronAPI.sendWhatsApp({apiVersion:(cfg.apiVersion||''), token:(cfg.token||''), phoneNumberId:cfg.pnid, to:intlPhone(it.phone), template:{name:tpl.name, lang:(it.lang||tpl.lang||'en'), components:buildTplComponents(it,tpl)}}); }catch(e){ res={ok:false, error:String(e)}; } }
      const rec={id:'wm'+now+i+Math.random().toString(36).slice(2,6), name:it.name, phone:it.phone, acno:it.acno||'', category:it.cat, content:it.msg, at:Date.now(), by};
      if(res && res.ok){ okc++; rec.status='Sent'; rec.mid=res.id||''; } else { failc++; rec.status='Failed'; rec.error=(res&&res.error)||'unknown'; }
      hist.push(rec);
    }
    saveWaHist(hist);
    logAudit('WhatsApp Sent via API', 'sent '+okc+', failed '+failc+' \u00b7 '+[...new Set(sel.map(s=>s.cat))].join(', ')+' \u00b7 by '+by);
    const vb=$('verifyBody'); if(vb) vb.innerHTML='<div style="text-align:center;padding:20px;"><div style="font-size:32px;color:'+(failc?'var(--warn)':'var(--ok)')+';">'+(failc?'\u26a0':'\u2713')+'</div><p style="font-weight:650;margin-top:8px;">'+okc+' sent'+(failc?(' \u00b7 '+failc+' failed'):'')+'</p><p class="ph-sub" style="margin-top:5px;">Open Message History for per-message status.</p></div>';
    const vf=$('verifyFoot'); if(vf) vf.innerHTML='<button class="btn btn-primary" onclick="closeVerify(); closeReview(); setMsgView(\'history\')">View History</button>';
    if(okc) toast(okc+' message(s) sent via WhatsApp API'); else toast('Sending failed \u2014 check History');
  }
  function renderWaHistory(){
    const wrap=$('waHistWrap'); if(!wrap) return;
    const q=($('waHistSearch')?$('waHistSearch').value:'').toLowerCase().trim();
    const f=$('waHistFilter')?$('waHistFilter').value:'all';
    const raw=loadWaHist();
    const fsel=$('waHistFilter'); if(fsel && fsel.dataset.built!=='1'){ const cats=[...new Set(raw.map(x=>x.category))]; fsel.innerHTML='<option value="all">All categories</option>'+cats.map(c=>'<option>'+esc(c)+'</option>').join(''); fsel.dataset.built='1'; }
    let items=raw.map((x,i)=>({x:x,i:i})).reverse();
    if(f!=='all') items=items.filter(o=>o.x.category===f);
    if(q) items=items.filter(o=>((o.x.name+' '+o.x.phone+' '+o.x.acno+' '+o.x.content+' '+o.x.by).toLowerCase().includes(q)));
    if(!items.length){ wrap.innerHTML='<div class="pay-empty">No messages sent yet.</div>'; return; }
    if(window._histQ!==q+'|'+f){ window._histQ=q+'|'+f; window._histPage=1; }
    if(!window._histPage) window._histPage=1;
    const _histShow=Math.min(items.length, window._histPage*50);
    const _histMore=items.length-_histShow;
    items=items.slice(0,_histShow);
    wrap.innerHTML='<div class="hist-list">'+items.map(o=>{ const x=o.x; const d=new Date(x.at);
      const stat=(x.status==='Sent')?'<span style="color:#16a34a;font-weight:600;">\u2713 Sent</span>':((x.status==='Failed')?'<span style="color:#dc2626;font-weight:600;">\u26a0 Failed</span>':'<span class="muted">'+esc(x.status||'\u2014')+'</span>');
      return '<details class="hist-item"><summary class="hist-sum">'
        +'<span class="hist-when">'+d.toLocaleDateString('en-GB')+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span>'
        +'<span class="hist-name">'+esc(x.name||'\u2014')+'</span>'
        +'<span class="pp ok hist-cat">'+esc(x.category||'')+'</span>'
        +'<span class="hist-stat">'+stat+'</span>'
        +'<button class="lnk del hist-del" onclick="deleteWaHist('+o.i+',event)">delete</button>'
        +'</summary>'
        +'<div class="hist-body"><div class="hist-meta"><b>Phone:</b> '+esc(x.phone||'\u2014')+' &nbsp;&middot;&nbsp; <b>Loan:</b> '+esc(x.acno||'\u2014')+' &nbsp;&middot;&nbsp; <b>Sent by:</b> '+esc(x.by||'\u2014')+'</div>'
        +'<div class="hist-msg">'+esc(x.content||'')+'</div>'
        +((x.status==='Failed'&&x.error)?'<div style="color:#dc2626;font-size:11px;margin-top:6px;">'+esc(x.error)+'</div>':'')
        +'</div></details>';
    }).join('')+'</div>'+(_histMore>0?('<button class="btn btn-sm" style="margin-top:8px;width:100%;" onclick="histMore()">Show more ('+_histMore+' older)</button>'):'');
  }
  window.histMore=function(){ window._histPage=(window._histPage||1)+1; renderWaHistory(); };
  function deleteWaHist(i, ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); } var h=loadWaHist(); if(i<0||i>=h.length) return; var e=h[i]; h.splice(i,1); saveWaHist(h); try{ logAudit('Message History Deleted', (e&&e.category?e.category+' \u2014 ':'')+((e&&e.name)||'')); }catch(_){} renderWaHistory(); toast('Message deleted from history'); }
  function clearWaHistAll(){ if(!loadWaHist().length){ toast('History is already empty'); return; } if(!confirm('Delete the entire message history? This cannot be undone.')) return; saveWaHist([]); try{ logAudit('Message History Cleared',''); }catch(_){} renderWaHistory(); toast('Message history cleared'); }
  function exportWaHistory(){
    const h=loadWaHist(); if(!h.length){ toast('No history to export'); return; }
    const rows=[['Date','Time','Borrower','Phone','Loan','Category','Message','Sent By','Status']];
    h.forEach(x=>{ const d=new Date(x.at); rows.push([d.toLocaleDateString('en-GB'), d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), x.name||'', x.phone||'', x.acno||'', x.category||'', (x.content||'').replace(/\n/g,' '), x.by||'', x.status||'']); });
    const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    download('WhatsApp_History.csv', csv, 'text/csv'); logAudit('Export','WhatsApp message history ('+h.length+')');
  }
  function renderWaSettings(){
    const c=loadWaCfg();
    if($('wa_bnumber')) $('wa_bnumber').value=c.bnumber||''; if($('wa_pnid')) $('wa_pnid').value=c.pnid||'';
    if($('wa_token')){ $('wa_token').value=''; $('wa_token').placeholder=(c.tokenEnc||c.token||c.tokenInKeychain)?'\u2022\u2022\u2022\u2022 token saved'+(c.tokenEnc?' (encrypted)':'')+' \u2014 paste a new one to replace':'Paste your permanent access token'; } if($('wa_baid')) $('wa_baid').value=c.baid||'';
    if($('wa_apiver')) $('wa_apiver').value=c.apiVersion||'';
    renderWaTemplates();
    const ok=!!(waHasToken(c) && c.pnid); const ind=$('waStatus'); if(ind){ ind.textContent=ok?'Configured':'Not configured'; ind.className='wa-stat '+(ok?'on':'off'); }
  }
  function saveWaSettings(){
    if(currentUser && currentUser.role!=='admin'){ toast('Only an admin can change WhatsApp settings'); return; }
    const c=loadWaCfg(); delete c.token; c.bnumber=($('wa_bnumber').value||'').trim(); c.pnid=($('wa_pnid').value||'').trim(); c.baid=($('wa_baid').value||'').trim();
    const tIn=($('wa_token').value||'').trim();
    (async function(){
      if(tIn){
        let stored=false;
        if(window.electronAPI && window.electronAPI.waTokenSave){
          try{ const r=await window.electronAPI.waTokenSave(tIn); stored=!!(r&&r.ok); }catch(e){}
        }
        if(stored){
          /* the token now lives ONLY in the Mac keychain, held by the app's main process */
          delete c.token; delete c.tokenEnc; c.tokenInKeychain=true;
        } else {
          /* browser / keychain unavailable: cannot send from here anyway */
          c.tokenInKeychain=false; c.token=tIn;
        }
      }
      if($('wa_apiver')){ var _av=($('wa_apiver').value||'').trim(); c.apiVersion = /^v\d+\.\d+$/.test(_av) ? _av : ''; }
      saveWaCfg(c); logAudit('WhatsApp Settings Saved',''); renderWaSettings(); toast('WhatsApp settings saved'+((tIn&&c.tokenEnc)?' (token encrypted)':''));
    })();
  }
  const WATPL_STORE="shivam_watpl_v1";
  function loadWaTpl(){ const defs={'EMI Reminder':{name:'emi_due_reminder',lang:'en',vars:'name,acno,emi,due_date'},'Overdue Reminder':{name:'overdue_reminder',lang:'en',vars:'name,acno,due_date,outstanding,fine'},'Greeting / Notice':{name:'festival_greeting',lang:'en',vars:'name,occasion'},'Office Closure':{name:'office_closure',lang:'en',vars:'name,occasion,date'},'Payment Confirmation':{name:'payment_received',lang:'en',vars:'name,amount,acno,outstanding'},'Loan Approval':{name:'loan_sanctioned',lang:'en',vars:'name,acno,emi'},'Final Notice':{name:'final_notice',lang:'en',vars:'name,outstanding,acno'},'Default Notice':{name:'default_notice',lang:'en',vars:'name,acno,arrears,outstanding'},'Birthday Greeting':{name:'birthday_greeting',lang:'en',vars:'name'},'Cheque Bounce':{name:'cheque_bounce_notice',lang:'en',vars:'name,cheque,acno,amount'},'Loan Closed':{name:'loan_closed_notice',lang:'en',vars:'name,acno'},'Cheque Cleared':{name:'cheque_cleared_notice',lang:'en',vars:'name,cheque,amount,acno'},'Loan Restructured':{name:'loan_restructured',lang:'en',vars:'name,acno,emi,tenure'},'Welcome / Account Opened':{name:'welcome_message',lang:'en',vars:'name,acno'}}; let saved={}; try{ saved=JSON.parse(localStorage.getItem(WATPL_STORE)||'{}')||{}; }catch(e){} const out={}; for(const k in defs){ out[k]=Object.assign({}, defs[k], saved[k]||{}); if(!out[k].name && defs[k].name) out[k].name=defs[k].name; if(!out[k].vars && defs[k].vars) out[k].vars=defs[k].vars; } return out; }
  function saveWaTpl(t){ try{ localStorage.setItem(WATPL_STORE, JSON.stringify(t)); }catch(e){} }
  const WA_TPL_CATS=['EMI Reminder','Overdue Reminder','Greeting / Notice','Office Closure','Payment Confirmation','Loan Approval','Final Notice','Default Notice','Birthday Greeting','Cheque Bounce','Loan Closed','Cheque Cleared','Loan Restructured','Welcome / Account Opened'];
  function renderWaTemplates(){
    const wrap=$('waTplWrap'); if(!wrap) return; const t=loadWaTpl();
    wrap.innerHTML='<div class="table-wrap"><table class="data"><thead><tr><th>Message type</th><th>Approved template name</th><th>Lang</th><th>Variables (in order)</th></tr></thead><tbody>'+
      WA_TPL_CATS.map((c,i)=>{ const cfg=t[c]||{}; return '<tr><td class="name">'+esc(c)+'</td>'+
        '<td><input id="tpln'+i+'" value="'+esc(cfg.name||'')+'" placeholder="exact_template_name" style="width:200px;border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:12.5px;background:var(--field);color:var(--text);font-family:inherit;"></td>'+
        '<td><input id="tpll'+i+'" value="'+esc(cfg.lang||'en')+'" style="width:60px;border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:12.5px;background:var(--field);color:var(--text);font-family:inherit;"></td>'+
        '<td><input id="tplv'+i+'" value="'+esc(cfg.vars||'')+'" style="width:250px;border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:12.5px;background:var(--field);color:var(--text);font-family:inherit;"></td></tr>'; }).join('')+'</tbody></table></div>';
  }
  function saveWaTemplates(){
    if(currentUser && currentUser.role!=='admin'){ toast('Only an admin can change templates'); return; }
    const t={}; WA_TPL_CATS.forEach((c,i)=>{ t[c]={name:($('tpln'+i).value||'').trim(), lang:($('tpll'+i).value||'en').trim(), vars:($('tplv'+i).value||'').trim()}; });
    saveWaTpl(t); logAudit('WhatsApp Templates Saved',''); toast('Template mapping saved');
  }
  async function waTestConnection(){
    const c=loadWaCfg();
    if(!(window.electronAPI && window.electronAPI.waTest)){ toast('Test Connection runs in the Mac desktop app'); return; }
    if(!(c.token||c.tokenInKeychain)||!c.pnid){ toast('Enter Access Token and Phone Number ID, then Save first'); return; }
    toast('Testing connection\u2026');
    try{ const r=await window.electronAPI.waTest({ apiVersion:(loadWaCfg().apiVersion||''), token:c.token, phoneNumberId:c.pnid});
      const ind=$('waStatus');
      if(r && r.ok){ if(ind){ ind.textContent='Connected'+(r.name?(' \u00b7 '+r.name):''); ind.className='wa-stat on'; } toast('Connected \u2713'); }
      else { if(ind){ ind.textContent='Disconnected'; ind.className='wa-stat off'; } toast('Connection failed: '+((r&&r.error)||'unknown')); }
    }catch(e){ toast('Connection test failed'); }
  }
  async function waSendTest(){
    const c=loadWaCfg(); const to=($('wa_testnum')?$('wa_testnum').value:'').trim();
    if(!(window.electronAPI && window.electronAPI.sendWhatsApp)){ toast('Sending runs in the Mac desktop app'); return; }
    if(!(c.token||c.tokenInKeychain)||!c.pnid){ toast('Save your Access Token & Phone Number ID first'); return; }
    const d=intlPhone(to); if(!d){ toast('Enter a valid test number'); return; }
    toast('Sending test (hello_world)\u2026');
    try{ const r=await window.electronAPI.sendWhatsApp({apiVersion:(c.apiVersion||''), token:(c.token||''), phoneNumberId:c.pnid, to:d, template:{name:'hello_world', lang:'en_US', components:[]}});
      if(r && r.ok){ toast('Test sent \u2713'); logAudit('WhatsApp Test Sent', d); } else toast('Test failed: '+((r&&r.error)||'unknown')); }
    catch(e){ toast('Test send failed'); }
  }

