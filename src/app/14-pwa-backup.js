  /* ---------- PWA / install ---------- */
  const ICON512="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", ICON192="iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAABmJLR0QA/wD/AP+gvaeTAAAWs0lEQVR4nO3de1hVVd4H8O/a58YBvOMNRRFQQRC8EBhqjVpaNtXkJGnmvSfNmqapqZwxfTWz6To2zTQzlqaYqSGTTWoNljcUBcG74A2FQBAvlNwP57LX+4fa69vI3mefszcH2b/P8/T0x15nrcXj+p6z1t5r7w0QQgghhBBCCCGEEEIIIYQQQgghhLQYzNcd8NaeFX2DzQYhwgWhrQAEcKAV42IbURAEX/etJWGcOznjlYLIKkWB/8jBKgKY8XTclKO1vu6bN26rAOxd2T+SMecIAWwoB4sEeB8ArXzdLx0TARSA4QgDDosM24acy89hCyH6umPuatYByF022OSw2O5n4OMBjAQQ7Os+EVnlYHwTF4VNrQOQHp2cZ/d1h6Q0ywBkrYoczJgwFZxN4OAdfd0f4rELjGEZE9myhOl55b7uzK00qwDsX9VvlAjMAzDC130hqrIDSGVMXJw49eRpX3fmZs0iAFmrYkYD4iIAQ3zdF6IpB2P4p8HkfC3+8dNXfN0ZwMcByFoT2x1O51IAj/qyH6SpsUqALy72z38/ORkun/bEF42mpsLQo67f8wAWAgj0RR+I7zHG97oEYWrS5LwCn/WhqRvM/TSqq9PFPoOX83yni6H4CkPpZQNKKwRcuspQ13DtP5uDocGhUocJAMBiAgL8OAL8OAL9OHp0FNGriwuhnUVYzdybqmsZx+8TpuUvYwxeVeSJJg1A1sqoe8HYpwA6K/0s58DpUgMOnTXiaKERJ84LsDuaxRJG1xgDwru6kNjXiSF9nQjr6tmMhjOs5daqJ5OSz9er3EVJTTaCsldF/46DvwtA0RXai1cFbDtswvajJlyooIu7zV23DiIeTLTjnoEOT34Z9jtdrkeGzTxVpkXfbkXzAHAOlr263xvgmKvkc+fKDUjdbUZmnglik/8wEm/5WzjGDHYgeXgDWvsr+QdkpQLHLxOm5x3WrHM3t6Zl5ampMPSo7/cROGa4+5nSCgHL0/2Qc9oITgP/thfox/HYXQ14aIgDRoPb/6A/AOLoIdNOHtCyb4CGAbj+zb/c3cFvdzCk7rZgwx4TnC6a27c0we1FvDCuHlEhbq8RrgqcjU6YnpejZb80G2nZK6Pe5Iy94k7Zc+UGvJlqRSnN8Vs0QeD4dZIDk0baYDK48wlWCbhGaflLoEkA9qVEv8A4f8+dsl/nmPHRfyxwOOlbXy/6dHNh/sR6tG/l1qbRC0aBDYmfklesRV9UH3XXT3X+BzJne0SR4W+bLEg/aFa7C+Q20KG1iPkT6tC7mzshYMdgbBg25ImCKrX7oeqcI/fTqK7Xz/NL1utwMiz53EqDX8cqqgS8vDIAOaeNbpTm/ZnT/DlfqO54BQC3ZmLuSE2FoZW905cAYqTKOZwMC9b440CBO384aclcIkNmvglhXVzoFiT7SxBR1q6jffmXl3er2QfVEnV9b4/k9gZRZHhrgx+OFqqWO3Kbc7iANz73R9ZJ+S9EzrEoa2WUqjuGVVkDXN/VeQIyG9s++MoP6Qdo2kP+m9nE8cbUekSFOGVKskJjQ/3A+FnnKtVoV51fAKfzfcgM/i37zTT4SaPsDobF66xubHfhvZxm6xtqtet1AK7dzIJfS5U5V27Ax+kWb5siLVxlLcNr6/xhk7uLmGFW1qrIwWq0qcIvgLhI6qjdwfBmqpXO8xO3FF8WsOxrP5lS3AAIf1fjrJBXFWR/Ej0SMrcxpu620BVeosjWQ2ZkHDfJFUvIDu031du2vBqZ3MDnSR0vrRCwYY/sH0LIf/lwkx+u1srOGl7dseMXXp1P9zgA+z6JGgSOkVJllqf70cY24pEaG8MnW2XXjWHW7y9N9qYdjwMgGNg0qePnLgpuXuUj5Na2HzHjWJH0NSMGzPPmV8CjAOQuG2wCZxOkyqTustB+fuIVzoEVW63SZYBw/+KLD3rahkcBcFhs90s9sa38RwGZ+TT3J947Uyo/k+BcmOlp/R4F4PqzOhu1/QjdxkjUs3an7Frgvr0pfbp5Urena4BGF7+cA9uP0rc/Uc/pUgPyvpdaC3CDwI1TPKlbcQByVvTtC4mnNJ8uNdDTG4jqtspunWcerQMUj1SnQZA89XnwLO30JOrLyDOixiZ5Sj0hOyWyg9J6FQeAgSVJHT9WSNMfoj67gyHnlNRimBu4yO5VWq8HcxUe2dgRh5Mhv4SmP0QbuWekzwYxJoxSWqcHo5X1aexISQWjTW9EM4fOGSXPLnLO+yutU1EA9qzoGwygdWPHSy/T/J9op7KWoeSyxJBliFa6Q1RRYbNBiJA6fr6Cvv2Jtr6/JPklG7g3NKaXkvoUBcDFhTZSxy9fpfk/0VbRRekxZoIYqqQ+ZSOW8UanPwBQ20ABINq6XCk9xkSwtkrqUzZfYtL3/dY3KKmNEOVkrgWAQdQuAJxLB8BGL6wgGquVCYDIpKfpP6dszsKZ5FUul09fd0b0QG6MMRGKHj1Ck3aiaxQAomsUAKJrFACiaxQAomsUAKJrFACiaxQAomsUAKJrFACiaxQAomsUAKJrFACiaxQAomsUAKJrFACiaxQAomsUAKJrFACiaxQAomv0FrufEQQBwV06ISSkG4I6tEe7tq3hZ/WD2WQC5xx2hwN1dfWorKzG5SsVKCsrx/mycnB6IdptiQIAoH9MJEbcNRR3JgxEdL8+sFqlX8z2c/X19cg7cQbZOYewbcceHMs76VV/3ntzPh56YLRXdagl/dudePaF+b7uhmZ0GwCzyYRfPXwfZkx+DOFhPb2qy2q1In5QLOIHxeKZWVNxpqAQy1euw5eb0yGKoko9JlrQ5RogfnActmxMwZL/ednrwX8rvSN64a0lf8T61X9Hp05BqtdP1KO7AEyeOA5rVnyA0J4hmrc1MC4a//58OWL69dW8LeIZXQVg0oRHsOCPv4PB0HR/dlBQByz765sIClL8+irSBHQTgP4xkZj3ynM+abtTpyD85Z2FPmmbSNPNInjBH56Hyejen1tefgm7dmfhaP5JFBeXoqq6GvX1NlgsFrQKDECv0BDERkfhnpHD0KFDe7fqTIgfgBF3J2HHrr3e/BlEZboIwKABMRgQGy1brqq6Bq+/+Rd8tWUrXK7Gz97kHDiC1H9txqI3lmLC+Ifw8gtPw8/PT7b+Z2dPUy0Ap06fw8Il76lSl5QffryqeRu+pIsA3Dd6hGwZm82Gx6c9g1Onz7ldr8PpxKfrvsChI3lYs/IDBPj7S5aPjYlCRHgoCs4Wud1GY2pqa5F78KjX9eidLtYAgwbEyJZZtSZN0eC/2fH8U5i/6F23yt41bIhHbRBt6CIAPXt0ly2zM8O7qcnmb77DyVMFjR4XRRFl5RfRoZ2iF5gQjeliCtS6leSLbQB4P9flnCNt4xY89uhDKC4pRXHpBZQUn0dxSRmKz5eitLQcdofDqzaI+nQRAJcoQhCkf+yCu3ZBYVGJV+2kfJaGlM/SvKqDNC1dTIGqq2tky4y55+4m6AlpbnQRgLILF2XLjB/3SyTdGd8EvSHNiS4CcOhInmwZo9GAjz98G09OnwizWfJdgKQF0UUAduzMdKuc2WTCKy/Mwbdb1uE3T09DZJ9wjXtGfE0Xi+A9+3JQWFSCXqHu7QAN7tIZz82ZiefmzMSlS1eQlXMQ2bmHcejwcRScLaK7v1oQXQSAc44lb32A5f94R/FnO3UKwkMPjP7pDq3qmhocPpqPQ4eP4eDhPBw6chx1dfVqd1lWYEAA4gfFalZ/ZVU1zhQUalZ/c6GLAADArj1ZSPksDVMnPepVPa0CAzE8KQHDkxIAAE6nC8fyTmJf9gHszNiLI8dONMldYH37hGFdyoea1b97737MmPWiZvU3F7oJAAAseesDGA0GTJrwiGp1Go0GDIyLxsC4aMx5agoqfvgRm7/Zhg1fbPJ4awVpOrpYBN/AOcfCJX/Gi3MX42pllSZtdGjfDlMnPYrN/0rB8n+8g6jICE3aIerQVQBu+GrLVoy6/zEsW7EGVW5cJPPU3cOGYOP6FXjxt7Oa9C404j7d/qtUVdfg3feXYejIR/CHBX9C5r4cTfbqGAwCZj/5BD5cuoRC0Azpag1wKzabDWkbv0baxq9htVqReMdAJA0ZjMT4gYjsGy67h8hdo0YMw7xXfovX3liqSn1EHboPwM3q6+uxM2PvT1ujAwMCMGhADOJioxEXG4XYmCi0a9vG4/onTxyHXRn7sGtPllpdJl6iAEioqa1FRmY2MjKzAQCMMYSH9cTgQbEYnpSAoXfGIzAgQFGdLzz3FDIys72+mHbg0DFMmDLHqzoIBUARzjkKzhah4GwRPt/wFcxmE0aNGIY5T011e9tEv6jeGDQgBgcOHdO4t8QdtCrzgt3uwDfpO/DQo9Mx/7V34HA63frcsOsX0YjvUQBUwDnH+g1f4ck5L8HpdMmWT4gf0AS9Iu6gAKho775cpG3cIluuIz0lrtnQbQD8/a3oHx2per3fbd8tW6ZdO8/PJBF1tfhFcKvAQESE90REeCgiwntd/38ounbuBMYYkp+Y7dYNM+66UvGDbBmj0aBae8Q7LTYAZpMJ6ZvXontwF8ly48c9qGoAOrRvJ1vGnXuUSdNosVMgu8OBc4Xfy5Yb9/D9iOyr3oa1YUPlz/AUl5Sp1h7xTosNAACkf7dLtozBIODDpUvQXoUHVoV0D8b4cQ/Iljt23LtXKBH1tOgAfPOfHW5te+4REoy0tcu8WhT3juiFT/75nltXhnfu3udxO0RdLXYNAFy7ffEfH63GH156VrZsSPdg/GvdR9i6LQMbvtiCrJyDaLA1SH7GaDRgQGw0xj08Fg8/OBpmk/zTJIq+L8H+3MNu/w2N0fqWyJuJooiDh483SVtNrUUHAADWrP8CE5N/hdCe8s8HZYxhzD13Y8w9d8Nuv7aGKCwqQWVVNerq6gDGYPXzQ+tWAegR0h1hYT1knwj9c3/+68eq3FSv9S2RN7PbHYgePLJJ2mpqLT4AdrsDTz37MtLWfuTWM0JvMJtNiOwboeoC+Zv0HfgmfYdq9RHvteg1wA2FRSV49nevyk5ptHTw8HHMXfAnn7VPbk0XAQCAfdkH8OgTs31yCvLb7bsxY9aLPnl8CpGmmwAAwMlTBfhV8kykpm1ye+emN65WVmHeorfxzPPzUFtXp3l7RDldBQC4dmZo3qK3MfqBiUhN26TJt3LJ+TK8+/4yjBiTjNS0TfQkuWasxS+CG3O+rBzzFr2NRX9aisT4gRj5i6GIHxSLXj1DYPGzKKqrprYWefmnsT/3CDL2ZOHIsXwa9LcJ3QbgBrvdgd1792P33v0AAEEQ0C24C3r1DEGbNq3hH2BFgNUKq/XaWyDtDgdqa+twtbIKly5X4HzpBVy8eFnVAf/i3MV4ce5i1eojjdN9AH5OFEWUnC9DyXnar6MHulsDEHIzCgDRNQoA0TUKANE1CgDRNQoA0TUKANE1CgDRNQoA0TUKANE1CgDRNQoA0TUKANE1CgDRNQoA0TVFAeAC7FLHDfTQY6Ix2THGuKJ33Sr8BRAlnzMY4Ee3ARJtWc1yY4xVK6lPUQAYhKtSx/0tFACiLbkxxgDtAgBRrJQ63LmtqKg6QpSyyj2vgGn4CyAahUKp4z07UQCItuS+ZEXOf1RSn6IA3Hk27xyARp/wRAEgWuseJP0WTgPHWSX1KVsDLIQI8PzGjvfoKKK1P60DiHa6dZAaX6wyYXpeuZL6FF8H4BCONFqZwDEgTPtHDhJ9spiAbpK/APyU0joVB0Dg2C51fHBvCgDRRr8eTpgkrwMwxe+eUhwAg8WxFUCjk/07o5ywyL8ohRDF4uRnF5lK61QcgPjHT18BkNvY8QALR1I/RRfjCHHLoHDpBbBokJ6d3IpHe4E4+Cap4/cNogAQdXUPEhHetfEAcKA4aXJegdJ6PQqAQTSkAKzR3sSEOtG7G50SJeoZGSf9pcqAbZ7U61EAEmYcLwH4VqkyE++yeVI1If9FEDhGyASAM2zwqG6PegSAc2G51PGEvk6ESfxkEeKuu6Kd6NRGckZRbuvR6VtP6vY4ACUBx/8N4ExjxxkDZt9vA2OetkDItXE0frjkLnxw8HUjRuz06Py7xwFIToaLgb8lVSa6pwu/iKUFMfFcUpQToZ3ltj8Iqz2t36s7wgwN/qsBFEmVmTnahkC6T4B4wGzimDFabi3Jvk2YnnfY0za8CkD8rAMOBv66VJl2gRzPPEgLYqJc8vAGdGknfTZRgCg5/uR4fU9wQtGJlRzIkSpzV4wD9w6kqRBxX0hHEeOHyY6ZjIRpJzK8acfrALCFEAVBmAOJ7RHAtQVxSEe6NkDkWUzA3PH1MBokp85cFMQF3ralylMhEqccz+XAR1Jl/CwcCyfVoW0ArQeItFljbbILXwasTZpycpe3ban2WBRTg20uwCTvGOvSTsSrE+thMlIIyK2NvcOOMYOkT3sCqDIY+EtqtKdaAOJnnatkzDUJgOT52KgQJ+aOr5fZ1kr0aGg/J54e2yBbjgPz4yefuKBGm6o+GCtx6sl9HHyhXLkhkU788bE6uTke0ZEBYU689Ot6CILcmOBbhxTl/02tdlX/Hl4+4EpmWduOiQAipMp1CxLRO1jEvhMmuGhtrGtD+znx6gS3psZlLsE0psdvL9ao1bYmGxWy1kS0htOyB+D95coWlBmweL0/rlTSngk9GnuHHU+PbXDjm5+5OGf33Dn9+E4129ds1OWuju7hFHkWgK5yZX+oZnh9vT9OnaeFgV6YTRyzxza4s+AFADDGfpM4NU+1qc9P9apd4c2yVkUOBgzbAN5GrqzDBazdYUFaphmiSL8GLVlIRxFzx9fLnur8P+z1IdPy5mvRF81H2v6V0XeIjKcDaOdO+RMlRizd6IfSCnpwdUtjNnEkD2/A+GEO90+AMP5x4pQTsxiDJmdMmuSr9tovgbAVQHt3yjtdDJuyTVifYUFNPf0a3O4Edu1hCTNG22T39vw/jH9cbD3xdHIyNLuxpMlG1/6V0QNEhs0A7+buZ6rrGT7PsCD9gAl1DRSE240gcAyPdiJ5uF3BdOcG9nri1LwFWn3z/9SKlpX/XO6nUV2dLvYlgAQln6u3M3x3yITN+804f4WmRs1d9yARI+McGBHnkLuT6xaYizE8r8WC95atNUUjN9uxMtTPT/BfwTge9+Tz5y4KyD5pRPYpM86WCRDpWprPWUzXHloVF+bEwDAXIoI9nrGUiYL4uBp7fNzlk3kF52D7V/d7inO8CyDQ03psDQyFlwwouijg+0sCam0MNTaGWhtDA+2+VpXFBPiZOPwtHIFWjo5tOLoHudCtA0f3ji4Yvf5h5ltdgmny0ClHL6nRX3f5dGKduSom3AAxBcBQX/aD+FQVGF+QWHjir9cevty0fL6yTE2FoWdd9HMcfAGAtr7uD2k6nGGtSeC/V2tjmyd8HoAbslMiO3AuLADwNAB6umjLliEK4oKmnOs3ptkE4IaslVG9wYRXGfhjHJB7IQ65rfCtjLPXE6fn7/Z1T25odgG4IevjmM4w8qfA+GwAwb7uD/FYOQdfJ7iElMSZeY2+W8JXmm0AbshdNtjkNNfdC8YeBvBLUBiaPQ4UM2AbZ9hg69HpW08fWtUUmn0AbsY5WM6q6HgRGAVgABiPA1hvgNM2Up9hlRz8NAM7ASBTNGC7J09p9pXbKgC3krtssL/LaOstGsWOjAttGMS2HKwtZ8zo6761JIIoipwJleBiFRMMNRDFSgZ2Ruk7uQghhBBCCCGEEEIIIYQQQgghhBBCiGb+F9w2PDbPswa6AAAAAElFTkSuQmCC";
  let deferredPrompt=null;
  function setupPWA(){
    try{
      const manifest={ name:"Shivam Enterprises LMS", short_name:"SE LMS",
        start_url:".", scope:".", display:"standalone", background_color:"#13203b", theme_color:"#13203b",
        description:"Loan records, certificates and proposal forms for Shivam Enterprises (Finance).",
        icons:[ {src:ICON192,sizes:"192x192",type:"image/png",purpose:"any maskable"},
                {src:ICON512,sizes:"512x512",type:"image/png",purpose:"any maskable"} ] };
      const blob=new Blob([JSON.stringify(manifest)],{type:"application/manifest+json"});
      const mf=$('mf'); if(mf) mf.href=URL.createObjectURL(blob);
    }catch(e){}
    window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; });
    window.addEventListener('appinstalled',()=>{ toast('App installed'); const b=$('installBtn'); if(b) b.style.display='none'; });
  }
  function doInstall(){
    if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice.finally(()=>{ deferredPrompt=null; }); return; }
    showInstallHelp();
  }
  function showInstallHelp(){
    const m=$('installOverlay'); if(m) m.classList.add('show');
  }
  function closeInstall(){ const m=$('installOverlay'); if(m) m.classList.remove('show'); }

  function resetCert(){ ['f_name','f_relname','f_addr','f_ref'].forEach(id=>$(id).value=""); $('f_loan').value="personal loan"; $('f_mode').value="Cash"; $('f_reltype').value="son of"; $('f_date').value=todayISO(); $('loadLoan').value=""; updateCert(); }

  /* ---------- backup ---------- */
  function download(filename, text, type){
    const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  }
  /* ===== Customer Profiles ===== */
  let currentCust=null;
  function custKeyOf(l){ const ph=(l.phone||'').replace(/\D/g,''); const nm=(l.name||'').trim().toLowerCase(); return (ph?('ph:'+ph):'ph:') + '|nm:' + nm; }
  function buildCustomers(){
    const map={};
    loans.forEach(l=>{ const k=custKeyOf(l);
      if(!map[k]) map[k]={key:k, name:l.name||'', phone:l.phone||'', addr:l.addr||'', reltype:l.reltype||'', relname:l.relname||'', idtype:l.idtype||'', idproof:l.idproof||'', age:l.age||'', occupation:l.occupation||'', loans:[]};
      const c=map[k];
      if(!c.phone&&l.phone)c.phone=l.phone; if(!c.addr&&l.addr)c.addr=l.addr;
      if(!c.idproof&&l.idproof){ c.idproof=l.idproof; c.idtype=l.idtype||c.idtype; }
      if(!c.relname&&l.relname){ c.relname=l.relname; c.reltype=l.reltype||c.reltype; }
      if(!c.occupation&&l.occupation)c.occupation=l.occupation; if(!c.age&&l.age)c.age=l.age;
      c.loans.push(l);
    });
    return Object.values(map).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  }
  function setCustView(v){
    renderCustomers();
    if(currentCust && buildCustomers().some(function(x){return x.key===currentCust;})) openCustomer(encodeURIComponent(currentCust));
    else { var cs=buildCustomers(); if(cs.length) openCustomer(encodeURIComponent(cs[0].key)); else custBack(); }
  }
  const CUST_PAGE=150;
  function renderCustomers(){
    const body=$('custBody'); if(!body) return;
    // Single source of search: the top-bar box (the in-panel duplicate was removed).
    const q=($('globalSearch')?$('globalSearch').value:'').toLowerCase().trim();
    if(window._custQ!==q){ window._custQ=q; window._custPage=1; }
    if(!window._custPage) window._custPage=1;
    let cs=buildCustomers();
    const total=cs.length;
    if(q) cs=cs.filter(c=>((c.name+' '+(c.phone||'')+' '+c.loans.map(l=>l.acno).join(' ')).toLowerCase().includes(q)));
    if($('custCount')) $('custCount').textContent = q ? (cs.length+' of '+total+' borrower'+(total!==1?'s':'')+' match') : (total+' borrower'+(total!==1?'s':''));
    if(!cs.length){ body.innerHTML='<div class="cl-empty" style="padding:30px 14px;"><b>No customers'+(q?' match your search':' yet')+'.</b>'+(q?'':'<br>Add a loan to create a customer profile.')+'</div>'; return; }
    const show=Math.min(cs.length, window._custPage*CUST_PAGE);
    const cards=cs.slice(0,show).map(c=>{ const out=c.loans.reduce((a,l)=>a+(Number(l.outstanding)||0),0); const allClosed=c.loans.every(l=>autoStatus(l)==='Closed'); const anyOver=c.loans.some(l=>autoStatus(l)==='Overdue'); const st=allClosed?'Closed':(anyOver?'Overdue':'Active');
      return `<div class="cl-card${currentCust===c.key?' sel':''}" onclick="openCustomer('${encodeURIComponent(c.key)}')">
        <div class="r1"><div><div class="nm">${esc(c.name)}</div><div class="ph">${esc(c.phone||'\u2014')}</div></div><span class="badge ${st.toLowerCase()}">${st}</span></div>
        <div class="r2"><span>${c.loans.length} loan${c.loans.length>1?'s':''}</span><span class="out">${inr(out)}</span></div>
      </div>`; }).join('');
    const more = show<cs.length
      ? '<button class="btn btn-sm" style="margin-top:4px;" onclick="custMore()">Show more ('+(cs.length-show)+' more)</button>'
      : '';
    body.innerHTML = cards + more;
  }
  window.custMore=function(){ window._custPage=(window._custPage||1)+1; renderCustomers(); };
  function custBack(){ currentCust=null; var d=$('custDetail'); if(d) d.innerHTML='<div class="cl-empty"><div class="big">&#128100;</div>Select a borrower on the left to see their loans, payments and documents.</div>'; renderCustomers(); }
  function openCustomer(key){
    key=decodeURIComponent(key); currentCust=key;
    const c=buildCustomers().find(x=>x.key===key); if(!c) return;
    const active=c.loans.filter(l=>autoStatus(l)!=='Closed'); const closed=c.loans.filter(l=>autoStatus(l)==='Closed');
    const totOut=c.loans.reduce((a,l)=>a+(Number(l.outstanding)||0),0); const totDisb=c.loans.reduce((a,l)=>a+(Number(l.principal)||0),0);
    const pays=[]; c.loans.forEach(l=>(l.payments||[]).forEach(p=>pays.push(Object.assign({acno:l.acno},p)))); pays.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const chgs=[]; c.loans.forEach(l=>(l.charges||[]).forEach(x=>chgs.push(Object.assign({acno:l.acno},x)))); chgs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const guars=[...new Set(c.loans.filter(l=>l.gname).map(l=>l.gname+(l.gphone?(' \u00b7 '+l.gphone):'')))];
    const lrows=ls=>ls.length?ls.map(l=>`<tr><td>${esc(l.acno)}</td><td>${esc(l.type)}</td><td class="right num">${inr(l.principal)}</td><td class="right num">${inr(l.outstanding)}</td><td>${fmtDate(l.due)||'\u2014'}</td><td><span class="badge ${autoStatus(l).toLowerCase()}">${autoStatus(l)}</span></td><td><div class="rowact"><button class="iconbtn cert" title="Generate Certificate" onclick="certFromLoan('${l.id}')">${SVG.fileDoc}</button><button class="iconbtn" title="Repayment Schedule" onclick="openSchedule('${l.id}')">${SVG.cal}</button><button class="iconbtn" title="Restructure / Record payment" onclick="openRestructure('${l.id}')" style="font-weight:800;font-size:15px;">₹</button><button class="iconbtn" title="Edit" onclick="openLoan('${l.id}')">${SVG.edit}</button><button class="iconbtn del" title="Delete" onclick="delLoan('${l.id}')">${SVG.trash}</button></div></td></tr>`).join(''):'<tr><td colspan="7" class="muted" style="padding:10px;">None</td></tr>';
    const html=`
      <div class="panel">
        <div class="cust-head"><div class="cust-av">${esc((c.name||'?').slice(0,1).toUpperCase())}</div><div><h3 style="margin:0;">${esc(c.name)}</h3><div class="muted">${c.relname?esc((c.reltype||'')+' '+c.relname)+' \u00b7 ':''}${esc(c.phone||'No phone on file')}</div></div></div>
        ${(function(){ var f=[];
          if(c.addr) f.push('<div><label>Address</label><div>'+esc(c.addr)+'</div></div>');
          if(c.idproof||c.idtype) f.push('<div><label>ID</label><div>'+esc((c.idtype?c.idtype+': ':'')+(c.idproof||''))+'</div></div>');
          if(c.occupation) f.push('<div><label>Occupation</label><div>'+esc(c.occupation)+'</div></div>');
          if(c.age) f.push('<div><label>Age</label><div>'+esc(c.age)+'</div></div>');
          return f.length ? '<div class="cust-grid">'+f.join('')+'</div>' : '';
        })()}
        <div class="pay-tiles" style="margin-top:14px;">
          <div class="ptile"><span>Total Loans</span><b>${c.loans.length}</b></div>
          <div class="ptile ok"><span>Active</span><b>${active.length}</b></div>
          <div class="ptile"><span>Closed</span><b>${closed.length}</b></div>
          <div class="ptile warn"><span>Outstanding</span><b>${inr(totOut)}</b></div>
          <div class="ptile"><span>Disbursed</span><b>${inr(totDisb)}</b></div>
        </div>
      </div>
      <div class="panel"><h3>Active Loans</h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>A/C</th><th>Type</th><th class="right">Principal</th><th class="right">Outstanding</th><th>Next Due</th><th>Status</th><th></th></tr></thead><tbody>${lrows(active)}</tbody></table></div></div>
      <div class="panel"><h3>Closed Loans</h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>A/C</th><th>Type</th><th class="right">Principal</th><th class="right">Outstanding</th><th>Next Due</th><th>Status</th><th></th></tr></thead><tbody>${lrows(closed)}</tbody></table></div></div>
      <div class="panel"><h3>Payment History</h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>Date</th><th>A/C</th><th>Mode</th><th>Cheque / Bank</th><th class="right">Amount</th><th>Status</th></tr></thead><tbody>${pays.length?pays.map(p=>`<tr><td>${fmtDate(p.date)||'\u2014'}</td><td>${esc(p.acno)}</td><td>${esc(p.mode)}</td><td>${p.mode==='Cheque'?(esc(p.cheque||'\u2014')+(p.bank?(' / '+esc(p.bank)):'')):(p.mode==='Online'?('Ref '+esc(p.ref||'\u2014')):'\u2014')}</td><td class="right num">${inr(p.amount)}</td><td>${p.status==='Cleared'?'<span class="pp ok">Cleared</span>':'<span class="pp pend">Pending</span>'}</td></tr>`).join(''):'<tr><td colspan="6" class="muted" style="padding:10px;">No payments recorded</td></tr>'}</tbody></table></div></div>
      ${chgs.length?`<div class="panel"><h3>Charges <span style="font-weight:400;font-size:12px;color:var(--muted);">— late fees &amp; cheque bounces (record only, not added to outstanding)</span></h3><div style="overflow-x:auto;"><table class="data"><thead><tr><th>Date</th><th>A/C</th><th>Type</th><th>Note</th><th class="right">Amount</th></tr></thead><tbody>${chgs.map(x=>`<tr><td>${fmtDate(x.date)||'\u2014'}</td><td>${esc(x.acno)}</td><td>${esc(x.type||'\u2014')}${x.cheque?(' <span class="muted">(chq '+esc(x.cheque)+')</span>'):''}</td><td class="muted">${esc(x.note||'\u2014')}</td><td class="right num">${inr(x.amount)}</td></tr>`).join('')}<tr class="tot"><td colspan="4" style="font-weight:700;">Total charges recorded</td><td class="right num" style="font-weight:700;">${inr(chgs.reduce((a,x)=>a+(Number(x.amount)||0),0))}</td></tr></tbody></table></div><p class="ph-sub" style="margin-top:8px;">Collect these at settlement if you wish — manage them in Payments &rarr; Record a Charge.</p></div>`:''}
      <div class="panel"><h3>Guarantor(s)</h3><div style="font-size:13.5px;">${guars.length?guars.map(g=>esc(g)).join('<br>'):'<span class="muted">None recorded</span>'}</div></div>
      <div class="panel"><h3>Document Vault</h3>
        <p class="ph-sub">Securely store this customer&rsquo;s documents (Aadhaar, PAN, photos, agreements). Files are kept on this computer.</p>
        <div class="vault-up">
          <select id="vaultCat"><option>Aadhaar</option><option>PAN</option><option>Bank Statement</option><option>Property Document</option><option>Photograph</option><option>Signed Agreement</option><option>Other</option></select>
          <input type="file" id="vaultFile" multiple accept="image/*,application/pdf">
          <button class="btn btn-primary btn-sm" onclick="vaultUpload()">&#10514; Upload</button>
        </div>
        <div class="toolbar" style="margin:12px 0;">
          <div class="search"><span class="si">&#9013;</span><input id="vaultSearch" placeholder="Search documents&hellip;" oninput="renderVault()"></div>
          <select class="filter" id="vaultFilter" onchange="renderVault()"><option value="all">All categories</option><option>Aadhaar</option><option>PAN</option><option>Bank Statement</option><option>Property Document</option><option>Photograph</option><option>Signed Agreement</option><option>Other</option></select>
        </div>
        <div id="vaultGrid" class="vault-grid"></div>
      </div>`;
    $('custDetail').innerHTML=html; renderCustomers(); renderVault();
  }

  /* ===== Document Vault (IndexedDB) ===== */
  let _vdb=null;
  function vaultOpen(){ return new Promise((res,rej)=>{ if(_vdb) return res(_vdb); if(!window.indexedDB){ return rej('no-idb'); } const rq=indexedDB.open('shivamVault',1); rq.onupgradeneeded=e=>{ const db=e.target.result; if(!db.objectStoreNames.contains('docs')){ const st=db.createObjectStore('docs',{keyPath:'id', autoIncrement:true}); st.createIndex('custKey','custKey',{unique:false}); } }; rq.onsuccess=e=>{ _vdb=e.target.result; res(_vdb); }; rq.onerror=e=>rej(rq.error); }); }
  function vaultAdd(custKey,file,category){ return vaultOpen().then(db=>new Promise((res,rej)=>{ const tx=db.transaction('docs','readwrite'); let key; const rq=tx.objectStore('docs').add({custKey,name:file.name,category,type:file.type,size:file.size,addedAt:Date.now(),blob:file}); rq.onsuccess=()=>{key=rq.result;}; tx.oncomplete=()=>res(key); tx.onerror=()=>rej(tx.error); })); }
  function vaultList(custKey){ return vaultOpen().then(db=>new Promise((res,rej)=>{ const rq=db.transaction('docs','readonly').objectStore('docs').index('custKey').getAll(custKey); rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>rej(rq.error); })); }
  function vaultGet(id){ return vaultOpen().then(db=>new Promise((res,rej)=>{ const rq=db.transaction('docs','readonly').objectStore('docs').get(id); rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error); })); }
  function vaultDelete(id){ return vaultOpen().then(db=>new Promise((res,rej)=>{ const tx=db.transaction('docs','readwrite'); tx.objectStore('docs').delete(id); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); })); }
  function vaultUpload(){ if(!currentCust) return; const inp=$('vaultFile'); if(!inp||!inp.files||!inp.files.length){ toast('Choose a file first'); return; } const cat=$('vaultCat')?$('vaultCat').value:'Other'; const files=[...inp.files]; Promise.all(files.map(f=>vaultAdd(currentCust,f,cat))).then(()=>{ inp.value=''; renderVault(); if(cat==='Photograph' && lastDocLoan && custKeyOf(lastDocLoan)===currentCust){ fillDocPhoto(lastDocLoan); } logAudit('Document Uploaded', files.length+' file(s) \u00b7 '+cat); toast(files.length+' document(s) uploaded'); }).catch(()=>toast('Upload failed (storage unavailable)')); }
  function renderVault(){ const grid=$('vaultGrid'); if(!grid||!currentCust) return; vaultList(currentCust).then(docs=>{ const q=($('vaultSearch')?$('vaultSearch').value:'').toLowerCase(); const f=$('vaultFilter')?$('vaultFilter').value:'all'; let d=docs; if(q) d=d.filter(x=>(x.name+' '+x.category).toLowerCase().includes(q)); if(f&&f!=='all') d=d.filter(x=>x.category===f); if(!d.length){ grid.innerHTML='<div class="pay-empty">No documents stored.</div>'; return; } grid.innerHTML=d.map(x=>{ const isImg=(x.type||'').indexOf('image')===0; const ic=isImg?'\ud83d\uddbc':((x.type||'').indexOf('pdf')>=0?'\ud83d\udcc4':'\ud83d\udcce'); const sz=x.size>1048576?((x.size/1048576).toFixed(1)+' MB'):((x.size/1024).toFixed(0)+' KB'); const dt=new Date(x.addedAt).toLocaleDateString('en-GB'); return `<div class="vault-card"><div class="vc-ic">${ic}</div><div class="vc-body"><div class="vc-name" title="${esc(x.name)}">${esc(x.name)}</div><div class="vc-meta"><span class="pp ok">${esc(x.category)}</span> ${sz} \u00b7 ${dt}</div></div><div class="vc-act"><button class="lnk" onclick="previewDoc(${x.id})">preview</button><button class="lnk" onclick="downloadDoc(${x.id})">download</button><button class="lnk del" onclick="deleteDoc(${x.id})">delete</button></div></div>`; }).join(''); }).catch(()=>{ grid.innerHTML='<div class="pay-empty">Document storage is unavailable in this browser. The Mac app supports it fully.</div>'; }); }
  function previewDoc(id){ vaultGet(id).then(d=>{ if(!d) return; const url=URL.createObjectURL(d.blob); if((d.type||'').indexOf('image')===0){ $('vaultModalBody').innerHTML='<img src="'+url+'" style="max-width:100%; max-height:78vh; border-radius:8px;">'; $('vaultModalTitle').textContent=d.name; $('vaultModal').classList.add('show'); } else { $('vaultModalBody').innerHTML='<iframe src="'+url+'" style="width:100%;height:78vh;border:0;border-radius:8px;background:#fff;"></iframe>'; $('vaultModalTitle').textContent=d.name; $('vaultModal').classList.add('show'); } logAudit('Document Previewed', d.name); }); }
  function closeVaultModal(){ const m=$('vaultModal'); if(m) m.classList.remove('show'); const b=$('vaultModalBody'); if(b) b.innerHTML=''; }
  function downloadDoc(id){ vaultGet(id).then(d=>{ if(!d) return; const url=URL.createObjectURL(d.blob); const a=document.createElement('a'); a.href=url; a.download=d.name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),4000); logAudit('Document Downloaded', d.name); }); }
  function deleteDoc(id){ vaultGet(id).then(d=>{ if(!confirm('Delete this document permanently?')) return; vaultDelete(id).then(()=>{ renderVault(); logAudit('Document Deleted', d?d.name:('#'+id)); toast('Document deleted'); }); }); }

  /* ===== Audit Logs ===== */
  const AUDIT_STORE='shivam_audit_v1';
  function logAudit(action,detail){ try{ const a=JSON.parse(localStorage.getItem(AUDIT_STORE)||'[]'); a.push({ts:Date.now(), user:(currentUser&&currentUser.user)||'system', role:(currentUser&&currentUser.role)||'', action, detail:detail||''}); if(a.length>AUDIT_MAX){ while(a.length>AUDIT_MAX)a.shift(); try{ localStorage.setItem('shivam_audit_trimmed','1'); }catch(_){} } localStorage.setItem(AUDIT_STORE, JSON.stringify(a)); }catch(e){} const sec=document.getElementById('sec-backup'); if(sec&&sec.classList.contains('active')) renderAudit(); }
  function auditAll(){ try{ return JSON.parse(localStorage.getItem(AUDIT_STORE)||'[]'); }catch(e){ return []; } }
  const AUDIT_MAX=5000, AUDIT_PAGE=50;
  window.runSelfTest=function(){
    const out=$('selfTestOut'); if(!out) return;
    out.innerHTML='<div class="pay-empty">Running\u2026</div>';
    const results=[]; const ok=(n)=>results.push({n:n,pass:true}); const bad=(n,why)=>results.push({n:n,pass:false,why:String(why).slice(0,140)});
    const snapshot=JSON.stringify(loans);          /* protect the real data */
    const realCust=currentCust;
    try{
      /* 1. interest & EMI maths */
      try{
        const c=calcLoanTotals(100000, 2, 10);   /* 1,00,000 @ 2%/month flat for 10 months */
        if(c.tint!==20000) throw 'interest should be 20,000 but was '+c.tint;
        if(c.tpay!==120000) throw 'total payable should be 1,20,000 but was '+c.tpay;
        if(c.emi!==12000)  throw 'EMI should be 12,000 but was '+c.emi;
        const z=calcLoanTotals(50000, 2, 0);      /* guard against divide-by-zero */
        if(z.emi!==0) throw 'zero-month loan should not produce an EMI';
        ok('Interest &amp; EMI calculation (monthly flat)');
      }catch(e){ bad('Interest &amp; EMI calculation', e); }

      /* 2. payments reduce the balance correctly */
      try{
        const tt=calcLoanTotals(50000,2,10);
        const t={id:'__t2',name:'Test',acno:'__TEST2__',phone:'0000000000',principal:50000,rate:2,tenure:10,
                 tint:tt.tint, tpay:tt.tpay, emi:tt.emi, disb:'2026-01-01',due:'2026-02-01',status:'Active',type:'Personal',
                 payments:[{date:'2026-02-01',mode:'Cash',amount:6000,status:'Cleared'},{date:'2026-03-01',mode:'Cheque',amount:6000,status:'Pending'}]};
        recomputeLoan(t);
        if(Math.round(t.paid)!==6000) throw 'a pending cheque was counted as paid (paid='+t.paid+')';
        if(Math.round(t.outstanding)!==Math.round(tt.tpay-6000)) throw 'balance wrong: '+t.outstanding;
        ok('Payments &amp; balances (pending cheques excluded)');
      }catch(e){ bad('Payments &amp; balances', e); }

      /* 3. duplicate A/C numbers are blocked */
      try{
        const dup=loans.length? loans[0].acno : null;
        if(dup){ const clash=loans.some(function(l){ return l.acno && l.acno.toLowerCase()===String(dup).toLowerCase(); });
          if(!clash) throw 'duplicate check not working'; }
        ok('Duplicate account-number guard');
      }catch(e){ bad('Duplicate account-number guard', e); }

      /* 4. saving + reading back */
      try{
        const before=loans.length; save();
        const back=JSON.parse(localStorage.getItem(STORE)||'[]');
        if(back.length!==before) throw 'saved '+back.length+' of '+before;
        ok('Saving records to this device');
      }catch(e){ bad('Saving records to this device', e); }

      /* 5. backup file can be produced and read back */
      try{
        const payload=makeBackupPayload(); const parsed=JSON.parse(payload);
        if(parsed.app!=='ShivamLMS') throw 'bad backup header';
        if(!Array.isArray(parsed.loans)) throw 'backup has no records';
        if(parsed.schema!==SCHEMA_VERSION) throw 'backup schema mismatch';
        ok('Backup file can be created and re-read');
      }catch(e){ bad('Backup file', e); }

      /* 6. documents generate */
      try{
        const l=loans[0] || {id:'x',name:'Test',acno:'T-1',principal:1000,rate:2,tenure:1,emi:100,tpay:1020,paid:0,arrears:0,due:'2026-01-01',status:'Active',type:'Personal',payments:[{date:'2026-01-01',mode:'Cash',amount:100,status:'Cleared'}]};
        const rep=repLetterhead('Health Check','test',[['a','1']]);
        if(rep.indexOf('SHIVAM ENTERPRISES')<0) throw 'report letterhead missing';
        const pay=(l.payments&&l.payments[0]) ? payReceiptHTML(l,l.payments[0],0) : null;
        if(pay && pay.indexOf('PAYMENT RECEIPT')<0) throw 'receipt missing title';
        ok('Documents (reports &amp; receipts) generate');
      }catch(e){ bad('Documents', e); }

      /* 7. every screen renders */
      try{
        const secs=['dash','cust','pay','cert','defaults','reports','messages'];
        secs.forEach(function(s){ const a=document.querySelector('#nav a[data-sec="'+s+'"]'); if(!a) throw 'missing screen: '+s; });
        renderCustomers(); renderDash();
        ok('All screens present and rendering');
      }catch(e){ bad('Screens', e); }

      /* 8. schema up to date */
      try{
        if(storeSchema()!==SCHEMA_VERSION) throw 'data is v'+storeSchema()+', app expects v'+SCHEMA_VERSION;
        ok('Data format up to date (v'+SCHEMA_VERSION+')');
      }catch(e){ bad('Data format', e); }

      /* 9. long lists must not collapse (this is the bug that squashed the audit rows to 2px) */
      try{
        const probe=document.createElement('div');
        probe.className='hist-list';
        probe.style.cssText='max-height:200px;overflow-y:auto;position:absolute;left:-9999px;top:0;width:600px;';
        let rows='';
        for(let i=0;i<40;i++) rows+='<details class="hist-item"><summary class="hist-sum"><span class="hist-when">01/01/2026 10:00</span><span class="hist-name">Row '+i+'</span></summary><div class="hist-body">x</div></details>';
        probe.innerHTML=rows;
        document.body.appendChild(probe);
        const h=probe.querySelector('.hist-item').getBoundingClientRect().height;
        probe.remove();
        if(h<24) throw 'rows shrink to '+Math.round(h)+'px in a long list \u2014 they would be unreadable';
        ok('Long lists (audit, message history) stay readable');
      }catch(e){ bad('Long lists', e); }

      /* 10. automatic backups actually configured */
      try{
        const c=loadABK();
        if(window.electronAPI && window.electronAPI.writeBackup && !c.folder) throw 'no backup folder chosen yet';
        ok('Automatic backups configured');
      }catch(e){ bad('Automatic backups', e); }

    } finally {
      try{ loans=JSON.parse(snapshot); currentCust=realCust; save(); }catch(e){}
    }
    const failed=results.filter(r=>!r.pass);
    const rows=results.map(r=> '<div style="display:flex;gap:9px;align-items:flex-start;padding:6px 0;font-size:12.5px;">'
      + (r.pass?'<span style="color:#16a34a;font-weight:700;">\u2713</span>':'<span style="color:#dc2626;font-weight:700;">\u2715</span>')
      + '<div><div>'+r.n+'</div>'+(r.pass?'':'<div class="muted" style="font-size:11.5px;color:#dc2626;">'+esc(r.why)+'</div>')+'</div></div>').join('');
    const head = failed.length
      ? '<div style="font-weight:700;color:#b91c1c;margin-bottom:6px;">'+failed.length+' of '+results.length+' checks failed</div>'
      : '<div style="font-weight:700;color:#166534;margin-bottom:6px;">All '+results.length+' checks passed \u2014 the app is healthy</div>';
    out.innerHTML='<div class="bk-card">'+head+rows+'<div class="ph-sub" style="margin-top:8px;">Your records were not modified by this check.</div></div>';
    try{ logAudit('Health Check', failed.length? (failed.length+' check(s) failed') : 'all checks passed'); }catch(e){}
  };
  function renderAudit(){
    const body=$('auditBody'); if(!body) return;
    const q=($('auditSearch')?$('auditSearch').value:'').toLowerCase().trim();
    if(window._auditQ!==q){ window._auditQ=q; window._auditPage=1; }
    if(!window._auditPage) window._auditPage=1;
    const all=auditAll();
    let a=all.slice().reverse();
    if(q) a=a.filter(x=>((x.user+' '+x.action+' '+x.detail).toLowerCase().includes(q)));
    const cnt=$('auditCount');
    if(cnt) cnt.textContent = all.length ? (all.length+' entr'+(all.length===1?'y':'ies')+(q?(' \u00b7 '+a.length+' matching'):'')) : '';
    if(!a.length){ body.innerHTML = q
        ? ('<div class="empty"><b>No entries match \u201c'+esc(q)+'\u201d.</b><br><button class="btn btn-sm" style="margin-top:8px;" onclick="$(\'auditSearch\').value=\'\';renderAudit();">Clear search</button></div>')
        : '<div class="empty"><b>No activity logged yet.</b></div>';
      return; }
    const show=Math.min(a.length, window._auditPage*AUDIT_PAGE);
    const rows=a.slice(0,show).map(x=>{ const d=new Date(x.ts); const det=(x.detail||'').trim();
      return '<details class="hist-item"><summary class="hist-sum">'
        +'<span class="hist-when">'+d.toLocaleDateString('en-GB')+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span>'
        +'<span class="hist-name">'+esc(x.action)+'</span>'
        +'<span class="hist-cat pp ok">'+esc(x.user)+(x.role?(' \u00b7 '+esc(x.role)):'')+'</span>'
        +'</summary><div class="hist-body"><div class="hist-msg">'+(det?esc(det):'<span class="muted">No additional details.</span>')+'</div></div></details>';
    }).join('');
    let trimNote='';
    try{ if(localStorage.getItem('shivam_audit_trimmed')==='1') trimNote='<div class="pay-empty" style="color:#b45309;">\u26a0 The log has reached its limit, so the oldest entries were removed. Export the log regularly to keep a permanent record.</div>'; }catch(_){}
    const more = show<a.length
      ? '<button class="btn btn-sm" style="margin-top:8px;width:100%;" onclick="auditMore()">Show more ('+(a.length-show)+' older)</button>'
      : '';
    body.innerHTML = trimNote + rows + more;
  }
  window.auditMore=function(){ window._auditPage=(window._auditPage||1)+1; renderAudit(); };
  function exportAudit(){ const a=auditAll(); const head=['When','User','Role','Action','Details']; const rows=a.map(x=>{ const d=new Date(x.ts); return [d.toLocaleDateString('en-GB')+' '+d.toLocaleTimeString(), x.user, x.role, x.action, x.detail].map(v=>{ v=String(v==null?'':v); if(/[",\n]/.test(v)) v='"'+v.replace(/"/g,'""')+'"'; return v; }).join(','); }); download('shivam-audit-'+todayISO()+'.csv', head.join(',')+'\n'+rows.join('\n'), 'text/csv'); logAudit('Data Exported','Audit log'); toast('Audit log exported'); }
  function clearAudit(){ if(isLocked() && !(currentUser&&currentUser.role==='admin')){ toast('Administrators only'); return; } if(confirm('Clear the entire audit log? This cannot be undone.')){ try{ localStorage.removeItem(AUDIT_STORE); }catch(e){} renderAudit(); toast('Audit log cleared'); } }

  function resolveTheme(){ try{ const p=localStorage.getItem('shivam_theme'); if(p==='dark'||p==='light') return p; }catch(e){} return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'; }
  function applyTheme(){ const t=resolveTheme(); document.documentElement.classList.toggle('dark', t==='dark'); const b=$('themeBtn'); if(b) b.textContent=(t==='dark')?'☀️':'🌙'; try{ if(typeof applyAuthTheme==='function') applyAuthTheme(); }catch(e){} }
  function toggleTheme(){ const cur=document.documentElement.classList.contains('dark')?'dark':'light'; const nx=(cur==='dark')?'light':'dark'; try{ localStorage.setItem('shivam_theme', nx); }catch(e){} applyTheme(); }
  try{ const mq=matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', ()=>{ let pref=null; try{ pref=localStorage.getItem('shivam_theme'); }catch(e){} if(!pref) applyTheme(); }); }catch(e){}
  function exportJSON(){ try{recomputeAll();}catch(e){} download('shivam-loans-backup-'+todayISO()+'.json', JSON.stringify(loans,null,2), 'application/json'); logAudit('Data Exported','Backup JSON'); toast('Backup downloaded'); }
  function exportCSV(){
    try{recomputeAll();}catch(e){}
    const cols=['caseno','refno','acno','name','reltype','relname','age','phone','addr','idtype','idproof','type','product','dealer','occupation','designation','officeaddr','residence','principal','downpay','deductions','rate','tenure','tint','tpay','emi','disb','due','paid','outstanding','status','officer','gname','gphone','remarks','propdesc','propaddr','proparea','propvalue','bN','bS','bE','bW','title'];
    const head=['Case No','Reference','A/C No','Name','Relation','Relation Name','Age','Phone','Address','ID Type','ID No','Type','Loan Purpose','Referred By','Occupation','Designation','Office Address','Residence','Principal','Down Payment','Deductions','Rate %','Tenure(mo)','Total Interest','Total Payable','EMI','Disbursed','Next Due','Paid','Outstanding','Status','Account Officer','Guarantor','Guarantor Phone','Remarks','Property Desc','Property Address','Area','Property Value','Boundary N','Boundary S','Boundary E','Boundary W','Title/Reg'];
    const rows=loans.map(l=>cols.map(c=>{ let v=l[c]==null?'':String(l[c]); if(/[",\n]/.test(v)) v='"'+v.replace(/"/g,'""')+'"'; return v; }).join(','));
    download('shivam-loans-'+todayISO()+'.csv', head.join(',')+'\n'+rows.join('\n'), 'text/csv'); logAudit('Data Exported','Loans CSV'); toast('Excel file exported');
  }
  function importJSON(ev){
    const file=ev.target.files[0]; if(!file) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ const data=JSON.parse(rd.result); let arr=null, extras=null; if(Array.isArray(data)){ arr=data; } else if(data && data.app==='ShivamLMS' && Array.isArray(data.loans)){ arr=data.loans; extras=data; } else throw 0;
        if(extras && typeof extras.schema==='number' && extras.schema>SCHEMA_VERSION){ toast('\u26a0 This backup was made by a NEWER version of the app. Update the app first \u2014 restoring it now could damage your records.', 7000); return; }
        snapBefore('Before restore'); loans=arr; try{recomputeAll();}catch(e){} save(); if(extras){ const put=(k,v)=>{ if(v!=null && !(Array.isArray(v) && !v.length)){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } }; put('shivam_recycle_v1', extras.recycle); put('shivam_expenses_v1', extras.expenses); put('shivam_firm_v1', extras.firm); put('shivam_users_v1', extras.users); put('shivam_watpl_v1', extras.watpl); put('shivam_wamsg_v1', extras.wahist);
          try{ if(Array.isArray(extras.audit) && extras.audit.length){ const cur=auditAll(); const seen={}; const merged=cur.concat(extras.audit).filter(function(x){ if(!x||!x.ts) return false; const k=x.ts+'|'+(x.user||'')+'|'+(x.action||'')+'|'+(x.detail||''); if(seen[k]) return false; seen[k]=1; return true; }).sort(function(a,b){ return a.ts-b.ts; }); localStorage.setItem('shivam_audit_v1', JSON.stringify(merged.slice(-5000))); } }catch(e){}
          if(extras.wacfg){ let cur={}; try{ cur=JSON.parse(localStorage.getItem('shivam_wacfg_v1')||'{}')||{}; }catch(e){} localStorage.setItem('shivam_wacfg_v1', JSON.stringify(Object.assign({}, extras.wacfg, {token:cur.token, tokenEnc:cur.tokenEnc}))); } } logAudit('Backup Restored', arr.length+' records'+(extras?' + settings':'')); renderLoans(); renderDash(); toast('Backup restored ('+arr.length+' records'+(extras?', settings included':'')+')'); go('loans'); }catch(e){ toast('Invalid backup file'); } };
    rd.readAsText(file); ev.target.value='';
  }
  function clearAll(){ if(confirm('Delete ALL loan records permanently? Make sure you have a backup.')){ loans=[]; save(); logAudit('All Records Deleted',''); renderLoans(); renderDash(); toast('All records deleted'); } }

