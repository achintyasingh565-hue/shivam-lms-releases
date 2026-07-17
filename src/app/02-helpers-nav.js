  /* ---------- helpers ---------- */
  function inr(n){ n=Number(n)||0; return "₹" + n.toLocaleString('en-IN',{maximumFractionDigits:0}); }
  function inrPlain(n){ n=Number(n)||0; return n.toLocaleString('en-IN',{maximumFractionDigits:0}); }
  function fmtDate(v){ if(!v) return ""; const [y,m,d]=v.split("-"); return d+"-"+m+"-"+y.slice(2); }
  /* Local-time "today" (toISOString() is UTC: in IST it reports YESTERDAY before 05:30 AM,
     which made due/overdue statuses lag by a day in early-morning use). */
  function todayISO(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function toast(msg, ms){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'), ms||2200); }
  function autoStatus(l){
    const out = Number(l.outstanding)||0;
    if(out<=0) return 'Closed';
    if((Number(l.arrears)||0) > 0) return 'Overdue';
    return 'Active';
  }

  /* ---------- navigation ---------- */
  const titles = {dash:['Dashboard','Overview of your finance office'], loans:['Loan Records','All borrower loan accounts'], cust:['Customers & Loans','Borrowers, their loans, payments & documents'], cert:['Certificates','Generate No Dues Certificate & Acknowledgement Receipt'], defaults:['Default Notices','Issue default & demand notices to overdue borrowers'], proposal:['Proposal Form','Loan application proposal form'], hpfile:['Loan Documents','File cover, loan agreement & security documents'], messages:['Reminders & Messages','Payment reminders, greetings & notices'], backup:['Administration','Users, roles, security, backup & data management'], pay:['Payments','Record and track cash, cheque & online payments'], reports:['Reporting Center','Operational reports, registers & statements']};
  /* ================= REPORTING CENTRE ================= */
  let _repView='collection';
  function renderReports(){ setReportView(_repView); }
  function setReportView(v){
    _repView=v;
    var seg=$('repseg'); if(seg){ [...seg.children].forEach(b=>b.classList.toggle('active', b.dataset.r===v)); }
    var fn={collection:repCollection, cashbook:repCashbook, cheque:repCheque, online:repOnline, status:repStatus, overdue:repOverdue, schedule:repSchedule, statement:repStatement, interest:repInterest, efficiency:repEfficiency, pnl:repPnl}[v];
    if(fn) fn();
  }
  if($('repseg')) $('repseg').addEventListener('click', e=>{ var b=e.target.closest('button'); if(b&&b.dataset.r) setReportView(b.dataset.r); });

  /* ---- shared helpers ---- */
  function repTile(label,val,cls){ return '<div class="ptile '+(cls||'')+'"><span>'+esc(label)+'</span><b>'+val+'</b></div>'; }
  function repMonthStart(){ return todayISO().slice(0,8)+'01'; }
  function repChqRef(p){ if(p.mode==='Cheque'){ return (p.cheque?('Chq '+esc(p.cheque)):'')+(p.bank?(' / '+esc(p.bank)):''); } return esc(p.ref||''); }
  function repLoanPayable(l){ if(l.tpay!=null && Number(l.tpay)>0) return Number(l.tpay); var P=Number(l.principal)||0, r=Number(l.rate)||0, t=Number(l.tenure)||0; var tint=Math.round(P*r/100*t); return P+tint; }
  function csvCell(v){ v=(v==null?'':String(v)); if(/[",\n]/.test(v)){ v='"'+v.replace(/"/g,'""')+'"'; } return v; }
  function repCSV(filename, header, rows){ var lines=[header].concat(rows).map(a=>a.map(csvCell).join(',')); download(filename, lines.join('\r\n'), 'text/csv'); }
  /* ---------------------------------------------------------------
     FIRM DETAILS - single source of truth.
     Change the office address / GSTIN here and every document,
     letterhead, notice and receipt updates automatically.
     (Overridable at runtime: Administration saves to shivam_firm_v1)
  --------------------------------------------------------------- */
  const FIRM_DEFAULT = {
    name:    'SHIVAM ENTERPRISES',
    address: 'D-1191, Indira Nagar, Lucknow',
    phones:  '9839125800, 8528564196',
    gstin:   '09JXBPK7550J1ZY',
    udyam:   'UDYAM-UP-50-0268771'
  };
  function FIRM(){
    try{ const o=JSON.parse(localStorage.getItem('shivam_firm_v1')||'null');
      if(o && typeof o==='object') return Object.assign({}, FIRM_DEFAULT, o); }catch(e){}
    return FIRM_DEFAULT;
  }
  function firmAddrLine(){ const f=FIRM(); return f.address + ' \u00a0|\u00a0 Mobile: ' + f.phones; }
  function firmRegLine(){  const f=FIRM(); return 'GSTIN: ' + f.gstin + ' \u00a0|\u00a0 Udyam Reg. No.: ' + f.udyam; }

  function repLetterhead(title,sub,metaPairs){
    var h='<div class="rep-head"><div class="rep-firm">SHIVAM ENTERPRISES</div>'
      +'<div class="rep-addr">'+esc(FIRM().address)+' &nbsp;|&nbsp; Mobile: '+esc(FIRM().phones)+'</div>'
      +'<div class="rep-addr">GSTIN: '+esc(FIRM().gstin)+' &nbsp;|&nbsp; Udyam Reg. No.: '+esc(FIRM().udyam)+'</div>'
      +'<div class="rep-rule"></div>'
      +'<div class="rep-title">'+esc(title)+'</div>'+(sub?('<div class="rep-sub">'+esc(sub)+'</div>'):'')+'</div>';
    if(metaPairs&&metaPairs.length){ h+='<div class="rep-meta">'+metaPairs.map(p=>'<span>'+esc(p[0])+': <b>'+esc(p[1])+'</b></span>').join('')+'</div>'; }
    return h;
  }
  function printReport(title,sub,metaPairs,inner,fname){
    var host=$('reportPrint'); if(!host) return;
    host.innerHTML='<div class="rep-page">'+repLetterhead(title,sub,metaPairs)+inner
      +'<div class="rep-foot">Generated on '+fmtDate(todayISO())+' &mdash; Shivam Enterprises Loan Management System</div></div>';
    window._docTitleBak=document.title;
    document.title = fname ? _docClean(fname) : (_docClean(title)+'_'+todayISO());
    document.body.classList.add('printing-report'); window.print();
  }

  /* =============== 1. DAILY COLLECTION =============== */
  function repCollection(){
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Daily Collection</h3>'
      +'<p>All payments received on a selected date, with totals by mode.</p></div>'
      +'<div class="actions"><button class="btn" onclick="repCollectionCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repCollectionPrint()">Print</button></div></div>'
      +'<div class="form-grid" style="grid-template-columns:240px; margin-bottom:14px;">'
      +'<div class="fg"><label>Date</label><input id="rcDate" type="date" onchange="repCollectionFill()"></div></div>'
      +'<div class="pay-tiles" id="rcSummary" style="margin-bottom:16px;"></div>'
      +'<div class="table-wrap"><table class="data"><thead><tr><th>Borrower</th><th>A/C No.</th>'
      +'<th>Mode</th><th>Cheque / Ref</th><th class="right">Amount</th><th>Status</th></tr></thead>'
      +'<tbody id="rcBody"></tbody></table></div></div>';
    var d=$('rcDate'); if(d&&!d.value) d.value=todayISO();
    repCollectionFill();
  }
  function repCollectionRows(){ var date=($('rcDate')||{}).value||todayISO(); return payAllRows().filter(p=>p.date===date); }
  function repCollectionFill(){
    var date=($('rcDate')||{}).value||todayISO(); var rows=repCollectionRows();
    var cash=0,chq=0,onl=0; rows.forEach(p=>{ if(p.mode==='Cash')cash+=p.amount; else if(p.mode==='Cheque')chq+=p.amount; else onl+=p.amount; });
    var tot=cash+chq+onl;
    $('rcSummary').innerHTML = repTile('Cash',inr(cash))+repTile('Cheque',inr(chq))+repTile('Online',inr(onl))+repTile('Total ('+rows.length+')',inr(tot),'ok');
    var tb=$('rcBody');
    if(!rows.length){ tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--grey);padding:24px;">No payments recorded on '+fmtDate(date)+'.</td></tr>'; return; }
    tb.innerHTML = rows.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.acno)+'</td><td>'+esc(p.mode)+'</td><td>'+repChqRef(p)+'</td><td class="right">'+inr(p.amount)+'</td><td>'+esc(p.status||'')+'</td></tr>').join('')
      +'<tr class="tot"><td colspan="4" class="right"><b>Total</b></td><td class="right"><b>'+inr(tot)+'</b></td><td></td></tr>';
  }
  function repCollectionCSV(){
    var date=($('rcDate')||{}).value||todayISO(); var rows=repCollectionRows();
    var data=rows.map(p=>[fmtDate(p.date),p.name,p.acno,p.mode,(p.mode==='Cheque'?p.cheque:p.ref),(p.mode==='Cheque'?p.bank:''),p.amount,p.status]);
    repCSV('Daily_Collection_'+date+'.csv', ['Date','Borrower','A/C No','Mode','Cheque/Ref','Bank','Amount','Status'], data);
  }
  function repCollectionPrint(){
    var date=($('rcDate')||{}).value||todayISO(); var rows=repCollectionRows();
    var cash=0,chq=0,onl=0; rows.forEach(p=>{ if(p.mode==='Cash')cash+=p.amount; else if(p.mode==='Cheque')chq+=p.amount; else onl+=p.amount; });
    var tot=cash+chq+onl;
    var t='<table><thead><tr><th>Borrower</th><th>A/C No.</th><th>Mode</th><th>Cheque / Ref</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>';
    if(!rows.length){ t+='<tr><td colspan="6" style="text-align:center;">No payments on this date.</td></tr>'; }
    else { t+=rows.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.acno)+'</td><td>'+esc(p.mode)+'</td><td>'+repChqRef(p)+'</td><td class="r">'+inr(p.amount)+'</td><td>'+esc(p.status||'')+'</td></tr>').join('');
      t+='<tr class="tot"><td colspan="4" class="r">Total</td><td class="r">'+inr(tot)+'</td><td></td></tr>'; }
    t+='</tbody></table>';
    printReport('Daily Collection Report','For '+fmtDate(date),[['Cash',inr(cash)],['Cheque',inr(chq)],['Online',inr(onl)],['Grand Total',inr(tot)],['Entries',String(rows.length)]],t);
  }

  /* =============== 2. CASH BOOK (receipts) =============== */
  function repCashbook(){
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Cash Book</h3>'
      +'<p>Cash receipts over a date range, in date order, with a running total.</p></div>'
      +'<div class="actions"><button class="btn" onclick="repCashbookCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repCashbookPrint()">Print</button></div></div>'
      +'<div class="form-grid" style="grid-template-columns:240px 240px; margin-bottom:14px;">'
      +'<div class="fg"><label>From</label><input id="cbFrom" type="date" onchange="repCashbookFill()"></div>'
      +'<div class="fg"><label>To</label><input id="cbTo" type="date" onchange="repCashbookFill()"></div></div>'
      +'<div class="pay-tiles" id="cbSummary" style="margin-bottom:16px;"></div>'
      +'<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Borrower</th><th>A/C No.</th>'
      +'<th class="right">Amount</th><th class="right">Running Total</th></tr></thead>'
      +'<tbody id="cbBody"></tbody></table></div></div>';
    var a=$('cbFrom'), b=$('cbTo'); if(a&&!a.value)a.value=repMonthStart(); if(b&&!b.value)b.value=todayISO();
    repCashbookFill();
  }
  function repCashbookData(){
    var from=($('cbFrom')||{}).value||repMonthStart(), to=($('cbTo')||{}).value||todayISO();
    return payAllRows().filter(p=>p.mode==='Cash' && p.date>=from && p.date<=to).sort((x,y)=>(x.date||'').localeCompare(y.date||''));
  }
  function repCashbookFill(){
    var rows=repCashbookData(); var run=0; var tb=$('cbBody');
    var tot=rows.reduce((a,p)=>a+p.amount,0);
    $('cbSummary').innerHTML = repTile('Cash received',inr(tot),'ok')+repTile('Entries',String(rows.length));
    if(!rows.length){ tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--grey);padding:24px;">No cash receipts in this range.</td></tr>'; return; }
    tb.innerHTML = rows.map(function(p){ run+=p.amount; return '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.acno)+'</td><td class="right">'+inr(p.amount)+'</td><td class="right">'+inr(run)+'</td></tr>'; }).join('')
      +'<tr class="tot"><td colspan="3" class="right"><b>Total</b></td><td class="right"><b>'+inr(tot)+'</b></td><td></td></tr>';
  }
  function repCashbookCSV(){
    var rows=repCashbookData(); var run=0;
    var data=rows.map(function(p){ run+=p.amount; return [fmtDate(p.date),p.name,p.acno,p.amount,run]; });
    var from=($('cbFrom')||{}).value||repMonthStart();
    repCSV('Cash_Book_'+from+'.csv', ['Date','Borrower','A/C No','Amount','Running Total'], data);
  }
  function repCashbookPrint(){
    var rows=repCashbookData(); var run=0; var tot=rows.reduce((a,p)=>a+p.amount,0);
    var from=($('cbFrom')||{}).value||repMonthStart(), to=($('cbTo')||{}).value||todayISO();
    var t='<table><thead><tr><th>Date</th><th>Borrower</th><th>A/C No.</th><th class="r">Amount</th><th class="r">Running Total</th></tr></thead><tbody>';
    if(!rows.length){ t+='<tr><td colspan="5" style="text-align:center;">No cash receipts in this range.</td></tr>'; }
    else { t+=rows.map(function(p){ run+=p.amount; return '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.acno)+'</td><td class="r">'+inr(p.amount)+'</td><td class="r">'+inr(run)+'</td></tr>'; }).join('');
      t+='<tr class="tot"><td colspan="3" class="r">Total</td><td class="r">'+inr(tot)+'</td><td></td></tr>'; }
    t+='</tbody></table>';
    printReport('Cash Book (Receipts)','From '+fmtDate(from)+' to '+fmtDate(to),[['Cash received',inr(tot)],['Entries',String(rows.length)]],t);
  }

  /* =============== ONLINE PAYMENTS =============== */
  function repOnline(){
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Online Payments</h3>'
      +'<p>Online / UPI / bank-transfer receipts over a date range, in date order, with a running total.</p></div>'
      +'<div class="actions"><button class="btn" onclick="repOnlineCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repOnlinePrint()">Print</button></div></div>'
      +'<div class="form-grid" style="grid-template-columns:240px 240px; margin-bottom:14px;">'
      +'<div class="fg"><label>From</label><input id="onFrom" type="date" onchange="repOnlineFill()"></div>'
      +'<div class="fg"><label>To</label><input id="onTo" type="date" onchange="repOnlineFill()"></div></div>'
      +'<div class="pay-tiles" id="onSummary" style="margin-bottom:16px;"></div>'
      +'<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Borrower</th><th>A/C No.</th>'
      +'<th>Reference / UTR</th><th class="right">Amount</th><th class="right">Running Total</th></tr></thead>'
      +'<tbody id="onBody"></tbody></table></div></div>';
    var a=$('onFrom'), b=$('onTo'); if(a&&!a.value)a.value=repMonthStart(); if(b&&!b.value)b.value=todayISO();
    repOnlineFill();
  }
  function repOnlineData(){
    var from=($('onFrom')||{}).value||repMonthStart(), to=($('onTo')||{}).value||todayISO();
    return payAllRows().filter(p=>p.mode==='Online' && p.date>=from && p.date<=to).sort((x,y)=>(x.date||'').localeCompare(y.date||''));
  }
  function repOnlineFill(){
    var rows=repOnlineData(); var run=0; var tb=$('onBody');
    var tot=rows.reduce((a,p)=>a+p.amount,0);
    $('onSummary').innerHTML = repTile('Online received',inr(tot),'ok')+repTile('Entries',String(rows.length));
    if(!rows.length){ tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--grey);padding:24px;">No online receipts in this range.</td></tr>'; return; }
    tb.innerHTML = rows.map(function(p){ run+=p.amount; return '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.acno)+'</td><td>'+esc(p.ref||'\u2014')+'</td><td class="right">'+inr(p.amount)+'</td><td class="right">'+inr(run)+'</td></tr>'; }).join('')
      +'<tr class="tot"><td colspan="4" class="right"><b>Total</b></td><td class="right"><b>'+inr(tot)+'</b></td><td></td></tr>';
  }
  function repOnlineCSV(){
    var rows=repOnlineData(); var run=0;
    var data=rows.map(function(p){ run+=p.amount; return [fmtDate(p.date),p.name,p.acno,(p.ref||''),p.amount,run]; });
    var from=($('onFrom')||{}).value||repMonthStart();
    repCSV('Online_Payments_'+from+'.csv', ['Date','Borrower','A/C No','Reference/UTR','Amount','Running Total'], data);
  }
  function repOnlinePrint(){
    var rows=repOnlineData(); var run=0; var tot=rows.reduce((a,p)=>a+p.amount,0);
    var from=($('onFrom')||{}).value||repMonthStart(), to=($('onTo')||{}).value||todayISO();
    var t='<table><thead><tr><th>Date</th><th>Borrower</th><th>A/C No.</th><th>Reference / UTR</th><th class="r">Amount</th><th class="r">Running Total</th></tr></thead><tbody>';
    if(!rows.length){ t+='<tr><td colspan="6" style="text-align:center;">No online receipts in this range.</td></tr>'; }
    else { t+=rows.map(function(p){ run+=p.amount; return '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.acno)+'</td><td>'+esc(p.ref||'\u2014')+'</td><td class="r">'+inr(p.amount)+'</td><td class="r">'+inr(run)+'</td></tr>'; }).join('');
      t+='<tr class="tot"><td colspan="4" class="r">Total</td><td class="r">'+inr(tot)+'</td><td></td></tr>'; }
    t+='</tbody></table>';
    printReport('Online Payments','From '+fmtDate(from)+' to '+fmtDate(to),[['Online received',inr(tot)],['Entries',String(rows.length)]],t);
  }

  /* =============== 3. CHEQUE REGISTER =============== */
  function repCheque(){
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Cheque Register</h3>'
      +'<p>All cheque payments in a date range, with cleared / pending status.</p></div>'
      +'<div class="actions"><button class="btn" onclick="repChequeCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repChequePrint()">Print</button></div></div>'
      +'<div class="form-grid" style="grid-template-columns:220px 220px 200px; margin-bottom:14px;">'
      +'<div class="fg"><label>From</label><input id="cqFrom" type="date" onchange="repChequeFill()"></div>'
      +'<div class="fg"><label>To</label><input id="cqTo" type="date" onchange="repChequeFill()"></div>'
      +'<div class="fg"><label>Status</label><select id="cqStatus" onchange="repChequeFill()">'
      +'<option value="all">All</option><option value="Cleared">Cleared only</option><option value="Pending">Pending only</option></select></div></div>'
      +'<div class="pay-tiles" id="cqSummary" style="margin-bottom:16px;"></div>'
      +'<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Borrower</th><th>A/C No.</th>'
      +'<th>Cheque No.</th><th>Bank</th><th class="right">Amount</th><th>Status</th></tr></thead>'
      +'<tbody id="cqBody"></tbody></table></div></div>';
    var a=$('cqFrom'), b=$('cqTo'); if(a&&!a.value)a.value=repMonthStart(); if(b&&!b.value)b.value=todayISO();
    repChequeFill();
  }
  function repChequeData(){
    var from=($('cqFrom')||{}).value||repMonthStart(), to=($('cqTo')||{}).value||todayISO(), st=($('cqStatus')||{}).value||'all';
    var rows=payAllRows().filter(p=>p.mode==='Cheque' && p.date>=from && p.date<=to).sort((x,y)=>(x.date||'').localeCompare(y.date||''));
    if(st!=='all') rows=rows.filter(p=>p.status===st);
    return rows;
  }
  function repChequeFill(){
    var rows=repChequeData(); var tb=$('cqBody');
    var cleared=rows.filter(p=>p.status==='Cleared').reduce((a,p)=>a+p.amount,0);
    var pending=rows.filter(p=>p.status==='Pending').reduce((a,p)=>a+p.amount,0);
    $('cqSummary').innerHTML = repTile('Cleared',inr(cleared),'ok')+repTile('Pending',inr(pending),'warn')+repTile('Cheques',String(rows.length));
    if(!rows.length){ tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--grey);padding:24px;">No cheques match.</td></tr>'; return; }
    tb.innerHTML = rows.map(p=>'<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.acno)+'</td><td>'+esc(p.cheque||'')+'</td><td>'+esc(p.bank||'')+'</td><td class="right">'+inr(p.amount)+'</td><td>'+esc(p.status||'')+'</td></tr>').join('')
      +'<tr class="tot"><td colspan="5" class="right"><b>Total</b></td><td class="right"><b>'+inr(cleared+pending)+'</b></td><td></td></tr>';
  }
  function repChequeCSV(){
    var rows=repChequeData();
    var data=rows.map(p=>[fmtDate(p.date),p.name,p.acno,p.cheque,p.bank,p.amount,p.status]);
    var from=($('cqFrom')||{}).value||repMonthStart();
    repCSV('Cheque_Register_'+from+'.csv', ['Date','Borrower','A/C No','Cheque No','Bank','Amount','Status'], data);
  }
  function repChequePrint(){
    var rows=repChequeData();
    var cleared=rows.filter(p=>p.status==='Cleared').reduce((a,p)=>a+p.amount,0);
    var pending=rows.filter(p=>p.status==='Pending').reduce((a,p)=>a+p.amount,0);
    var from=($('cqFrom')||{}).value||repMonthStart(), to=($('cqTo')||{}).value||todayISO();
    var t='<table><thead><tr><th>Date</th><th>Borrower</th><th>A/C No.</th><th>Cheque No.</th><th>Bank</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>';
    if(!rows.length){ t+='<tr><td colspan="7" style="text-align:center;">No cheques match.</td></tr>'; }
    else { t+=rows.map(p=>'<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.acno)+'</td><td>'+esc(p.cheque||'')+'</td><td>'+esc(p.bank||'')+'</td><td class="r">'+inr(p.amount)+'</td><td>'+esc(p.status||'')+'</td></tr>').join('');
      t+='<tr class="tot"><td colspan="5" class="r">Total</td><td class="r">'+inr(cleared+pending)+'</td><td></td></tr>'; }
    t+='</tbody></table>';
    printReport('Cheque Register','From '+fmtDate(from)+' to '+fmtDate(to),[['Cleared',inr(cleared)],['Pending',inr(pending)],['Cheques',String(rows.length)]],t);
  }

  /* =============== 4. LOAN STATUS =============== */
  function repStatus(){
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Loan Status Report</h3>'
      +'<p>All loan accounts by status, with principal and current outstanding.</p></div>'
      +'<div class="actions"><button class="btn" onclick="repStatusCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repStatusPrint()">Print</button></div></div>'
      +'<div class="form-grid" style="grid-template-columns:240px; margin-bottom:14px;">'
      +'<div class="fg"><label>Status</label><select id="lsStatus" onchange="repStatusFill()">'
      +'<option value="all">All accounts</option><option value="Active">Active</option>'
      +'<option value="Overdue">Overdue</option><option value="Closed">Closed</option></select></div></div>'
      +'<div class="pay-tiles" id="lsSummary" style="margin-bottom:16px;"></div>'
      +'<div class="table-wrap"><table class="data"><thead><tr><th>Borrower</th><th>A/C No.</th><th>Phone</th>'
      +'<th class="right">Principal</th><th class="right">Outstanding</th><th>Next Due</th><th>Status</th></tr></thead>'
      +'<tbody id="lsBody"></tbody></table></div></div>';
    repStatusFill();
  }
  function repStatusData(){
    var st=($('lsStatus')||{}).value||'all';
    var rows=loans.map(l=>({name:l.name,acno:l.acno,phone:l.phone||'',principal:Number(l.principal)||0,outstanding:Number(l.outstanding)||0,due:l.due||'',status:autoStatus(l)}));
    if(st!=='all') rows=rows.filter(r=>r.status===st);
    rows.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    return rows;
  }
  function repStatusFill(){
    var rows=repStatusData(); var tb=$('lsBody');
    var sumP=rows.reduce((a,r)=>a+r.principal,0), sumO=rows.reduce((a,r)=>a+r.outstanding,0);
    $('lsSummary').innerHTML = repTile('Accounts',String(rows.length))+repTile('Total principal',inr(sumP))+repTile('Total outstanding',inr(sumO),'warn');
    if(!rows.length){ tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--grey);padding:24px;">No accounts match.</td></tr>'; return; }
    tb.innerHTML = rows.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.acno)+'</td><td>'+esc(r.phone)+'</td><td class="right">'+inr(r.principal)+'</td><td class="right">'+inr(r.outstanding)+'</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td>'+esc(r.status)+'</td></tr>').join('')
      +'<tr class="tot"><td colspan="3" class="right"><b>Total</b></td><td class="right"><b>'+inr(sumP)+'</b></td><td class="right"><b>'+inr(sumO)+'</b></td><td colspan="2"></td></tr>';
  }
  function repStatusCSV(){
    var rows=repStatusData();
    var data=rows.map(r=>[r.name,r.acno,r.phone,r.principal,r.outstanding,fmtDate(r.due),r.status]);
    repCSV('Loan_Status_'+todayISO()+'.csv', ['Borrower','A/C No','Phone','Principal','Outstanding','Next Due','Status'], data);
  }
  function repStatusPrint(){
    var rows=repStatusData(); var st=($('lsStatus')||{}).value||'all';
    var sumP=rows.reduce((a,r)=>a+r.principal,0), sumO=rows.reduce((a,r)=>a+r.outstanding,0);
    var t='<table><thead><tr><th>Borrower</th><th>A/C No.</th><th>Phone</th><th class="r">Principal</th><th class="r">Outstanding</th><th>Next Due</th><th>Status</th></tr></thead><tbody>';
    if(!rows.length){ t+='<tr><td colspan="7" style="text-align:center;">No accounts match.</td></tr>'; }
    else { t+=rows.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.acno)+'</td><td>'+esc(r.phone)+'</td><td class="r">'+inr(r.principal)+'</td><td class="r">'+inr(r.outstanding)+'</td><td>'+(r.due?fmtDate(r.due):'-')+'</td><td>'+esc(r.status)+'</td></tr>').join('');
      t+='<tr class="tot"><td colspan="3" class="r">Total</td><td class="r">'+inr(sumP)+'</td><td class="r">'+inr(sumO)+'</td><td colspan="2"></td></tr>'; }
    t+='</tbody></table>';
    printReport('Loan Status Report', (st==='all'?'All accounts':st+' accounts'), [['Accounts',String(rows.length)],['Total principal',inr(sumP)],['Total outstanding',inr(sumO)]], t);
  }

  /* =============== 5. CUSTOMER STATEMENT =============== */
  function repStatement(){
    var opts=loans.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''))
      .map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' &mdash; '+esc(l.acno||'')+'</option>').join('');
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Customer Statement</h3>'
      +'<p>Full statement of account for one borrower &mdash; loan terms, every payment and the balance.</p></div>'
      +'<div class="actions"><button class="btn" onclick="repStatementCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repStatementPrint()">Print</button></div></div>'
      +'<div class="form-grid" style="grid-template-columns:420px; margin-bottom:14px;">'
      +'<div class="fg"><label>Borrower / Loan A/C</label><select id="stLoan" onchange="repStatementFill()">'
      +'<option value="">&mdash; Select a borrower &mdash;</option>'+opts+'</select></div></div>'
      +'<div id="stBody"></div></div>';
    repStatementFill();
  }
  function repStatementLoan(){ var id=($('stLoan')||{}).value; if(!id) return null; return loans.find(l=>String(l.id)===String(id))||null; }
  /* Restructure / prepayment events for a loan, oldest first (empty if never restructured). */
  function repRsHistory(l){ var rs=Array.isArray(l.restructures)?l.restructures.slice():[]; rs.sort(function(a,b){ return String(a.date||'').localeCompare(String(b.date||'')); }); return rs; }
  function _isPrepay(p){ return /prepay/i.test((p&&p.note)||''); }
  function repStatementFill(){
    var l=repStatementLoan(); var host=$('stBody'); if(!host) return;
    if(!l){ host.innerHTML='<p style="color:var(--grey);">Select a borrower to view their statement.</p>'; return; }
    var pays=(l.payments||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    var payable=repLoanPayable(l); var ded=Number(l.deductions)||0; var run=0;
    var rowsHtml = pays.length? pays.map(function(p){ var amt=Number(p.amount)||0; if(p.status!=='Pending'){ run+=amt; } var pf=_isPrepay(p)?' <span style="color:var(--muted);font-size:10.5px;">· prepayment</span>':''; return '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.mode)+pf+'</td><td>'+repChqRef(p)+'</td><td class="right">'+inr(amt)+'</td><td>'+esc(p.status||'')+'</td><td class="right">'+inr(run)+'</td></tr>'; }).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--grey);padding:18px;">No payments recorded yet.</td></tr>';
    var rs=repRsHistory(l);
    var rsHtml = rs.length ? ('<div style="font-weight:650;font-size:13px;margin:4px 0 6px;">Restructuring &amp; Prepayment History</div>'
      +'<div class="table-wrap" style="margin-bottom:14px;"><table class="data"><thead><tr><th>Date</th><th class="right">Prepayment</th><th class="right">Outstanding (before → after)</th><th class="right">EMI (before → after)</th><th>Tenure (before → after)</th></tr></thead><tbody>'
      + rs.map(function(r){ var rateChg=(r.newRate!=null && r.oldRate!=null && Number(r.newRate)!==Number(r.oldRate))?('<br><span style="color:var(--muted);font-size:11px;">rate '+r.oldRate+'% → '+r.newRate+'% p.m.</span>'):''; return '<tr><td>'+fmtDate(r.date)+'</td><td class="right">'+((Number(r.lump)||0)>0?inr(r.lump):'—')+'</td><td class="right">'+inr(r.oldOut)+' → '+inr(r.newOut)+'</td><td class="right">'+inr(r.oldEmi)+' → '+inr(r.newEmi)+rateChg+'</td><td>'+(r.oldTenure||'—')+' → '+(r.newTenure||'—')+' mo</td></tr>'; }).join('')
      + '</tbody></table></div>') : '';
    var meta='<div class="pay-tiles" style="margin-bottom:14px;">'
      +repTile('Total payable',inr(payable))
      +repTile('Paid (cleared)',inr(run),'ok')
      +(ded?repTile('Processing/Deductions',inr(ded)):'')
      +repTile('Outstanding',inr(Number(l.outstanding)||0),'warn')+'</div>';
    var terms='<div class="table-wrap" style="margin-bottom:14px;"><table class="data"><tbody>'
      +'<tr><th>Borrower</th><td>'+esc(l.name)+'</td><th>A/C No.</th><td>'+esc(l.acno||'')+'</td></tr>'
      +'<tr><th>Phone</th><td>'+esc(l.phone||'')+'</td><th>Type</th><td>'+esc(l.type||'')+'</td></tr>'
      +'<tr><th>Principal</th><td>'+inr(l.principal)+'</td><th>Interest rate</th><td>'+(Number(l.rate)>0?esc(String(l.rate))+'%':'&mdash;')+'</td></tr>'
      +'<tr><th>Tenure</th><td>'+esc(String(l.tenure||''))+' months</td><th>EMI</th><td>'+inr(l.emi)+'</td></tr>'
      +'<tr><th>Disbursed</th><td>'+(l.disb?fmtDate(l.disb):'&mdash;')+'</td><th>Status</th><td>'+esc(autoStatus(l))+'</td></tr>'
      +'</tbody></table></div>';
    host.innerHTML = terms + meta + rsHtml
      +'<div style="font-weight:650;font-size:13px;margin:4px 0 6px;">Payment Ledger</div>'
      +'<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Mode</th><th>Cheque / Ref</th>'
      +'<th class="right">Amount</th><th>Status</th><th class="right">Paid to date</th></tr></thead><tbody>'+rowsHtml+'</tbody></table></div>';
  }
  function repStatementCSV(){
    var l=repStatementLoan(); if(!l){ toast('Select a borrower first'); return; }
    var pays=(l.payments||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')); var run=0;
    var data=pays.map(function(p){ var amt=Number(p.amount)||0; if(p.status!=='Pending'){ run+=amt; } return [fmtDate(p.date),p.mode,(p.mode==='Cheque'?p.cheque:p.ref),amt,p.status,run]; });
    repCSV('Statement_'+(l.acno||l.name||'loan')+'.csv', ['Date','Mode','Cheque/Ref','Amount','Status','Paid to date'], data);
  }
  function repStatementPrint(){
    var l=repStatementLoan(); if(!l){ toast('Select a borrower first'); return; }
    var pays=(l.payments||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    var payable=repLoanPayable(l); var ded=Number(l.deductions)||0; var run=0;
    var t='<table><thead><tr><th>Date</th><th>Mode</th><th>Cheque / Ref</th><th class="r">Amount</th><th>Status</th><th class="r">Paid to date</th></tr></thead><tbody>';
    if(!pays.length){ t+='<tr><td colspan="6" style="text-align:center;">No payments recorded yet.</td></tr>'; }
    else { t+=pays.map(function(p){ var amt=Number(p.amount)||0; if(p.status!=='Pending'){ run+=amt; } return '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.mode)+(_isPrepay(p)?' (prepayment)':'')+'</td><td>'+repChqRef(p)+'</td><td class="r">'+inr(amt)+'</td><td>'+esc(p.status||'')+'</td><td class="r">'+inr(run)+'</td></tr>'; }).join(''); }
    t+='</tbody></table>';
    /* Restructuring & prepayment history \u2014 shows the customer when terms changed and what changed. */
    var rs=repRsHistory(l); var rsT='';
    if(rs.length){
      rsT='<div style="font-weight:700;margin:2px 0 4px;color:#0b1f4b;">Restructuring &amp; Prepayment History</div>'
        +'<table><thead><tr><th>Date</th><th class="r">Prepayment</th><th class="r">Outstanding (before &rarr; after)</th><th class="r">EMI (before &rarr; after)</th><th>Tenure (before &rarr; after)</th></tr></thead><tbody>'
        + rs.map(function(r){ var rateChg=(r.newRate!=null && r.oldRate!=null && Number(r.newRate)!==Number(r.oldRate))?(' &middot; rate '+r.oldRate+'%&rarr;'+r.newRate+'%'):''; return '<tr><td>'+fmtDate(r.date)+'</td><td class="r">'+((Number(r.lump)||0)>0?inr(r.lump):'&mdash;')+'</td><td class="r">'+inr(r.oldOut)+' &rarr; '+inr(r.newOut)+'</td><td class="r">'+inr(r.oldEmi)+' &rarr; '+inr(r.newEmi)+rateChg+'</td><td>'+(r.oldTenure||'&mdash;')+' &rarr; '+(r.newTenure||'&mdash;')+' mo</td></tr>'; }).join('')
        + '</tbody></table>';
    }
    var inner = rsT + '<div style="font-weight:700;margin:14px 0 4px;color:#0b1f4b;">Payment Ledger</div>' + t;
    var meta=[['Principal',inr(l.principal)],['Rate',(Number(l.rate)>0?String(l.rate)+'%':'\u2014')],['Tenure',String(l.tenure||'')+' mo'],['EMI',inr(l.emi)],['Total payable',inr(payable)],['Paid (cleared)',inr(run)]];
    if(ded) meta.push(['Processing/Deductions',inr(ded)]);
    meta.push(['Outstanding',inr(Number(l.outstanding)||0)]);
    if(rs.length) meta.push(['Restructured',String(rs.length)+'\u00d7, last '+fmtDate(rs[rs.length-1].date)]);
    printReport('Statement of Account', l.name+'  (A/C '+(l.acno||'')+')', meta, inner, _docFileName(l.name,l.acno,'Statement'));
  }

  /* ============ EMI SCHEDULE + OVERDUE TRACKING ============ */
  function repPad(n){ return (n<10?'0':'')+n; }
  function repAddMonths(iso,n){ if(!iso) return ''; var p=iso.split('-'); var y=+p[0], m=+p[1], d=+p[2]; var idx=(m-1)+n; var ny=y+Math.floor(idx/12); var nm=((idx%12)+12)%12; var last=new Date(ny,nm+1,0).getDate(); var nd=Math.min(d,last); return ny+'-'+repPad(nm+1)+'-'+repPad(nd); }
  function repDaysBetween(aIso,bIso){ if(!aIso||!bIso) return 0; var a=new Date(aIso+'T00:00:00'), b=new Date(bIso+'T00:00:00'); return Math.round((b-a)/86400000); }
  function repStColor(st){ return st==='Paid'?'var(--ok)':(st==='Partial'?'#b26a00':(st==='Overdue'?'var(--bad)':(st==='Due soon'?'var(--warn)':'var(--grey)'))); }

