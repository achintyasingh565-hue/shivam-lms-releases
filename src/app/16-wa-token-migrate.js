(function(){ var api=window.electronAPI; if(!api||!api.secureEncrypt) return;
  (async function(){ try{
    var c={}; try{ c=JSON.parse(localStorage.getItem('shivam_wacfg_v1')||'{}')||{}; }catch(e){}
    if(c.token){ var enc=await api.secureEncrypt(c.token);
      if(enc){ c.tokenEnc=enc; delete c.token; localStorage.setItem('shivam_wacfg_v1', JSON.stringify(c)); } }
    /* token is no longer decrypted into the renderer */
  }catch(e){} })();
})();
