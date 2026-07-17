  /* ---------------- OVERDUE TRACKING ---------------- */
  /* ---------- Interest Income ----------
     Flat monthly interest: every rupee collected carries interest and principal in the
     same ratio as the loan itself (interest / total payable). Interest actually RECEIVED
     in the period is therefore  cleared payments x (total interest / total payable). */
  function repInterestData(){
    var f=($('intFrom')&&$('intFrom').value)||'', t=($('intTo')&&$('intTo').value)||'';
    var rows=[], recv=0, booked=0, outstandingInt=0;
    loans.forEach(function(l){
      var tpay=Number(l.tpay)||0, tint=Number(l.tint)||0;
      if(tpay<=0) return;
      /* Interest ratio comes from the ORIGINAL contract when the loan has been restructured
         (tpay0/tint0 are frozen at first restructure) — a restructure changes the repayment
         plan, not how much of each collected rupee was interest under the agreement. */
      var shareTpay=Number(l.tpay0!=null?l.tpay0:tpay)||0, shareTint=Number(l.tint0!=null?l.tint0:tint)||0;
      var share=shareTpay>0?(shareTint/shareTpay):0;
      var got=0;
      (l.payments||[]).forEach(function(p){
        if(p.status!=='Cleared') return;
        var d=p.date||'';
        if(f && d<f) return;
        if(t && d>t) return;
        got += (Number(p.amount)||0);
      });
      var intGot=Math.round(got*share);
      var paidAll=Number(l.paid)||0;
      var intEarnedToDate=Math.round(paidAll*share);
      var intPending=Math.max(0, tint-intEarnedToDate);
      booked += tint; outstandingInt += intPending; recv += intGot;
      if(got>0 || intPending>0){
        rows.push({name:l.name, acno:l.acno, type:l.type||'', principal:Number(l.principal)||0,
                   rate:Number(l.rate)||0, tint:tint, collected:got, intGot:intGot, intPending:intPending});
      }
    });
    rows.sort(function(a,b){ return b.intGot-a.intGot; });
    return {rows:rows, recv:recv, booked:booked, pending:outstandingInt, f:f, t:t};
  }
  function repInterest(){
    var today=todayISO(), first=today.slice(0,8)+'01';
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Interest Income</h3>'
      +'<p>Interest actually received in a period, and interest still to come on the live book.</p></div>'
      +'<div class="actions">'
      +'<input type="date" class="filter" id="intFrom" value="'+first+'" onchange="repInterestFill()">'
      +'<input type="date" class="filter" id="intTo" value="'+today+'" onchange="repInterestFill()">'
      +'<button class="btn" onclick="repInterestCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repInterestPrint()">Print</button></div></div>'
      +'<div id="intBody"></div></div>';
    repInterestFill();
  }
  function repInterestFill(){
    var D=repInterestData();
    var head='<div class="kpi-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">'
      +'<div class="bk-card" style="flex:1;min-width:170px;"><div class="ph-sub">Interest received in period</div><div style="font-size:20px;font-weight:700;">'+inr(D.recv)+'</div></div>'
      +'<div class="bk-card" style="flex:1;min-width:170px;"><div class="ph-sub">Interest still to come</div><div style="font-size:20px;font-weight:700;">'+inr(D.pending)+'</div></div>'
      +'<div class="bk-card" style="flex:1;min-width:170px;"><div class="ph-sub">Total interest on book</div><div style="font-size:20px;font-weight:700;">'+inr(D.booked)+'</div></div>'
      +'</div>';
    var t='<div class="table-wrap"><table class="data"><thead><tr><th>Borrower</th><th>A/C No.</th><th>Type</th><th class="right">Rate</th><th class="right">Collected</th><th class="right">Interest in it</th><th class="right">Interest pending</th></tr></thead><tbody>'
      + (D.rows.length? D.rows.map(function(r){
          return '<tr><td class="name">'+esc(r.name)+'</td><td>'+esc(r.acno)+'</td><td>'+esc(r.type)+'</td>'
            +'<td class="right num">'+r.rate+'%</td><td class="right num">'+inr(r.collected)+'</td>'
            +'<td class="right num">'+inr(r.intGot)+'</td><td class="right num">'+inr(r.intPending)+'</td></tr>';
        }).join('')
        : '<tr><td colspan="7" class="muted" style="padding:14px;">No interest received in this period.</td></tr>')
      +'</tbody></table></div>';
    $('intBody').innerHTML = head + t;
  }
  function repInterestCSV(){
    var D=repInterestData();
    repCSV('Interest_Income_'+todayISO()+'.csv',
      ['Borrower','A/C No','Type','Rate %','Collected','Interest received','Interest pending'],
      D.rows.map(function(r){ return [r.name,r.acno,r.type,r.rate,r.collected,r.intGot,r.intPending]; }));
  }
  function repInterestPrint(){
    var D=repInterestData();
    var t='<table><thead><tr><th>Borrower</th><th>A/C No.</th><th class="r">Rate</th><th class="r">Collected</th><th class="r">Interest received</th><th class="r">Interest pending</th></tr></thead><tbody>'
      + D.rows.map(function(r){ return '<tr><td>'+esc(r.name)+'</td><td>'+esc(r.acno)+'</td><td class="r">'+r.rate+'%</td><td class="r">'+inr(r.collected)+'</td><td class="r">'+inr(r.intGot)+'</td><td class="r">'+inr(r.intPending)+'</td></tr>'; }).join('')
      + '<tr class="tot"><td colspan="4">Total interest received</td><td class="r">'+inr(D.recv)+'</td><td class="r">'+inr(D.pending)+'</td></tr>'
      + '</tbody></table>';
    printReport('Interest Income Report',
      (D.f?fmtDate(D.f):'Beginning')+' to '+(D.t?fmtDate(D.t):fmtDate(todayISO())),
      [['Interest received',inr(D.recv)],['Interest still to come',inr(D.pending)],['Total interest on book',inr(D.booked)]],
      t);
  }

  /* ---------- Collection Efficiency ----------
     What was expected in the period (EMIs that fell due) versus what actually came in. */
  function repEfficiencyData(){
    var f=($('effFrom')&&$('effFrom').value)||'', t=($('effTo')&&$('effTo').value)||'';
    var expected=0, collected=0, rows=[];
    loans.forEach(function(l){
      var emi=Number(l.emi)||0;
      var due=l.due||'';
      var inRange = due && (!f || due>=f) && (!t || due<=t);
      var exp = inRange ? emi : 0;
      var got=0;
      (l.payments||[]).forEach(function(p){
        if(p.status!=='Cleared') return;
        var d=p.date||'';
        if(f && d<f) return;
        if(t && d>t) return;
        got += (Number(p.amount)||0);
      });
      if(exp>0 || got>0){
        expected+=exp; collected+=got;
        rows.push({name:l.name, acno:l.acno, due:due, expected:exp, collected:got,
                   pct: exp>0 ? Math.round(got/exp*100) : null,
                   arrears:Number(l.arrears)||0, status:autoStatus(l)});
      }
    });
    var pct = expected>0 ? Math.round(collected/expected*100) : null;
    return {rows:rows, expected:expected, collected:collected, pct:pct, f:f, t:t};
  }
  function repEfficiency(){
    var today=todayISO(), first=today.slice(0,8)+'01';
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Collection Efficiency</h3>'
      +'<p>How much of what fell due in the period was actually collected.</p></div>'
      +'<div class="actions">'
      +'<input type="date" class="filter" id="effFrom" value="'+first+'" onchange="repEfficiencyFill()">'
      +'<input type="date" class="filter" id="effTo" value="'+today+'" onchange="repEfficiencyFill()">'
      +'<button class="btn" onclick="repEfficiencyCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repEfficiencyPrint()">Print</button></div></div>'
      +'<div id="effBody"></div></div>';
    repEfficiencyFill();
  }
  function repEfficiencyFill(){
    var D=repEfficiencyData();
    var col = D.pct===null ? '#64748b' : (D.pct>=90?'#16a34a':(D.pct>=70?'#c8a02a':'#dc2626'));
    var head='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">'
      +'<div class="bk-card" style="flex:1;min-width:160px;"><div class="ph-sub">Expected (EMIs due)</div><div style="font-size:20px;font-weight:700;">'+inr(D.expected)+'</div></div>'
      +'<div class="bk-card" style="flex:1;min-width:160px;"><div class="ph-sub">Collected</div><div style="font-size:20px;font-weight:700;">'+inr(D.collected)+'</div></div>'
      +'<div class="bk-card" style="flex:1;min-width:160px;"><div class="ph-sub">Efficiency</div><div style="font-size:20px;font-weight:700;color:'+col+';">'+(D.pct===null?'\u2014':(D.pct+'%'))+'</div></div>'
      +'</div>';
    var t='<div class="table-wrap"><table class="data"><thead><tr><th>Borrower</th><th>A/C No.</th><th>Due date</th><th class="right">Expected</th><th class="right">Collected</th><th class="right">%</th><th>Status</th></tr></thead><tbody>'
      + (D.rows.length? D.rows.map(function(r){
          var c = r.pct===null?'':(r.pct>=100?'color:#16a34a;':(r.pct>0?'color:#c8a02a;':'color:#dc2626;'));
          return '<tr><td class="name">'+esc(r.name)+'</td><td>'+esc(r.acno)+'</td><td>'+(r.due?fmtDate(r.due):'\u2014')+'</td>'
            +'<td class="right num">'+(r.expected?inr(r.expected):'\u2014')+'</td><td class="right num">'+inr(r.collected)+'</td>'
            +'<td class="right num" style="'+c+'font-weight:600;">'+(r.pct===null?'\u2014':(r.pct+'%'))+'</td>'
            +'<td><span class="badge '+r.status.toLowerCase()+'">'+r.status+'</span></td></tr>';
        }).join('')
        : '<tr><td colspan="7" class="muted" style="padding:14px;">Nothing due or collected in this period.</td></tr>')
      +'</tbody></table></div>';
    $('effBody').innerHTML = head + t;
  }
  function repEfficiencyCSV(){
    var D=repEfficiencyData();
    repCSV('Collection_Efficiency_'+todayISO()+'.csv',
      ['Borrower','A/C No','Due date','Expected','Collected','Efficiency %','Status'],
      D.rows.map(function(r){ return [r.name,r.acno,r.due,r.expected,r.collected,(r.pct===null?'':r.pct),r.status]; }));
  }
  function repEfficiencyPrint(){
    var D=repEfficiencyData();
    var t='<table><thead><tr><th>Borrower</th><th>A/C No.</th><th>Due date</th><th class="r">Expected</th><th class="r">Collected</th><th class="r">%</th></tr></thead><tbody>'
      + D.rows.map(function(r){ return '<tr><td>'+esc(r.name)+'</td><td>'+esc(r.acno)+'</td><td>'+(r.due?fmtDate(r.due):'\u2014')+'</td><td class="r">'+(r.expected?inr(r.expected):'\u2014')+'</td><td class="r">'+inr(r.collected)+'</td><td class="r">'+(r.pct===null?'\u2014':(r.pct+'%'))+'</td></tr>'; }).join('')
      + '<tr class="tot"><td colspan="3">Total</td><td class="r">'+inr(D.expected)+'</td><td class="r">'+inr(D.collected)+'</td><td class="r">'+(D.pct===null?'\u2014':(D.pct+'%'))+'</td></tr>'
      + '</tbody></table>';
    printReport('Collection Efficiency Report',
      (D.f?fmtDate(D.f):'Beginning')+' to '+(D.t?fmtDate(D.t):fmtDate(todayISO())),
      [['Expected',inr(D.expected)],['Collected',inr(D.collected)],['Efficiency',(D.pct===null?'\u2014':(D.pct+'%'))]],
      t);
  }

  /* ---------- Profit & Loss ----------
     Income  = interest actually received + charges collected (late fees, bounce fees)
     Expenses = whatever you record in the expense ledger below
     Principal repaid is NOT income - it is your own money coming back. */
  const EXP_STORE='shivam_expenses_v1';
  function loadExpenses(){ try{ return JSON.parse(localStorage.getItem(EXP_STORE)||'[]'); }catch(e){ return []; } }
  function saveExpenses(a){ try{ localStorage.setItem(EXP_STORE, JSON.stringify(a||[])); }catch(e){} }
  window.addExpense=function(){
    const d=($('expDate')&&$('expDate').value)||todayISO();
    const c=($('expCat')&&$('expCat').value)||'Other';
    const n=(($('expNote')&&$('expNote').value)||'').trim();
    const a=Math.round(Number(($('expAmt')&&$('expAmt').value)||0));
    if(!(a>0)){ toast('\u26a0 Enter an amount'); return; }
    const list=loadExpenses();
    list.push({id:'e'+Date.now()+Math.random().toString(36).slice(2,6), date:d, cat:c, note:n, amount:a});
    saveExpenses(list);
    try{ logAudit('Expense Added', c+' \u2014 '+inr(a)+(n?(' ('+n+')'):'')); }catch(e){}
    if($('expAmt')) $('expAmt').value=''; if($('expNote')) $('expNote').value='';
    repPnlFill(); toast('Expense recorded');
  };
  window.delExpense=function(id){
    if(!confirm('Remove this expense entry?')) return;
    const list=loadExpenses().filter(x=>x.id!==id);
    saveExpenses(list);
    try{ logAudit('Expense Removed', id); }catch(e){}
    repPnlFill();
  };
  function repPnlData(){
    var f=($('pnlFrom')&&$('pnlFrom').value)||'', t=($('pnlTo')&&$('pnlTo').value)||'';
    var inRange=function(d){ if(!d) return false; if(f && d<f) return false; if(t && d>t) return false; return true; };
    var interest=0, principal=0, charges=0;
    loans.forEach(function(l){
      var tpay=Number(l.tpay)||0, tint=Number(l.tint)||0; if(tpay<=0) return;
      var share=tint/tpay;
      (l.payments||[]).forEach(function(p){
        if(p.status!=='Cleared' || !inRange(p.date)) return;
        var amt=Number(p.amount)||0;
        interest += amt*share;
        principal += amt*(1-share);
      });
      (l.charges||[]).forEach(function(c){ if(inRange(c.date)) charges += Number(c.amount)||0; });
    });
    interest=Math.round(interest); principal=Math.round(principal); charges=Math.round(charges);
    var exps=loadExpenses().filter(function(x){ return inRange(x.date); });
    var expTotal=exps.reduce(function(a,x){ return a+(Number(x.amount)||0); },0);
    var income=interest+charges;
    return {f:f,t:t, interest:interest, principal:principal, charges:charges, income:income,
            expenses:exps, expTotal:expTotal, profit:income-expTotal};
  }
  function repPnl(){
    var today=todayISO(), first=today.slice(0,5)+'04-01';   // Indian financial year start
    if(first>today) first=(Number(today.slice(0,4))-1)+'-04-01';
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Profit &amp; Loss</h3>'
      +'<p>Your earnings for a period. Interest and charges are income \u2014 principal coming back is not.</p></div>'
      +'<div class="actions">'
      +'<input type="date" class="filter" id="pnlFrom" value="'+first+'" onchange="repPnlFill()">'
      +'<input type="date" class="filter" id="pnlTo" value="'+today+'" onchange="repPnlFill()">'
      +'<button class="btn" onclick="repPnlCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repPnlPrint()">Print</button></div></div>'
      +'<div id="pnlBody"></div></div>';
    repPnlFill();
  }
  function repPnlFill(){
    var D=repPnlData();
    var pcol = D.profit>=0 ? '#16a34a' : '#dc2626';
    var head='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      +'<div class="bk-card" style="flex:1;min-width:150px;"><div class="ph-sub">Income</div><div style="font-size:20px;font-weight:700;">'+inr(D.income)+'</div></div>'
      +'<div class="bk-card" style="flex:1;min-width:150px;"><div class="ph-sub">Expenses</div><div style="font-size:20px;font-weight:700;">'+inr(D.expTotal)+'</div></div>'
      +'<div class="bk-card" style="flex:1;min-width:150px;"><div class="ph-sub">'+(D.profit>=0?'Profit':'Loss')+'</div><div style="font-size:20px;font-weight:700;color:'+pcol+';">'+inr(Math.abs(D.profit))+'</div></div>'
      +'</div>';
    var inc='<div class="table-wrap" style="margin-bottom:14px;"><table class="data"><thead><tr><th>Income</th><th class="right">Amount</th></tr></thead><tbody>'
      +'<tr><td>Interest received</td><td class="right num">'+inr(D.interest)+'</td></tr>'
      +'<tr><td>Charges collected (late fees, cheque bounce)</td><td class="right num">'+inr(D.charges)+'</td></tr>'
      +'<tr class="tot"><td><b>Total income</b></td><td class="right num"><b>'+inr(D.income)+'</b></td></tr>'
      +'<tr><td class="muted">Principal recovered (not income \u2014 your own money returning)</td><td class="right num muted">'+inr(D.principal)+'</td></tr>'
      +'</tbody></table></div>';
    var rows=D.expenses.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
    var exp='<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Category</th><th>Note</th><th class="right">Amount</th><th></th></tr></thead><tbody>'
      + (rows.length? rows.map(function(x){
          return '<tr><td>'+(fmtDate(x.date)||'\u2014')+'</td><td>'+esc(x.cat)+'</td><td class="muted">'+esc(x.note||'\u2014')+'</td>'
            +'<td class="right num">'+inr(x.amount)+'</td>'
            +'<td><button class="lnk del" onclick="delExpense(\''+esc(x.id)+'\')">remove</button></td></tr>';
        }).join('')
        : '<tr><td colspan="5" class="muted" style="padding:12px;">No expenses recorded in this period.</td></tr>')
      + '<tr class="tot"><td colspan="3"><b>Total expenses</b></td><td class="right num"><b>'+inr(D.expTotal)+'</b></td><td></td></tr>'
      +'</tbody></table></div>';
    var form='<div class="bk-card" style="margin-top:12px;"><b style="font-size:13px;">Record an expense</b>'
      +'<p class="ph-sub" style="margin:4px 0 8px;">Rent, salaries, electricity, travel \u2014 anything you spend to run the business. These are saved with your backups.</p>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
      +'<input type="date" id="expDate" value="'+todayISO()+'" style="border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:12.5px;background:var(--field);color:var(--text);font-family:inherit;">'
      +'<select id="expCat" class="filter"><option>Rent</option><option>Salaries</option><option>Electricity</option><option>Travel</option><option>Office</option><option>Legal / Professional</option><option>Other</option></select>'
      +'<input id="expNote" placeholder="Note (optional)" style="flex:1;min-width:120px;border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:12.5px;background:var(--field);color:var(--text);font-family:inherit;">'
      +'<input id="expAmt" type="number" placeholder="Amount \u20b9" style="width:130px;border:1px solid var(--line);border-radius:7px;padding:7px 9px;font-size:12.5px;background:var(--field);color:var(--text);font-family:inherit;">'
      +'<button class="btn btn-sm btn-primary" onclick="addExpense()">Add</button></div></div>';
    $('pnlBody').innerHTML = head + inc + '<h4 style="font-size:13px;margin:12px 0 6px;">Expenses</h4>' + exp + form;
  }
  function repPnlCSV(){
    var D=repPnlData();
    var rows=[['INCOME','',''],['Interest received','',D.interest],['Charges collected','',D.charges],['Total income','',D.income],
              ['','',''],['EXPENSES','','']];
    D.expenses.forEach(function(x){ rows.push([x.date, x.cat+(x.note?(' - '+x.note):''), x.amount]); });
    rows.push(['Total expenses','',D.expTotal]);
    rows.push(['','','']);
    rows.push([(D.profit>=0?'PROFIT':'LOSS'),'',Math.abs(D.profit)]);
    repCSV('Profit_and_Loss_'+todayISO()+'.csv', ['Item','Details','Amount'], rows);
  }
  function repPnlPrint(){
    var D=repPnlData();
    var t='<table><thead><tr><th>Particulars</th><th class="r">Amount</th></tr></thead><tbody>'
      +'<tr><td><b>Income</b></td><td class="r"></td></tr>'
      +'<tr><td>&nbsp;&nbsp;Interest received</td><td class="r">'+inr(D.interest)+'</td></tr>'
      +'<tr><td>&nbsp;&nbsp;Charges collected</td><td class="r">'+inr(D.charges)+'</td></tr>'
      +'<tr class="tot"><td>Total income</td><td class="r">'+inr(D.income)+'</td></tr>'
      +'<tr><td><b>Expenses</b></td><td class="r"></td></tr>'
      + D.expenses.map(function(x){ return '<tr><td>&nbsp;&nbsp;'+(fmtDate(x.date)||'')+' \u2014 '+esc(x.cat)+(x.note?(' ('+esc(x.note)+')'):'')+'</td><td class="r">'+inr(x.amount)+'</td></tr>'; }).join('')
      +'<tr class="tot"><td>Total expenses</td><td class="r">'+inr(D.expTotal)+'</td></tr>'
      +'<tr class="tot"><td><b>'+(D.profit>=0?'NET PROFIT':'NET LOSS')+'</b></td><td class="r"><b>'+inr(Math.abs(D.profit))+'</b></td></tr>'
      +'<tr><td class="muted">Principal recovered (not income)</td><td class="r">'+inr(D.principal)+'</td></tr>'
      +'</tbody></table>';
    printReport('Profit & Loss Statement',
      (D.f?fmtDate(D.f):'Beginning')+' to '+(D.t?fmtDate(D.t):fmtDate(todayISO())),
      [['Income',inr(D.income)],['Expenses',inr(D.expTotal)],[(D.profit>=0?'Net profit':'Net loss'),inr(Math.abs(D.profit))]],
      t);
  }

  function repOverdue(){
    $('repBody').innerHTML =
      '<div class="panel"><div class="panel-head"><div class="t"><h3>Overdue Tracking</h3>'
      +'<p>Aging of overdue accounts, plus EMIs falling due in the next 7 days.</p></div>'
      +'<div class="actions"><button class="btn" onclick="repOverdueCSV()">Export CSV</button>'
      +'<button class="btn btn-primary" onclick="repOverduePrint()">Print</button></div></div>'
      +'<div id="ovBody"></div></div>';
    repOverdueFill();
  }
  function repOverdueData(){
    var t=todayISO(); var od=[], week=[];
    loans.forEach(function(l){
      var st=autoStatus(l); var out=Number(l.outstanding)||0;
      if(st==='Overdue'){ var dpd=l.due?repDaysBetween(l.due,t):0; od.push({name:l.name,acno:l.acno,phone:l.phone||'',out:(Number(l.arrears)||0),due:l.due||'',dpd:dpd}); }
      else if(st==='Active' && l.due){ var dd=repDaysBetween(t,l.due); if(dd>=0&&dd<=7) week.push({name:l.name,acno:l.acno,phone:l.phone||'',out:out,due:l.due,inDays:dd,emi:Math.round(Number(l.emi)||0)}); }
    });
    od.sort((a,b)=>b.dpd-a.dpd); week.sort((a,b)=>a.inDays-b.inDays);
    return {od:od, week:week, t:t};
  }
  function repBuckets(od){
    var b=[{k:'1\u201330 days',lo:1,hi:30,c:0,s:0},{k:'31\u201360 days',lo:31,hi:60,c:0,s:0},{k:'61\u201390 days',lo:61,hi:90,c:0,s:0},{k:'90+ days',lo:91,hi:1e9,c:0,s:0}];
    od.forEach(function(r){ var d=r.dpd; b.forEach(function(x){ if(d>=x.lo&&d<=x.hi){ x.c++; x.s+=r.out; } }); });
    return b;
  }
  function repOverdueFill(){
    var D=repOverdueData(); var host=$('ovBody');
    var totOut=D.od.reduce((a,r)=>a+r.out,0);
    var weekAmt=D.week.reduce((a,r)=>a+(r.emi||0),0);
    var tiles='<div class="pay-tiles" style="margin-bottom:16px;">'
      +repTile('Overdue accounts',String(D.od.length),'warn')
      +repTile('Overdue outstanding',inr(totOut),'warn')
      +repTile('Due in next 7 days',String(D.week.length))
      +repTile('Amount due (7 days)',inr(weekAmt))+'</div>';
    var bk=repBuckets(D.od);
    var aging='<div class="table-wrap" style="margin-bottom:18px;"><table class="data"><thead><tr><th>Aging bucket</th>'
      +'<th class="right">Accounts</th><th class="right">Outstanding</th></tr></thead><tbody>'
      + bk.map(x=>'<tr><td>'+x.k+'</td><td class="right">'+x.c+'</td><td class="right">'+inr(x.s)+'</td></tr>').join('')
      + '<tr class="tot"><td class="right"><b>Total</b></td><td class="right"><b>'+D.od.length+'</b></td><td class="right"><b>'+inr(totOut)+'</b></td></tr>'
      + '</tbody></table></div>';
    var odBody = D.od.length? D.od.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.acno)+'</td><td>'+esc(r.phone)+'</td><td class="right">'+inr(r.out)+'</td><td>'+(r.due?fmtDate(r.due):'&mdash;')+'</td><td class="right" style="color:var(--bad);font-weight:600;">'+r.dpd+'</td></tr>').join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--grey);padding:20px;">No overdue accounts.</td></tr>';
    var odTable='<h3 style="margin:6px 0 10px;">Overdue accounts</h3><div class="table-wrap" style="margin-bottom:18px;"><table class="data"><thead><tr>'
      +'<th>Borrower</th><th>A/C No.</th><th>Phone</th><th class="right">Outstanding</th><th>Due Date</th><th class="right">Days Past Due</th></tr></thead><tbody>'+odBody+'</tbody></table></div>';
    var wkBody = D.week.length? D.week.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.acno)+'</td><td>'+esc(r.phone)+'</td><td class="right">'+inr(r.emi)+'</td><td>'+fmtDate(r.due)+'</td><td class="right">'+(r.inDays===0?'today':('in '+r.inDays+'d'))+'</td></tr>').join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--grey);padding:20px;">Nothing due in the next 7 days.</td></tr>';
    var wkTable='<h3 style="margin:6px 0 10px;">Due in next 7 days</h3><div class="table-wrap"><table class="data"><thead><tr>'
      +'<th>Borrower</th><th>A/C No.</th><th>Phone</th><th class="right">EMI</th><th>Due Date</th><th class="right">When</th></tr></thead><tbody>'+wkBody+'</tbody></table></div>';
    host.innerHTML = tiles + '<h3 style="margin:6px 0 10px;">Aging summary</h3>' + aging + odTable + wkTable;
  }
  function repOverdueCSV(){
    var D=repOverdueData();
    var data=D.od.map(r=>[r.name,r.acno,r.phone,r.out,fmtDate(r.due),r.dpd]);
    repCSV('Overdue_Accounts_'+todayISO()+'.csv', ['Borrower','A/C No','Phone','Outstanding','Due Date','Days Past Due'], data);
  }
  function repOverduePrint(){
    var D=repOverdueData(); var totOut=D.od.reduce((a,r)=>a+r.out,0); var bk=repBuckets(D.od);
    var weekAmt=D.week.reduce((a,r)=>a+(r.emi||0),0);
    var aging='<table style="margin-bottom:10px;"><thead><tr><th>Aging bucket</th><th class="r">Accounts</th><th class="r">Outstanding</th></tr></thead><tbody>'
      + bk.map(x=>'<tr><td>'+x.k+'</td><td class="r">'+x.c+'</td><td class="r">'+inr(x.s)+'</td></tr>').join('')
      + '<tr class="tot"><td class="r">Total</td><td class="r">'+D.od.length+'</td><td class="r">'+inr(totOut)+'</td></tr></tbody></table>';
    var odTable='<table><thead><tr><th>Borrower</th><th>A/C No.</th><th>Phone</th><th class="r">Outstanding</th><th>Due Date</th><th class="r">DPD</th></tr></thead><tbody>'
      + (D.od.length? D.od.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.acno)+'</td><td>'+esc(r.phone)+'</td><td class="r">'+inr(r.out)+'</td><td>'+(r.due?fmtDate(r.due):'-')+'</td><td class="r">'+r.dpd+'</td></tr>').join('')
          : '<tr><td colspan="6" style="text-align:center;">No overdue accounts.</td></tr>')
      + '</tbody></table>';
    printReport('Overdue Tracking Report','As on '+fmtDate(D.t),
      [['Overdue accounts',String(D.od.length)],['Overdue outstanding',inr(totOut)],['Due in 7 days',String(D.week.length)],['Amount due (7d)',inr(weekAmt)]],
      aging + odTable);
  }

  /* ================= AUTO REMINDERS ENGINE ================= */
  var AUTOREM_STORE='shivam_autorem_cfg_v1', AUTOQ_STORE='shivam_autoqueue_v1', AUTOSEEN_STORE='shivam_autorem_seen_v1';
  function autoRemDefaults(){ return {enabled:true, emi:true, overdue:true, payment:true, approval:true, birthday:true, emiDays:[7,3,1], overdueDays:[1,7,15,30], approvalDays:3, lastScan:0}; }
  function autoRemCfg(){ try{ var c=JSON.parse(localStorage.getItem(AUTOREM_STORE)||'null'); if(c) return Object.assign(autoRemDefaults(),c); }catch(e){} return autoRemDefaults(); }
  function autoRemSaveCfg(c){ try{ localStorage.setItem(AUTOREM_STORE, JSON.stringify(c)); }catch(e){} }
  function autoQueueLoad(){ try{ var a=JSON.parse(localStorage.getItem(AUTOQ_STORE)||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
  function autoQueueSave(q){ try{ localStorage.setItem(AUTOQ_STORE, JSON.stringify(q)); }catch(e){} }
  function autoSeenLoad(){ try{ var a=JSON.parse(localStorage.getItem(AUTOSEEN_STORE)||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
  function autoSeenSave(a){ try{ localStorage.setItem(AUTOSEEN_STORE, JSON.stringify(a)); }catch(e){} }
  function autoSeenHas(k){ return autoSeenLoad().some(function(x){ return x.key===k; }); }
  function autoSeenAdd(k){ var a=autoSeenLoad(); var cut=Date.now()-60*86400000; a=a.filter(function(x){ return (x.at||0)>=cut; }); a.push({key:k,at:Date.now()}); autoSeenSave(a); }

  function autoQueueAdd(item){
    if(autoSeenHas(item.key)) return false;
    var q=autoQueueLoad();
    if(q.some(function(x){ return x.key===item.key; })) return false;
    q.push(item); autoQueueSave(q); autoSeenAdd(item.key); return true;
  }
  function autoQueuePrune(){
    var q=autoQueueLoad(); if(!q.length) return;
    var hist=(typeof loadWaHist==='function')?loadWaHist():[];
    var before=q.length;
    q=q.filter(function(it){ return !hist.some(function(h){ return h && h.category===it.cat && intlPhone(h.phone||'')===intlPhone(it.phone||'') && (h.at||0)>=((it.createdAt||0)-1000); }); });
    if(q.length!==before) autoQueueSave(q);
  }

  function autoMkItem(l, cat, reason, key){
    var av=function(tok){ return applyVars('{'+tok+'}', l, {}); };
    var vars, msg;
    if(cat==='EMI Reminder'){ vars={name:l.name, emi:av('emi'), due_date:av('due_date'), acno:l.acno||'', outstanding:av('outstanding'), fine:av('fine'), rate:av('rate'), amount:av('emi'), loanid:l.acno||''}; msg=applyVars(TPL.reminder,l,{}); }
    else if(cat==='Overdue Reminder'){ vars={name:l.name, outstanding:av('outstanding'), due_date:av('due_date'), fine:av('fine'), acno:l.acno||'', emi:av('emi'), amount:av('outstanding'), loanid:l.acno||''}; msg=applyVars(TPL.overdue,l,{}); }
    else if(cat==='Payment Confirmation'){ vars={name:l.name, amount:'', txn:'', acno:l.acno||'', outstanding:av('outstanding')}; msg=applyVars(TPL.thanks,l,{}); }
    else if(cat==='Loan Approval'){ vars={name:l.name, amount:inr(l.principal), loanid:l.acno||'', acno:l.acno||'', emi:av('emi')}; msg=applyVars(TPL.welcome,l,{}); }
    else if(cat==='Birthday Greeting'){ vars={name:l.name}; msg=applyVars(TPL.greeting,l,{occasion:'Birthday'}); }
    else { vars={name:l.name}; msg=applyVars(TPL.greeting,l,{}); }
    return {id:'aq'+Date.now().toString(36)+Math.random().toString(36).slice(2,7), key:key, name:l.name, phone:l.phone||'', acno:l.acno||'', cat:cat, vars:vars, msg:msg, reason:reason, createdAt:Date.now()};
  }

  function autoRemScan(){
    var c=autoRemCfg(); if(!c.enabled) return {added:0};
    var t=todayISO(); var added=0;
    var emiDays=c.emiDays||[7,3,1], odDays=c.overdueDays||[1,7,15,30];
    (loans||[]).forEach(function(l){
      if(!l) return; var st=autoStatus(l);
      if(c.emi && st==='Active' && l.due){
        var dleft=repDaysBetween(t,l.due);
        if(emiDays.indexOf(dleft)>=0 && autoQueueAdd(autoMkItem(l,'EMI Reminder','EMI due in '+dleft+' day'+(dleft===1?'':'s'),'emi:'+l.id+':'+l.due+':'+dleft))) added++;
      }
      if(c.overdue && st==='Overdue' && l.due){
        var dpd=repDaysBetween(l.due,t);
        if(odDays.indexOf(dpd)>=0 && autoQueueAdd(autoMkItem(l,'Overdue Reminder','Overdue by '+dpd+' day'+(dpd===1?'':'s'),'od:'+l.id+':'+l.due+':'+dpd))) added++;
      }
      if(c.payment && Array.isArray(l.payments)){
        l.payments.forEach(function(p,idx){
          if(p && p.status!=='Pending' && p.date===t){
            var it=autoMkItem(l,'Payment Confirmation','Payment received '+inr(p.amount),'pay:'+l.id+':'+p.date+':'+idx+':'+(Number(p.amount)||0));
            it.vars.amount=inr(p.amount); it.vars.txn=(p.ref||p.cheque||fmtDate(p.date)||'');
            if(autoQueueAdd(it)) added++;
          }
        });
      }
      if(c.approval){
        var fresh=false;
        if(l.disb){ var dd=repDaysBetween(l.disb,t); if(dd>=0 && dd<=(c.approvalDays||3)) fresh=true; }
        else if(l.createdAt){ var cd=new Date(l.createdAt); if(!isNaN(cd.getTime())){ var diff=Math.round((Date.now()-cd.getTime())/86400000); if(diff>=0 && diff<=(c.approvalDays||3)) fresh=true; } }
        if(fresh && autoQueueAdd(autoMkItem(l,'Loan Approval','Loan sanctioned','appr:'+l.id))) added++;
      }
      if(c.birthday && l.dob && st!=='Closed'){
        var md=(l.dob||'').slice(5);
        if(md && md===t.slice(5) && autoQueueAdd(autoMkItem(l,'Birthday Greeting','Birthday today','bday:'+l.id+':'+t.slice(0,4)))) added++;
      }
    });
    var cfg=autoRemCfg(); cfg.lastScan=Date.now(); autoRemSaveCfg(cfg);
    return {added:added};
  }
  function autoRemBoot(){ if(autoRemCfg().enabled){ try{ autoRemScan(); }catch(e){} } }

