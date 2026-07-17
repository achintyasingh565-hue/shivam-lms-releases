  /* ---- UI ---- */
  function renderAutoRem(){ renderAutoPending(); }
  function renderAutoPending(){
    autoQueuePrune();
    var q=autoQueueLoad(); var host=$('autoPending'); if(!host) return;
    if(!q.length){ host.innerHTML='<div class="empty"><div class="big">&#10003;</div><div class="empty-t">You’re all caught up</div><div class="empty-s">No reminders waiting. Run a scan after recording payments, or as EMIs approach.</div></div>'; return; }
    var html='';
    WA_TPL_CATS.forEach(function(cat){
      var items=q.filter(function(it){ return it.cat===cat; }); if(!items.length) return;
      html+='<div class="panel"><div class="panel-head"><div class="t"><h3>'+esc(cat)+' <span class="ph-sub">('+items.length+')</span></h3></div>'
        +'<div class="actions"><button class="btn btn-sm" style="background:#25D366;color:#fff;" onclick="autoRemReview(\''+cat+'\')">&#9889; Review &amp; send</button>'
        +'<button class="btn btn-sm" onclick="autoRemClearCat(\''+cat+'\')">Clear</button></div></div>'
        +'<div class="table-wrap"><table class="data"><thead><tr><th>Borrower</th><th>Phone</th><th>Reason</th><th>Message</th><th></th></tr></thead><tbody>'
        + items.map(function(it){ return '<tr><td class="name">'+esc(it.name||'\u2014')+'</td><td class="muted">'+esc(it.phone||'\u2014')+'</td><td class="muted">'+esc(it.reason||'')+'</td><td class="muted" style="max-width:320px;font-size:11.5px;">'+esc(it.msg||'')+'</td><td><button class="lnk del" onclick="autoRemDismiss(\''+it.id+'\')">dismiss</button></td></tr>'; }).join('')
        +'</tbody></table></div></div>';
    });
    host.innerHTML=html;
  }
  function autoRemRunNow(){ var r={added:0}; try{ r=autoRemScan(); }catch(e){} toast('Scan complete \u2014 '+r.added+' new reminder'+(r.added===1?'':'s')); renderAutoRem(); }
  function autoRemReview(cat){ var q=autoQueueLoad().filter(function(it){ return it.cat===cat; }); if(!q.length){ toast('Nothing to review'); return; } openReviewQueue(q.map(function(it){
      var L=(typeof loans!=='undefined' && Array.isArray(loans))?loans.find(function(x){ return (x.acno||'')===(it.acno||''); }):null;
      var over=(it.cat==='Overdue Reminder');
      var tpl = over ? (it.lang==='hi'?TPL.overdue_hi:TPL.overdue) : (it.lang==='hi'?TPL.reminder_hi:TPL.reminder);
      var amt=null;
      if(it.vars){ var src = over ? it.vars.outstanding : it.vars.emi; if(src!=null) amt=Math.round(Number(String(src).replace(/[^0-9.]/g,''))||0); }
      return {name:it.name, phone:it.phone, acno:it.acno, cat:it.cat, msg:it.msg, vars:it.vars, tpl:tpl, loanId:(L?L.id:''), amt:amt};
    }), cat); }
  function autoRemDismiss(id){ autoQueueSave(autoQueueLoad().filter(function(it){ return it.id!==id; })); renderAutoPending(); }
  function autoRemClearCat(cat){ autoQueueSave(autoQueueLoad().filter(function(it){ return it.cat!==cat; })); toast('Cleared '+cat); renderAutoPending(); }
  function autoRemClearAll(){ autoQueueSave([]); toast('Pending reminders cleared'); renderAutoPending(); }

  function go(sec){
    recomputeAll();
    var _cvWanted='customers'; if(sec==='loans'){ sec='cust'; _cvWanted='loans'; }
    if(sec==='backup' && currentUser && currentUser.role!=='admin'){ toast('Only an administrator can open Administration'); sec='dash'; }
    document.querySelectorAll('.section').forEach(s=>{ s.classList.remove('active'); s.style.display='none'; });
    var _sec=$('sec-'+sec); _sec.style.display=''; _sec.classList.add('active');
    void _sec.offsetHeight; /* force reflow so the previous page can't ghost over the new one */
    try{ var _c=document.querySelector('.content'); if(_c) _c.scrollTop=0; window.scrollTo(0,0); }catch(e){}
    document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('active', a.dataset.sec===sec));
    $('pageTitle').textContent=titles[sec][0]; $('pageCrumb').textContent=titles[sec][1];
    if(sec==='dash') renderDash();
    if(sec==='cert'){ refreshLoanDropdown(); try{ if(window.fitDocPreview) fitDocPreview(); }catch(e){} }
    if(sec==='defaults'){ try{ recomputeAll(); }catch(e){} if(typeof renderDefaults==='function') renderDefaults(); }
    if(sec==='proposal'){ refreshPropDropdown(); try{ if(window.fitDocPreview) fitDocPreview(); }catch(e){} }
    if(sec==='hpfile'){ refreshHPDropdown(); updateHP(); try{ if(window.fitDocPreview) fitDocPreview(); }catch(e){} }
    if(sec==='messages') setMsgView('reminders');
    if(sec==='pay') renderPayTab();
    if(sec==='reports') renderReports();
    if(sec==='cust') setCustView(_cvWanted);
    if(sec==='backup'){ try{ renderRecycle(); }catch(e){} renderAudit(); try{ renderWaSettings(); }catch(e){} try{ fillTplForm(); }catch(e){} try{ if($('autoLockMins')) $('autoLockMins').value=autoLockCfg().mins; }catch(e){} try{ if(typeof renderCloudBackups==='function') renderCloudBackups(); }catch(e){} }
    if(window.innerWidth<=820){ var _ap=document.querySelector('.app'); if(_ap) _ap.classList.remove('nav-open'); }
  }
  $('nav').addEventListener('click', e=>{ const a=e.target.closest('a'); if(a) go(a.dataset.sec); });

  /* ---------- dashboard ---------- */
