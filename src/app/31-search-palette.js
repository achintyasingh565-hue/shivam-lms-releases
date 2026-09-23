/* ===========================================================================
 * src/app/31-search-palette.js
 *
 * Makes the existing top-bar search actually useful:
 *   • Ctrl/Cmd + K  (and the existing "/") jumps straight to it.
 *   • Typing shows a live result list — borrower, A/C numbers, phone and the
 *     amount outstanding — instead of Enter blindly opening the first match.
 *   • ↑/↓ moves through results, Enter opens the highlighted one, Esc clears.
 *
 * Built ON TOP of what already exists (buildCustomers / openCustomer / go), so
 * no existing search behaviour is replaced — Enter with nothing highlighted
 * still does exactly what it did before.
 * ======================================================================== */
(function () {
  var BOX=null, LIST=null, ROWS=[], SEL=-1;

  function _$(id){ return document.getElementById(id); }
  function _esc(s){ return (typeof esc==='function')?esc(s):String(s==null?'':s); }
  function _rs(v){ return (typeof inr==='function')?inr(v):String(v); }

  function _ensureList(){
    if(LIST && document.body.contains(LIST)) return LIST;
    var wrap=document.querySelector('.gsearch'); if(!wrap) return null;
    LIST=document.createElement('div');
    LIST.id='gsResults'; LIST.className='gs-results'; LIST.style.display='none';
    wrap.appendChild(LIST);
    return LIST;
  }

  function _matches(q){
    if(typeof buildCustomers!=='function') return [];
    q=String(q||'').trim().toLowerCase(); if(!q) return [];
    var list=buildCustomers();
    var out=[];
    list.forEach(function(c){
      var acs=(c.loans||[]).map(function(l){ return String(l.acno||''); }).join(' ');
      var hay=((c.name||'')+' '+(c.phone||'')+' '+acs).toLowerCase();
      if(hay.indexOf(q)<0) return;
      var out$=(c.loans||[]).reduce(function(a,l){ return a+(Number(l.outstanding)||0); },0);
      var open=(c.loans||[]).filter(function(l){ return (typeof autoStatus==='function'?autoStatus(l):l.status)!=='Closed'; }).length;
      out.push({ key:c.key, name:c.name||'(no name)', phone:c.phone||'', acs:acs.trim(), out:out$, open:open });
    });
    out.sort(function(a,b){
      var an=a.name.toLowerCase().indexOf(q), bn=b.name.toLowerCase().indexOf(q);   // name matches first
      if(an!==bn) return (an<0?99:an)-(bn<0?99:bn);
      return a.name.localeCompare(b.name);
    });
    return out.slice(0,8);
  }

  function _render(){
    var el=_ensureList(); if(!el) return;
    if(!ROWS.length){ el.style.display='none'; el.innerHTML=''; return; }
    el.innerHTML=ROWS.map(function(r,i){
      return '<button type="button" class="gs-row'+(i===SEL?' sel':'')+'" data-i="'+i+'">'
        +'<span class="gs-av">'+_esc((r.name||'?').slice(0,1).toUpperCase())+'</span>'
        +'<span class="gs-t"><span class="gs-n">'+_esc(r.name)+'</span>'
        +'<span class="gs-s">'+(r.acs?('A/C '+_esc(r.acs)):'')+(r.phone?((r.acs?' · ':'')+_esc(r.phone)):'')+'</span></span>'
        +'<span class="gs-r">'+_rs(r.out)+(r.open?('<span class="gs-o">'+r.open+' open</span>'):'')+'</span>'
        +'</button>';
    }).join('');
    el.style.display='block';
    Array.prototype.forEach.call(el.querySelectorAll('.gs-row'), function(b){
      b.addEventListener('mousedown', function(ev){ ev.preventDefault(); _openAt(+b.getAttribute('data-i')); });
    });
  }

  function _hide(){ ROWS=[]; SEL=-1; var el=_ensureList(); if(el){ el.style.display='none'; el.innerHTML=''; } }

  function _openAt(i){
    var r=ROWS[i]; if(!r) return;
    _hide();
    try{ if(typeof go==='function') go('cust'); }catch(e){}
    try{ if(typeof renderCustomers==='function') renderCustomers(); }catch(e){}
    try{ if(typeof openCustomer==='function') openCustomer(encodeURIComponent(r.key)); }catch(e){}
    var b=_$('globalSearch'); if(b) b.blur();
  }

  function _refresh(){
    var b=_$('globalSearch'); if(!b) return;
    ROWS=_matches(b.value); SEL=ROWS.length?0:-1; _render();
  }

  /* ---- wire the existing input without replacing its handlers ---- */
  function _wire(){
    BOX=_$('globalSearch'); if(!BOX || BOX._gsWired) return;
    BOX._gsWired=true;
    BOX.setAttribute('autocomplete','off');
    BOX.addEventListener('input', _refresh);
    BOX.addEventListener('focus', function(){ if(BOX.value.trim()) _refresh(); });
    BOX.addEventListener('blur', function(){ setTimeout(_hide, 120); });
    BOX.addEventListener('keydown', function(e){
      if(e.key==='ArrowDown'){ if(!ROWS.length) return; e.preventDefault(); SEL=(SEL+1)%ROWS.length; _render(); }
      else if(e.key==='ArrowUp'){ if(!ROWS.length) return; e.preventDefault(); SEL=(SEL-1+ROWS.length)%ROWS.length; _render(); }
      else if(e.key==='Enter'){
        if(SEL>=0 && ROWS[SEL]){ e.preventDefault(); e.stopPropagation(); _openAt(SEL); }
      }
      else if(e.key==='Escape'){ if(ROWS.length){ e.stopPropagation(); _hide(); } }
    }, true);                                   // capture: run before the inline Enter handler
  }

  /* ---- Ctrl/Cmd + K focuses the search (the modern convention) ---- */
  document.addEventListener('keydown', function(e){
    if(!(e.metaKey||e.ctrlKey) || e.shiftKey || e.altKey) return;
    if(String(e.key||'').toLowerCase()!=='k') return;
    var s=_$('globalSearch'); if(!s) return;
    e.preventDefault();
    s.focus(); try{ s.select(); }catch(x){}
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', _wire);
  else _wire();
  setTimeout(_wire, 500);
})();
