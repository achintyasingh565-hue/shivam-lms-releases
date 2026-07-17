  /* ---------- dashboard (banking workspace) ---------- */
  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function monLabel(k){ const [y,m]=k.split('-'); return MON[(+m)-1]+"'"+y.slice(2); }
  function spark(vals,color){
    if(!vals||vals.length<2) vals=[0,(vals&&vals[0])||0];
    const w=120,h=34,p=3,mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;
    const pts=vals.map((v,i)=>{ const x=p+i*(w-2*p)/(vals.length-1); const y=h-p-((v-mn)/rng)*(h-2*p); return x.toFixed(1)+','+y.toFixed(1); });
    const area=`${p},${h-p} `+pts.join(' ')+` ${w-p},${h-p}`;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polygon points="${area}" fill="${color}" opacity="0.08"/><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts.join(' ')}"/></svg>`;
  }
  function donutSvg(segs){
    const nz=segs.filter(x=>x.value>0);
    const total=segs.reduce((a,x)=>a+x.value,0)||1, r=52, c=2*Math.PI*r; let off=0;
    const gap = nz.length>1 ? 4 : 0;
    const arcs=nz.map(x=>{ const raw=x.value/total*c; const len=Math.max(0.01, raw-gap); const e=`<circle cx="70" cy="70" r="${r}" fill="none" stroke="${x.color}" stroke-width="15" stroke-dasharray="${len.toFixed(2)} ${(c-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)"/>`; off+=raw; return e; }).join('');
    const leg=segs.map(x=>`<div class="leg-item"><span class="dot" style="background:${x.color}"></span>${x.label}<span class="leg-n">${x.value}</span></div>`).join('');
    return `<div class="donut"><svg viewBox="0 0 140 140" width="148" height="148"><circle class="donut-bg" cx="70" cy="70" r="52" fill="none" stroke="#eef2f7" stroke-width="16"/>${arcs}<text class="donut-total" x="70" y="66" text-anchor="middle" font-size="24" font-weight="700" fill="#0F172A">${total}</text><text class="donut-cap" x="70" y="85" text-anchor="middle" font-size="9" letter-spacing="1" fill="#94A3B8">ACCOUNTS</text></svg><div class="leg">${leg}</div></div>`;
  }
  function kpi(lbl,val,ico,tone,sparkSvg,sub){ return `<div class="kpi tone-${tone}"><div class="k-top"><span class="k-lbl">${lbl}</span><span class="chip chip-${tone}">${ico}</span></div><div class="k-val">${val}</div><div class="k-spark">${sparkSvg}</div><div class="k-sub">${sub}</div></div>`; }
  function kpiGauge(lbl,val,ico,tone,pct,color,sub){ pct=Math.max(0,Math.min(100,pct)); return `<div class="kpi tone-${tone}"><div class="k-top"><span class="k-lbl">${lbl}</span><span class="chip chip-${tone}">${ico}</span></div><div class="k-val">${val}</div><div class="gauge" style="margin-top:12px;"><i style="width:${pct.toFixed(1)}%;background:${color};"></i></div><div class="k-sub">${sub}</div></div>`; }
  function deltaHtml(d,lbl){ const up=d>=0; return `<span class="k-delta ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(d).toFixed(1)}%</span> ${lbl}`; }
  function shareBar(part,whole,color){ const p=whole?(part/whole*100):0; return `<div class="gauge" style="margin-top:6px;"><i style="width:${p.toFixed(1)}%;background:${color};"></i></div>`; }
  function barsChart(series){
    if(!series.length) return `<div class="empty" style="padding:30px;">No disbursement data yet.</div>`;
    const mx=Math.max(...series.map(x=>x.amount),1);
    return `<div class="bars">`+series.map(x=>`<div class="bar-col"><div class="bar" style="height:${Math.max(3,x.amount/mx*100).toFixed(0)}%;" title="${x.label}: ${inr(x.amount)}"></div><div class="bar-lab">${x.label}</div></div>`).join('')+`</div>`;
  }
  function riskChart(b){
    const rows=[{lab:'Current (standard)',n:b.cur,c:'#16A34A'},{lab:'1–30 DPD (SMA)',n:b.b1,c:'#F59E0B'},{lab:'31–60 DPD (Substandard)',n:b.b2,c:'#F97316'},{lab:'61–90 DPD (Doubtful)',n:b.b3,c:'#DC2626'},{lab:'90+ DPD (Critical)',n:b.b4,c:'#991B1B'}];
    const mx=Math.max(...rows.map(r=>r.n),1);
    return rows.map(r=>`<div class="rk"><div class="rk-lab">${r.lab}</div><div class="rk-bar"><i style="width:${(r.n/mx*100).toFixed(0)}%;background:${r.c};"></i></div><div class="rk-n">${r.n}</div></div>`).join('');
  }
  function renderDash(){
    if(!loans.length){ $('dashMain').style.display='none'; $('dashEmpty').style.display='block';
      $('dashEmpty').innerHTML=`<div class="empty-hero"><div class="eh-ic">${SVG.bank}</div><h3>No loans on the books yet</h3><p>Add your first loan to unlock portfolio analytics, risk monitoring and collections.</p><button class="btn btn-primary" onclick="openLoan()">＋ Create a loan record</button></div>`;
      refreshBell(); return; }
    $('dashMain').style.display='block'; $('dashEmpty').style.display='none';
    const today=todayISO(), now=Date.now();
    let disbursed=0,outstanding=0,active=0,overdue=0,closed=0,overdueAmt=0;
    const byMonth={}, b={cur:0,b1:0,b2:0,b3:0,b4:0};
    loans.forEach(l=>{ const P=Number(l.principal)||0,O=Number(l.outstanding)||0,st=autoStatus(l);
      disbursed+=P;
      if(l.disb){ const k=l.disb.slice(0,7); (byMonth[k]=byMonth[k]||{amount:0,count:0}); byMonth[k].amount+=P; byMonth[k].count++; }
      if(st==='Closed'){ closed++; return; }
      outstanding+=O;
      if(st==='Overdue'){ overdue++; overdueAmt+=O; const dpd=l.due?Math.max(0,Math.floor((now-new Date(l.due).getTime())/86400000)):0;
        if(dpd<=30)b.b1++; else if(dpd<=60)b.b2++; else if(dpd<=90)b.b3++; else b.b4++; }
      else { active++; b.cur++; }
    });
    const recovered=loans.reduce((a,l)=>a+(Number(l.paid)||0),0);
    var _schedToDate=0; loans.forEach(l=>{ var _emi=Math.round(Number(l.emi)||0), _n=Math.max(0,Math.round(Number(l.tenure)||0)), _dby=0; for(var _i=1;_i<=_n;_i++){ var _d=emiDueDate(l,_i); if(_d&&_d<=today) _dby++; } _schedToDate+=Math.min((Number(l.tpay)||0), _dby*_emi); });
    const collRate=_schedToDate>0?Math.min(100,recovered/_schedToDate*100):0;
    const par=outstanding?overdueAmt/outstanding*100:0;
    const months=Object.keys(byMonth).sort().slice(-8);
    const series=months.map(k=>({label:monLabel(k),amount:byMonth[k].amount,count:byMonth[k].count}));
    const amts=series.map(x=>x.amount), cnts=series.map(x=>x.count);
    let cum=0; const cumv=amts.map(a=>cum+=a);
    const lastM=amts[amts.length-1]||0, prevM=amts[amts.length-2]||0;
    const disbDelta=prevM?(lastM-prevM)/prevM*100:0;
    $('kpiRow').innerHTML=[
      kpi('Portfolio Value', inr(outstanding), SVG.bank,'blue', spark(cumv.length>1?cumv:[0,outstanding],'#2563EB'), `${active+overdue} live accounts`),
      kpi('Monthly Disbursement', inr(lastM), SVG.trend,'green', spark(amts.length>1?amts:[0,lastM],'#16A34A'), deltaHtml(disbDelta,'vs last month')),
      kpi('Active Loans', String(active), SVG.check,'blue', spark(cnts.length>1?cnts:[0,active],'#2563EB'), `${overdue} overdue flagged`),
      kpiGauge('Collection Rate', collRate.toFixed(1)+'%', SVG.check,'green', collRate, '#16A34A', `${inr(recovered)} recovered`),
      kpiGauge('Portfolio at Risk', par.toFixed(1)+'%', SVG.alert,'red', par, '#DC2626', `${inr(overdueAmt)} at risk`),
      kpi('Overdue Amount', inr(overdueAmt), SVG.clock,'red', shareBar(overdueAmt,outstanding,'#DC2626'), `${overdue} accounts overdue`)
    ].join('');
    $('chartDisb').innerHTML=barsChart(series);
    $('chartStatus').innerHTML=donutSvg([{value:active,color:'#6366F1',label:'Active'},{value:overdue,color:'#E5484D',label:'Overdue'},{value:closed,color:'#10B981',label:'Closed'}]);
    { var _rc=$('chartRisk'); if(_rc) _rc.innerHTML=riskChart(b); }
    renderDelinq(now); renderCollections(today); refreshBell();
  }
  function renderDelinq(now){
    const od=loans.map(l=>({...l,_st:autoStatus(l)})).filter(l=>l._st==='Overdue')
      .map(l=>({...l,dpd:l.due?Math.max(0,Math.floor((now-new Date(l.due).getTime())/86400000)):0})).sort((a,c)=>c.dpd-a.dpd);
    if(!od.length){ $('delinqWrap').innerHTML=`<div class="empty"><div class="big">✓</div>No delinquent accounts. Portfolio is current.</div>`; return; }
    const risk=d=> d>90?{t:'Critical',c:'crit'}: d>60?{t:'Doubtful',c:'high'}: d>30?{t:'Substandard',c:'med'}:{t:'SMA',c:'low'};
    const act=d=> d>90?'Recovery / legal notice': d>60?'Field visit': d>30?'Call + reminder':'Send reminder';
    $('delinqWrap').innerHTML=`<div class="table-wrap"><table class="data"><thead><tr><th>Borrower</th><th>A/C No.</th><th class="right">Outstanding</th><th class="right">Days Past Due</th><th>Risk Level</th><th>Suggested Action</th><th>Phone</th></tr></thead><tbody>`+
      od.slice(0,6).map(l=>{ const r=risk(l.dpd); return `<tr><td class="name">${esc(l.name)}</td><td>${esc(l.acno)}</td><td class="right num">${inr(l.outstanding)}</td><td class="right num" style="color:var(--bad);font-weight:700;">${l.dpd}</td><td><span class="rkbadge ${r.c}">${r.t}</span></td><td class="muted">${act(l.dpd)}</td><td class="muted">${esc(l.phone||'—')}</td></tr>`; }).join('')+
      `</tbody></table></div>`+(od.length>6?`<div class="tbl-foot">Showing top 6 of ${od.length} overdue accounts · <a onclick="go('loans')">open full ledger →</a></div>`:'');
  }
  function renderCollections(today){
    const i7=new Date(); i7.setDate(i7.getDate()+7); const i7s=i7.toISOString().slice(0,10);
    let dtN=0,dtA=0,upN=0,upA=0,msN=0,msA=0,recovered=0,disb=0;
    loans.forEach(l=>{ const st=autoStatus(l),O=Number(l.outstanding)||0,P=Number(l.principal)||0; disb+=P; recovered+=(Number(l.paid)||0);
      if(st==='Closed') return;
      if(l.due===today){dtN++; dtA+=Number(l.emi)||O;}
      else if(l.due>today&&l.due<=i7s){upN++; upA+=Number(l.emi)||O;}
      else if(st==='Overdue'){msN++; msA+=(Number(l.arrears)||0);}
    });
    const coll=(lbl,val,sub,tone,ico)=>`<div class="coll"><div class="k-top"><span class="k-lbl">${lbl}</span><span class="chip chip-${tone}">${ico}</span></div><div class="coll-val">${val}</div><div class="k-sub">${sub}</div></div>`;
    $('collRow').innerHTML=[
      coll('Due Today', inr(dtA), `${dtN} payment(s)`,'blue',SVG.clock),
      coll('Upcoming (7 days)', inr(upA), `${upN} payment(s)`,'amber',SVG.clock),
      coll('Missed / Overdue', inr(msA), `${msN} account(s)`,'red',SVG.alert),
      coll('Recovered to date', inr(recovered), `of ${inr(disb)} disbursed`,'green',SVG.trend)
    ].join('');
  }
  function toggleSidebar(){ var app=document.querySelector('.app'); if(!app) return;
    if(window.innerWidth<=820){ app.classList.toggle('nav-open'); }
    else { app.classList.toggle('nav-collapsed');
      try{ localStorage.setItem('shivam_navcollapsed', app.classList.contains('nav-collapsed')?'1':'0'); }catch(e){}
    }
  }
  (function restoreSidebar(){
    try{ if(localStorage.getItem('shivam_navcollapsed')==='1' && window.innerWidth>820){
      var app=document.querySelector('.app'); if(app) app.classList.add('nav-collapsed'); } }catch(e){}
  })();
  function globalSearch(){ const q=($('globalSearch').value||'').trim(); go('cust'); if(typeof renderCustomers==='function') renderCustomers(); const cs=buildCustomers().filter(c=>((c.name+' '+(c.phone||'')+' '+c.loans.map(l=>l.acno).join(' ')).toLowerCase().includes(q.toLowerCase()))); if(cs.length) openCustomer(encodeURIComponent(cs[0].key)); }
  /* Live filter the borrower list as you type in the top-bar search — only while
     Customers & Loans is the open screen (elsewhere the box searches on Enter). */
  window.topSearchLive=function(){ try{ var s=document.getElementById('sec-cust'); if(s && s.classList.contains('active') && typeof renderCustomers==='function') renderCustomers(); }catch(e){} };
  function notifItems(){ const today=todayISO(); const i7=new Date(); i7.setDate(i7.getDate()+7); const i7s=i7.toISOString().slice(0,10); const out=[];
    loans.forEach(l=>{ const st=autoStatus(l); if(st==='Overdue') out.push({t:'overdue',l}); else if(st==='Active'&&l.due&&l.due>=today&&l.due<=i7s) out.push({t:'due',l}); }); return out; }
  function refreshBell(){ const n=notifItems().length; const bd=$('bellBadge'); if(bd){ bd.textContent=n>99?'99+':String(n); bd.style.display=n?'flex':'none'; } }
  function toggleNotif(e){ if(e&&e.stopPropagation) e.stopPropagation(); const p=$('notifPop'); if(!p) return;
    if(p.classList.contains('show')){ p.classList.remove('show'); return; }
    const items=notifItems().slice(0,8);
    p.innerHTML='<div class="np-h">Notifications</div>'+(items.length?items.map(it=>`<div class="np-i"><span class="np-dot ${it.t==='overdue'?'r':'a'}"></span><div><b>${esc(it.l.name)}</b><div class="muted">${it.t==='overdue'?'Payment overdue':'Due soon'} · ${inr(it.l.outstanding||it.l.emi)}</div></div></div>`).join(''):'<div class="np-empty">No alerts — portfolio is current.</div>')+`<div class="np-f" onclick="go('messages'); document.getElementById('notifPop').classList.remove('show');">Open reminders →</div>`;
    p.classList.add('show');
  }
  document.addEventListener('click', e=>{ if(!e.target.closest('.tb-bell')){ const p=$('notifPop'); if(p) p.classList.remove('show'); } });

  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

