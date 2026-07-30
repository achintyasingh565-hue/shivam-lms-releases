  /* ---- UI ---- */
  function renderAutoRem(){ renderAutoPending(); }
  function autoRemToggle(key, val){ try{ var c=autoRemCfg(); c[key]=!!val; autoRemSaveCfg(c); renderAutoRemToggles(); toast('Reminder settings saved'); }catch(e){} }
  function renderAutoRemToggles(){ try{ var c=autoRemCfg(); [['arm_emi','emi'],['arm_overdue','overdue'],['arm_payment','payment'],['arm_approval','approval'],['arm_birthday','birthday']].forEach(function(p){ var el=$(p[0]); if(el) el.checked=(c[p[1]]!==false); }); }catch(e){} }
  function renderAutoPending(){
    autoQueuePrune();
    renderAutoRemToggles();
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
  function autoRemDismiss(id){ var q=autoQueueLoad(); var it=q.find(function(x){ return x.id===id; }); autoQueueSave(q.filter(function(x){ return x.id!==id; })); if(it && typeof autoSeenRemove==='function') autoSeenRemove(it.key); renderAutoPending(); }
  function autoRemClearCat(cat){ var q=autoQueueLoad(); q.filter(function(it){ return it.cat===cat; }).forEach(function(it){ if(typeof autoSeenRemove==='function') autoSeenRemove(it.key); }); autoQueueSave(q.filter(function(it){ return it.cat!==cat; })); toast('Cleared '+cat); renderAutoPending(); }
  function autoRemClearAll(){ autoQueueSave([]); if(typeof autoSeenClearAll==='function') autoSeenClearAll(); toast('Pending reminders cleared'); renderAutoPending(); }

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
    if(sec==='backup'){ try{ renderRecycle(); }catch(e){} renderAudit(); try{ renderWaSettings(); }catch(e){} try{ fillTplForm(); }catch(e){} try{ if($('autoLockMins')) $('autoLockMins').value=autoLockCfg().mins; }catch(e){} try{ if(typeof renderCloudBackups==='function') renderCloudBackups(); }catch(e){} try{ if(typeof renderIdEncPanel==='function') renderIdEncPanel(); }catch(e){} try{ if(typeof renderUserRosterPanel==='function') renderUserRosterPanel(); }catch(e){} try{ if(typeof pullUserRoster==='function') pullUserRoster(); }catch(e){} }
    if(window.innerWidth<=820){ var _ap=document.querySelector('.app'); if(_ap) _ap.classList.remove('nav-open'); }
  }
  $('nav').addEventListener('click', e=>{ const a=e.target.closest('a'); if(a) go(a.dataset.sec); });

  /* Re-render whatever section is currently on screen, in place. Used after a
     background data change (cloud sync from the other device) or a local save, so
     changes always show WITHOUT closing and reopening the app. It is deliberately
     conservative: it does nothing while a dialog is open or while the user is
     typing in a field (so a sync can never wipe half-entered data), and it never
     switches the sub-tab the user is on. */
  window.refreshActiveView=function(){
    try{
      if(document.querySelector('.overlay.show')) return;                 // a modal is open — leave it alone
      var active=document.querySelector('.section.active'); if(!active || !active.id) return;
      var ae=document.activeElement;
      // Skip only if the user is typing INSIDE this screen's own fields (e.g. the
      // payment-entry or notice form). A focused top-bar search box must NOT block
      // the data view from refreshing.
      if(ae && active.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName||'')) return;
      var sec=active.id.replace(/^sec-/,'');
      if(sec==='dash'){ if(typeof renderDash==='function') renderDash(); }
      else if(sec==='reports'){ if(typeof renderReports==='function') renderReports(); }
      else if(sec==='pay'){ if(typeof renderPayTab==='function') renderPayTab(); }
      else if(sec==='defaults'){ try{ recomputeAll(); }catch(e){} if(typeof renderDefaults==='function') renderDefaults(); }
      else if(sec==='messages'){
        var cur='reminders'; ['reminders','greetings','history'].forEach(function(k){ var e=$('mv-'+k); if(e && e.style.display!=='none') cur=k; });
        if(typeof setMsgView==='function') setMsgView(cur);   // refresh the CURRENT sub-tab, don't switch it
      }
      else if(sec==='cert'){ if(typeof refreshLoanDropdown==='function') refreshLoanDropdown(); }
      else if(sec==='proposal'){ if(typeof refreshPropDropdown==='function') refreshPropDropdown(); }
      else if(sec==='hpfile'){ if(typeof refreshHPDropdown==='function') refreshHPDropdown(); }
      // 'cust' is already refreshed by renderLoans(); 'backup' is intentionally skipped
      // so a background sync never resets the settings forms.
    }catch(e){}
  };

  /* Manual "↻ Refresh" button in the top bar — a one-click way to pull the latest
     from the other device and redraw the current screen, so the user never has to
     close and reopen the app. Safe to press any time. */
  window.manualRefresh=function(btn){
    try{ if(btn){ btn.disabled=true; btn.style.opacity='.5'; setTimeout(function(){ try{ btn.disabled=false; btn.style.opacity=''; }catch(e){} }, 900); } }catch(e){}
    try{ if(typeof recomputeAll==='function') recomputeAll(); }catch(e){}
    try{ if(typeof renderLoans==='function') renderLoans(); }catch(e){}       // customers + open profile
    try{ if(typeof renderDash==='function') renderDash(); }catch(e){}
    try{ if(typeof window.refreshActiveView==='function') window.refreshActiveView(); }catch(e){}
    try{ if(typeof cloudPullNow==='function') cloudPullNow(); }catch(e){}      // fetch newest from the other device (re-renders again on arrival)
    try{ toast('Refreshed'); }catch(e){}
  };

  /* ---------- dashboard ---------- */
