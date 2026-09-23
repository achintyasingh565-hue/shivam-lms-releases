/* ===========================================================================
 * src/app/30-ux-polish.js
 *
 * Interaction polish that applies app-wide without touching any screen's
 * markup. Everything here is additive and fail-safe: if an element isn't
 * present the handler simply does nothing.
 *
 *   • Esc closes whichever sheet/overlay is open (only the most recently opened one).
 *   • Clicking the dark backdrop closes it too — except sheets holding unsaved work.
 *   • Focus moves into a sheet when it opens and returns to where you were
 *     when it closes, so keyboard use never "falls through" to the page.
 *   • Tab is trapped inside an open sheet.
 * ======================================================================== */
(function () {
  var OVERLAYS = [
    { sel:'#bulkOverlay',   close:'closeBulkEntry',      backdrop:false },  // grid holds unsaved work
    { sel:'#payRegOverlay', close:'closePayRegister',    backdrop:true  },
    { sel:'#chgRegOverlay', close:'closeChargeRegister', backdrop:true  },
    { sel:'#blOverlay',     close:'closeBlankLetter',    backdrop:false }   // letter draft
  ];

  function _visible(el){
    if(!el) return false;
    var s=window.getComputedStyle(el);
    return s.display!=='none' && s.visibility!=='hidden';
  }
  /* The "top" overlay is the one opened MOST RECENTLY, not the first in a list —
     otherwise Esc closes the wrong sheet when two are open at once. STACK is kept
     in real open order by the observers below; DOM order is only a fallback. */
  var STACK=[];
  function _push(sel){ var i=STACK.indexOf(sel); if(i>=0) STACK.splice(i,1); STACK.push(sel); }
  function _pop(sel){ var i=STACK.indexOf(sel); if(i>=0) STACK.splice(i,1); }
  function _open(){
    for(var i=STACK.length-1;i>=0;i--){
      var sel=STACK[i], el=document.querySelector(sel);
      if(_visible(el)){
        var conf=null;
        OVERLAYS.forEach(function(o){ if(o.sel===sel) conf=o; });
        if(conf) return { el:el, conf:conf };
      }
      STACK.splice(i,1);                                  // stale entry
    }
    var found=null;                                       // fallback: last visible in DOM order
    OVERLAYS.forEach(function(o){
      var el=document.querySelector(o.sel);
      if(_visible(el)) found={ el:el, conf:o };
    });
    return found;
  }
  function _close(entry){
    if(!entry) return;
    var fn=window[entry.conf.close];
    if(typeof fn==='function'){ try{ fn(); return; }catch(e){} }
    entry.el.style.display='none';                       // fallback
  }

  var _lastFocus=null;

  /* ---- Esc closes the top sheet ---- */
  document.addEventListener('keydown', function(e){
    if(e.key!=='Escape') return;
    var entry=_open(); if(!entry) return;
    e.preventDefault();
    _close(entry);
  });

  /* ---- Click the dark backdrop to close, where it is safe to do so.
          Both the press AND the release must land on the backdrop, so dragging a text
          selection out of the sheet and releasing outside can never dismiss it. Sheets
          that hold unsaved work (bulk grid, letter draft) opt out via backdrop:false. ---- */
  var _downOnBackdrop=false;
  document.addEventListener('mousedown', function(e){
    var entry=_open();
    _downOnBackdrop = !!(entry && entry.conf.backdrop && e.target===entry.el);
  });
  document.addEventListener('click', function(e){
    if(!_downOnBackdrop) return;
    _downOnBackdrop=false;
    var entry=_open(); if(!entry || !entry.conf.backdrop) return;
    if(e.target===entry.el) _close(entry);
  });

  /* ---- Trap Tab inside an open sheet ---- */
  var FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  document.addEventListener('keydown', function(e){
    if(e.key!=='Tab') return;
    var entry=_open(); if(!entry) return;
    var list=Array.prototype.filter.call(entry.el.querySelectorAll(FOCUSABLE), function(el){
      return el.offsetParent!==null || el===document.activeElement;
    });
    if(!list.length) return;
    var first=list[0], last=list[list.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  });

  /* ---- When a sheet opens, remember where focus was and move it inside;
          when it closes, put focus back. Watched rather than hooked, so no
          existing open/close function needs changing. ---- */
  function _watch(conf){
    var el=document.querySelector(conf.sel); if(!el || el._uxWatched) return;
    el._uxWatched=true;
    var was=_visible(el);
    try{
      new MutationObserver(function(){
        var now=_visible(el);
        if(now===was) return;
        was=now;
        if(now){
          _push(conf.sel);
          _lastFocus=document.activeElement;
          setTimeout(function(){
            var f=el.querySelector('input:not([type=hidden]):not([disabled]),select,button');
            if(f){ try{ f.focus(); }catch(e){} }
          }, 40);
        } else {
          _pop(conf.sel);
          if(_lastFocus && document.contains(_lastFocus)){
            try{ _lastFocus.focus(); }catch(e){}
            _lastFocus=null;
          }
        }
      }).observe(el, { attributes:true, attributeFilter:['style','class'] });
    }catch(e){}
  }
  function _watchAll(){ OVERLAYS.forEach(_watch); }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', _watchAll);
  else _watchAll();
  setTimeout(_watchAll, 600);                    // catch anything rendered late
})();
