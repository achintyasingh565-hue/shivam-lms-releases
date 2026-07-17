/* ===== Document download (custom filename) + WhatsApp ===== */
  function _docClean(x){ return String(x||'').trim().replace(/[^\w\u00C0-\u017F -]/g,'').replace(/\s+/g,'_'); }
  function _docFileName(name, acc, type){ var p=[_docClean(name),_docClean(acc),_docClean(type)].filter(Boolean); return (p.join('_')||'Document'); }
  function _printAs(name, acc, type, printFn){ var old=document.title; document.title=_docFileName(name,acc,type); try{ printFn(); }catch(e){} setTimeout(function(){ document.title=old; }, 2000); }
  function _waDoc(phone, name, acc, typeLabel){ var p=String(phone||'').replace(/\D/g,''); if(p.length===10) p='91'+p; else if(p.length===11&&p[0]==='0') p='91'+p.slice(1); if(!p){ toast('No phone number for this customer - open the loan to add one'); return; } var msg='Namaste '+(name||'')+', please find your '+(typeLabel||'document')+(acc?(' for account '+acc):'')+' attached.\n\n- Shivam Enterprises'; window.open('https://wa.me/'+p+'?text='+encodeURIComponent(msg), '_blank'); toast('WhatsApp opened - attach the saved PDF and send'); }
  function _certLoan(){ return loans.find(function(x){return x.id===(($('loadLoan')||{}).value);}); }
  function _propLoan(){ return loans.find(function(x){return x.id===(($('loadProp')||{}).value);}); }
  function dlHP(){ var l=(typeof lastDocLoan!=='undefined'&&lastDocLoan)?lastDocLoan:null; _printAs(l?l.name:'', l?l.acno:'', 'Loan_Documents', printHPAll); }
  function waHP(){ var l=(typeof lastDocLoan!=='undefined'&&lastDocLoan)?lastDocLoan:null; _waDoc(l?l.phone:'', l?l.name:'', l?l.acno:'', 'Loan Documents'); }
  window.dlHP=dlHP; window.waHP=waHP;
  /* ===== Repayment Schedule (paid + projected, combined) ===== */
(function(){
  var L=null;
  /* Month arithmetic MUST clamp to month-end (Jan 31 + 1 month = Feb 28, not Mar 3).
     This previously used raw Date rollover, so the printed schedule disagreed with the
     EMI table (which uses repAddMonths) for any loan disbursed on the 29th–31st. */
  function addMonths(iso, n){ var s=repAddMonths(iso||todayISO(), n); var p=s.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
  function fmt(d){ return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
  function rupee(n){ return '₹'+(Math.round(n)).toLocaleString('en-IN'); }
  var SCHED_MAX_ROWS=600; /* 50 years — hard cap so a tiny EMI on a big balance can't generate a million rows */
  function build(l){
    var emi=Number(l.emi)||0, tpay=Number(l.tpay)||0;
    // Processing/deductions don't reduce what's owed. After a restructure, the schedule runs forward
    // from the new baseline (baseOut over the remaining months) instead of re-deriving from old payments.
    var totalPayable=(l.baseOut!=null)?Math.max(0,Number(l.baseOut)):Math.max(0, tpay);
    var months = emi>0 ? Math.max(1, Math.ceil(totalPayable/emi)) : (Number(l.tenure)||0);
    // Interest-only loans (tenure 0, no amortising EMI): show one balloon row for the full
    // balance rather than silently rendering an empty schedule.
    if(months<=0 && totalPayable>0) months=1;
    var capped=false;
    if(months>SCHED_MAX_ROWS){ months=SCHED_MAX_ROWS; capped=true; }
    var start = l.baseDate || l.disb || l.due || todayISO();
    /* pool of actual payments (date-sorted) to allocate against installments; after restructure only
       payments made AFTER the baseline date count toward the forward schedule */
    var baseD=l.baseDate||'';
    var pays=(l.payments||[]).slice().filter(function(p){return Number(p.amount)>0 && (!baseD || (p.date||'')>baseD);}).sort(function(a,b){return (a.date||'').localeCompare(b.date||'');});
    var pool=pays.map(function(p){return {amt:Number(p.amount)||0, date:p.date};});
    var pi=0, carry=0, rows=[], bal=totalPayable, paidCount=0, paidSum=0;
    for(var i=1;i<=months;i++){
      var due = (i===1 && l.disb) ? addMonths(start, 1) : addMonths(start, i);
      var thisEmi = (i===months) ? Math.max(0, totalPayable - emi*(months-1)) : emi;
      if(thisEmi<=0) thisEmi=emi;
      /* try to cover thisEmi from the payment pool */
      var need=thisEmi, covered=0, payDate='';
      while(need>0.5 && (pi<pool.length || carry>0.5)){
        if(carry<=0.5){ carry=pool[pi].amt; payDate=pool[pi].date; pi++; }
        var take=Math.min(carry, need); carry-=take; need-=take; covered+=take;
        if(!payDate && pi>0) payDate=pool[pi-1].date;
      }
      var status, cls;
      if(covered>=thisEmi-0.5){ status='✓ Paid'; cls='pd'; paidCount++; paidSum+=thisEmi; }
      else if(covered>0){ status='Part ('+rupee(covered)+')'; cls='pt'; paidSum+=covered; }
      else { status='Due'; cls='dueb'; }
      bal=Math.max(0, bal-thisEmi);
      rows.push({i:i, due:fmt(due), emi:thisEmi, bal:bal, status:status, cls:cls, payDate:payDate&&cls==='pd'?fmt(new Date(payDate)):''});
    }
    var remaining=Math.max(0, totalPayable - paidSum);
    return {l:l, rows:rows, months:months, emi:emi, totalPayable:totalPayable, paidSum:paidSum, remaining:remaining, paidCount:paidCount, capped:capped};
  }
  function tableHTML(d, forPrint){
    var r=d.rows.map(function(x){
      var color = x.cls==='pd'?'#0b7a4b':(x.cls==='pt'?'#b26a00':'#444');
      return '<tr><td>'+x.i+'</td><td>'+x.due+'</td><td style="text-align:right;">'+rupee(x.emi)+'</td><td style="text-align:right;">'+rupee(x.bal)+'</td><td style="color:'+color+';font-weight:600;">'+x.status+(x.payDate?' · '+x.payDate:'')+'</td></tr>';
    }).join('');
    return '<table class="sched"><thead><tr><th>#</th><th>Due date</th><th>EMI</th><th>Balance</th><th>Status</th></tr></thead><tbody>'+r+'</tbody></table>';
  }
  function summaryHTML(d){
    return '<div class="rs-row"><span>Total payable</span><span>'+rupee(d.totalPayable)+'</span></div>'+
           '<div class="rs-row"><span>Paid so far</span><span style="color:#0b7a4b;font-weight:700;">'+rupee(d.paidSum)+' ('+d.paidCount+' EMIs)</span></div>'+
           '<div class="rs-row"><span>Remaining</span><span style="font-weight:700;">'+rupee(d.remaining)+'</span></div>'+
           '<div class="rs-row"><span>EMI</span><span>'+rupee(d.emi)+' × '+d.months+' months</span></div>';
  }
  window.openSchedule=function(id){
    L=loans.find(function(x){return x.id===id;}); if(!L){ toast('Loan not found'); return; }
    var d=build(L); window._schedData=d;
    $('schedBody').innerHTML='<div style="background:var(--field,#f2f5fa);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:13px;"><b>'+esc(L.name||'')+'</b> &nbsp;·&nbsp; '+esc(L.acno||'')+summaryHTML(d)+'</div>'+
      '<style>table.sched{width:100%;border-collapse:collapse;font-size:12.5px;}table.sched th,table.sched td{border:1px solid var(--line);padding:5px 8px;}table.sched th{background:var(--navy,#0b1f4b);color:#fff;text-align:left;}</style>'+tableHTML(d);
    $('schedOverlay').classList.add('show');
  };
  window.closeSchedule=function(){ $('schedOverlay').classList.remove('show'); };
  function docHTML(d){
    var l=d.l;
    var rows=d.rows.map(function(x){ var c=x.cls==='pd'?'#0b7a4b':(x.cls==='pt'?'#b26a00':'#333'); return '<tr><td>'+x.i+'</td><td>'+x.due+'</td><td style="text-align:right;">₹'+Math.round(x.emi).toLocaleString('en-IN')+'</td><td style="text-align:right;">₹'+Math.round(x.bal).toLocaleString('en-IN')+'</td><td style="color:'+c+';">'+x.status+(x.payDate?' · '+x.payDate:'')+'</td></tr>'; }).join('');
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+_docFileName(l.name,l.acno,'Repayment_Schedule')+'</title><style>'+
      'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141414;margin:32px;line-height:1.6;}'+
      '.name{font-size:24px;font-weight:bold;letter-spacing:1px;text-align:center;color:#0b1f4b;}'+
      '.addr{text-align:center;font-size:11px;color:#444;margin:4px 0 2px;}.rule{border-bottom:2px solid #c8a02a;margin:8px 0 18px;}'+
      'h2{text-align:center;font-size:16px;margin:14px 0;text-decoration:underline;letter-spacing:.5px;}.meta{font-size:12.5px;margin:6px 0;}.meta b{color:#0b1f4b;}'+
      'table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;}th,td{border:1px solid #bbb;padding:6px 10px;}th{background:#0b1f4b;color:#fff;text-align:left;}'+
      '.sumbox{border:1px solid #c8a02a;border-radius:6px;padding:8px 12px;margin:10px 0;font-size:12px;background:#fffdf5;}'+
      '.foot{margin-top:22px;font-size:11px;color:#555;font-style:italic;text-align:center;border-top:1px solid #c8a02a;padding-top:6px;}'+
      '</style></head><body>'+
      '<div class="name">'+esc(FIRM().name)+'</div><div class="addr">'+esc(firmAddrLine())+'<br>'+esc(firmRegLine())+'</div><div class="rule"></div>'+
      '<h2>Loan Repayment Schedule</h2>'+
      '<div class="meta"><b>Borrower:</b> '+(l.name||'')+'</div><div class="meta"><b>Loan A/c:</b> '+(l.acno||'')+'</div><div class="meta"><b>As on:</b> '+new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})+'</div>'+
      '<div class="sumbox"><b>Total payable:</b> ₹'+Math.round(d.totalPayable).toLocaleString('en-IN')+' &nbsp;|&nbsp; <b>Paid:</b> ₹'+Math.round(d.paidSum).toLocaleString('en-IN')+' ('+d.paidCount+' EMIs) &nbsp;|&nbsp; <b>Remaining:</b> ₹'+Math.round(d.remaining).toLocaleString('en-IN')+' &nbsp;|&nbsp; <b>EMI:</b> ₹'+Math.round(d.emi).toLocaleString('en-IN')+'</div>'+
      '<table><thead><tr><th>#</th><th>Due date</th><th>EMI</th><th>Balance</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="foot">This is a computer-generated repayment schedule. For Shivam Enterprises.</div></body></html>';
  }
  window.printScheduleDoc=function(){ var d=window._schedData; if(!d) return; var html=docHTML(d);
    var f=document.createElement('iframe'); f.style.position='fixed'; f.style.right='0'; f.style.bottom='0'; f.style.width='0'; f.style.height='0'; f.style.border='0'; document.body.appendChild(f);
    var doc=f.contentWindow.document; doc.open(); doc.write(html); doc.close();
    setTimeout(function(){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} setTimeout(function(){ f.remove(); },1500); },350);
  };

  /* ===== Default / Demand Notices ===== */
  function _dnIso(){ return todayISO(); } /* local time, not UTC — keeps notice dates consistent with the rest of the app */
  function _dnDays(dueISO, tISO){ if(!dueISO) return 0; var a=new Date(tISO), b=new Date(dueISO); return Math.floor((a-b)/86400000); }
  function _dnAddDays(iso,n){ var d=new Date(iso); d.setDate(d.getDate()+(Number(n)||0)); return d.toISOString().slice(0,10); }
  function _dnShort(iso){ if(!iso) return '—'; var p=String(iso).split('-'); return p.length===3?(p[2]+'-'+p[1]+'-'+p[0].slice(2)):iso; }
  function _dnLong(iso){ if(!iso) return '—'; try{ return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}); }catch(e){ return _dnShort(iso); } }
  function _dnOut(l){ return Math.max(0, (Number(l.tpay)||0)-(Number(l.paid)||0)); }
  function _dnIsDefault(l){ return l && l.status!=='Closed' && (l.status==='Overdue' || (Number(l.arrears)||0)>0); }
  window._dnLang = window._dnLang || 'en';
  function _dnTitle(type){
    if(window._dnLang==='hi') return type==='reminder'?'भुगतान स्मरण पत्र':(type==='final'?'अंतिम मांग सूचना':'मांग सूचना');
    return type==='reminder'?'PAYMENT REMINDER':(type==='final'?'FINAL DEMAND NOTICE':'NOTICE OF DEMAND');
  }
  function _dnRef(l, iso){ var y=String(iso).replace(/-/g,'').slice(2); return 'SE/DN/'+((l.acno||'').replace(/\s+/g,'')||'ACC')+'/'+y; }

  function _dnConsequence(type){
    if(window._dnLang==='hi'){
      if(type==='reminder') return 'आपसे अनुरोध है कि न्यायिक कार्यवाही से बचने हेतु अतिदेय राशि का शीघ्र भुगतान करें। यदि भुगतान पहले ही किया जा चुका है, तो कृपया इस स्मरण पत्र को निरस्त समझें।';
      if(type==='final') return 'कृपया इसे अंतिम सूचना समझें। यदि उपर्युक्त अवधि के भीतर बकाया राशि का भुगतान नहीं होता है, तो शिवम एंटरप्राइजेज को न्यायिक कार्यवाही आरंभ करने तथा विधि के अंतर्गत उपलब्ध अन्य उपायों का सहारा लेने के लिए विवश होना पड़ेगा, जिसकी समस्त लागत एवं परिणामों का उत्तरदायित्व आपका होगा।';
      return 'यदि उपर्युक्त अवधि के भीतर बकाया राशि का भुगतान नहीं किया जाता है, तो हमें विधि अनुसार देय राशि की वसूली हेतु न्यायिक कार्यवाही आरंभ करने के लिए विवश होना पड़ेगा।';
    }
    if(type==='reminder') return 'We request you to kindly clear the overdue amount at the earliest to avoid judicial proceedings. If the payment has already been made, please treat this reminder as cancelled.';
    if(type==='final') return 'Please treat this as a FINAL notice. Should the outstanding dues remain unpaid within the period stated above, Shivam Enterprises shall be constrained to initiate judicial proceedings and pursue such other remedies as are available under law, entirely at your risk as to costs and consequences.';
    return 'In the event the outstanding dues are not cleared within the period stated above, we shall be constrained to initiate judicial proceedings for recovery of the amount due, as per applicable law.';
  }

  function _dnBody(d){
    var l=d.l, hi=(window._dnLang==='hi');
    var ref=_dnRef(l, d.today);
    var deadline=_dnLong(_dnAddDays(d.today, d.days));
    var L=hi?{principal:'मूलधन वितरित',out:'कुल बकाया राशि',arr:'अतिदेय (बकाया) राशि',missed:'अंतिम चूकी हुई देय तिथि',dpd:'अतिदेय दिवस',days:' दिन',to:'सेवा में,',mob:'मोबाइल: ',refL:'संदर्भ:',dateL:'दिनांक:',sub:'विषय: ',acct:' — ऋण खाता ',dear:'महोदय/महोदया,',forSig:'शिवम एंटरप्राइजेज की ओर से',signer:'अधिकृत हस्ताक्षरकर्ता'}
             :{principal:'Principal disbursed',out:'Total outstanding',arr:'Overdue (arrears) amount',missed:'Due date last missed',dpd:'Days overdue',days:' day(s)',to:'To,',mob:'Mobile: ',refL:'Ref:',dateL:'Date:',sub:'Subject: ',acct:' — Loan Account ',dear:'Dear '+esc(l.name||'Sir/Madam')+',',forSig:'For <b>Shivam Enterprises</b>',signer:'Authorised Signatory'};
    var rows=''
      +'<tr><td>'+L.principal+'</td><td style="text-align:right;">'+rupee(Number(l.principal)||0)+'</td></tr>'
      +'<tr><td>'+L.out+'</td><td style="text-align:right;">'+rupee(d.out)+'</td></tr>'
      +'<tr><td><b>'+L.arr+'</b></td><td style="text-align:right;"><b>'+rupee(d.arrears)+'</b></td></tr>'
      +'<tr><td>'+L.missed+'</td><td style="text-align:right;">'+(l.due?_dnLong(l.due):'—')+'</td></tr>'
      +'<tr><td>'+L.dpd+'</td><td style="text-align:right;">'+(d.dpd>0?d.dpd:0)+L.days+'</td></tr>';
    var toBlock='<div class="dn-meta"><b>'+L.to+'</b><br>'+esc(l.name||'')+(l.addr?('<br>'+esc(String(l.addr)).replace(/\n/g,'<br>')):'')+(l.phone?('<br>'+L.mob+esc(l.phone)):'')+'</div>';
    var p1, p2, p4;
    if(hi){
      p1='<p>आपको औपचारिक रूप से सूचित किया जाता है कि शिवम एंटरप्राइजेज से आपके द्वारा लिया गया ऋण खाता संख्या <b>'+esc(l.acno||'')+'</b> अतिदेय हो गया है। हमारे अभिलेखों के अनुसार, दिनांक '+_dnLong(d.today)+' तक उक्त खाते में निम्नलिखित राशियाँ देय हैं:</p>';
      p2='<p>आपसे अपेक्षा की जाती है कि इस सूचना की तिथि से <b>'+d.days+' दिन</b> के भीतर, अर्थात <b>'+deadline+'</b> तक, अतिदेय राशि <b>'+rupee(d.arrears)+'</b> का भुगतान कर उक्त खाते को नियमित करें।</p>';
      p4='<p>बकाया राशि के निपटान अथवा उपयुक्त पुनर्भुगतान व्यवस्था पर विचार-विमर्श हेतु कृपया शीघ्र हमारे कार्यालय से संपर्क करें।</p>';
    } else {
      p1='<p>This is to formally notify you that the loan account bearing number <b>'+esc(l.acno||'')+'</b>, availed by you from Shivam Enterprises, has fallen overdue. As per our records, the following amounts stand due against the said account as on '+_dnLong(d.today)+':</p>';
      p2='<p>You are hereby called upon to pay the overdue amount of <b>'+rupee(d.arrears)+'</b> and to regularise the said account within <b>'+d.days+' day(s)</b> from the date of this notice, i.e. on or before <b>'+deadline+'</b>.</p>';
      p4='<p>You are advised to contact our office at the earliest to settle the dues or to discuss a suitable repayment arrangement.</p>';
    }
    return ''
      +'<div class="dn-refrow"><span><b>'+L.refL+'</b> '+esc(ref)+'</span><span><b>'+L.dateL+'</b> '+_dnLong(d.today)+'</span></div>'
      +toBlock
      +'<div class="dn-sub"><b>'+L.sub+_dnTitle(d.type)+L.acct+esc(l.acno||'')+'</b></div>'
      +'<p>'+L.dear+'</p>'
      +p1
      +'<table class="dn-tbl"><tbody>'+rows+'</tbody></table>'
      +p2
      +'<p>'+_dnConsequence(d.type)+'</p>'
      +p4
      +'<div class="dn-sign">'+L.forSig+_dnSig()+'<br>'+L.signer+'</div>';
  }
  function _dnSig(){
    try{ var im=document.querySelector('#sec-cert .sigcol img'); var src=im&&im.getAttribute('src');
      if(src) return '<br><img src="'+src+'" alt="signature" style="max-height:50px;max-width:150px;display:block;margin:6px 0 2px;">';
    }catch(e){}
    return '<br><br><br>';
  }
  function _dnRenameClasses(html){
    return String(html).replace(/dn-refrow/g,'refrow').replace(/dn-meta/g,'meta').replace(/dn-sub/g,'sub').replace(/dn-tbl/g,'det').replace(/dn-sign/g,'sign');
  }

  function _dnPreview(d){
    return '<style>'
      +'#defBody{color:#1a1a1a;}'
      +'#defBody .dn-hint{font-size:11.5px;color:#7a5b12;background:#fff8e6;border:1px solid #f0dfb0;border-radius:8px;padding:7px 10px;margin-bottom:10px;}'
      +'#defBody .dn-paper{background:#fff;color:#1a1a1a;border:1px solid #e2e6ee;border-radius:8px;padding:22px 24px;box-shadow:0 2px 10px rgba(15,23,42,.08);}'
      +'#defBody .dn-wrap{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.6;font-size:13.5px;outline:none;}'
      +'#defBody .dn-wrap:focus{outline:none;}'
      +'#defBody .dn-refrow{display:flex;justify-content:space-between;font-size:12.5px;margin:2px 0 12px;}'
      +'#defBody .dn-meta{margin:6px 0 12px;font-size:13px;}'
      +'#defBody .dn-sub{margin:10px 0 12px;font-size:13.5px;}'
      +'#defBody .dn-tbl{width:100%;border-collapse:collapse;margin:10px 0;font-size:12.5px;}'
      +'#defBody .dn-tbl td{border:1px solid #d9dee7;padding:5px 9px;color:#1a1a1a;}'
      +'#defBody .dn-sign{margin-top:22px;font-size:13px;}'
      +'#defBody p{margin:9px 0;color:#1a1a1a;}'
      +'</style>'
      +'<div class="dn-hint">✎ You can edit any text or figure below (amounts, dates, days) before printing or sending. Changes here apply to the PDF and print — they do not change the loan record.</div>'
      +'<div class="dn-paper"><div class="dn-wrap" id="dnEditable" contenteditable="true" spellcheck="false">'+_dnBody(d)+'</div></div>';
  }

  function defaultDocHTML(d, bodyHTML){
    var l=d.l;
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+_docFileName(l.name,l.acno,'Default_Notice')+'</title><style>'
      +'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141414;margin:32px;line-height:1.6;}'
      +'.name{font-size:24px;font-weight:bold;letter-spacing:1px;text-align:center;color:#0b1f4b;}'
      +'.addr{text-align:center;font-size:11px;color:#444;margin:4px 0 2px;}.rule{border-bottom:2px solid #c8a02a;margin:8px 0 18px;}'
      +'h2{text-align:center;font-size:16px;margin:14px 0;text-decoration:underline;letter-spacing:.5px;}'
      +'.refrow{display:flex;justify-content:space-between;font-size:12px;margin:2px 0 14px;}'
      +'.meta{font-size:12.5px;margin:6px 0 14px;}.sub{font-size:13px;margin:10px 0 12px;}'
      +'p{font-size:13px;margin:9px 0;text-align:justify;}'
      +'table.det{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;}table.det td{border:1px solid #bbb;padding:6px 10px;}'
      +'.sign{margin-top:34px;font-size:13px;}'
      +'.foot{margin-top:26px;font-size:11px;color:#555;font-style:italic;text-align:center;border-top:1px solid #c8a02a;padding-top:6px;}'
      +'</style></head><body>'
      +'<div class="name">'+esc(FIRM().name)+'</div><div class="addr">'+esc(firmAddrLine())+'<br>'+esc(firmRegLine())+'</div><div class="rule"></div>'
      +'<h2>'+_dnTitle(d.type)+'</h2>'
      +_dnRenameClasses(bodyHTML!=null?bodyHTML:_dnBody(d))
      +'<div class="foot">'+(window._dnLang==='hi'?'यह शिवम एंटरप्राइजेज द्वारा जारी कंप्यूटर-जनित सूचना है।':'This is a computer-generated notice issued by Shivam Enterprises.')+'</div>'
      +'</body></html>';
  }

  window.renderDefaults=function(){
    var tb=$('defBodyRows'); if(!tb) return;
    var t=_dnIso();
    var rows=(loans||[]).filter(_dnIsDefault);
    rows.sort(function(a,b){ return _dnDays(b.due,t)-_dnDays(a.due,t); });
    if(!rows.length){ tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--grey);padding:24px;">No overdue accounts — there is nothing to notice right now.</td></tr>'; return; }
    tb.innerHTML=rows.map(function(l){
      var dpd=l.due?_dnDays(l.due,t):0, out=_dnOut(l), arr=Number(l.arrears)||0;
      return '<tr>'
        +'<td>'+esc(l.name||'')+'</td>'
        +'<td>'+esc(l.acno||'')+'</td>'
        +'<td>'+esc(l.phone||'—')+'</td>'
        +'<td class="right">'+rupee(out)+'</td>'
        +'<td class="right" style="color:var(--bad);font-weight:600;">'+rupee(arr)+'</td>'
        +'<td>'+(l.due?_dnShort(l.due):'—')+'</td>'
        +'<td class="right" style="color:var(--bad);font-weight:600;">'+(dpd>0?dpd:0)+'</td>'
        +'<td class="right"><button class="btn btn-sm btn-notice" onclick="openDefaultNotice(\''+l.id+'\')">Prepare Notice</button></td>'
        +'</tr>';
    }).join('');
  };

  window.openDefaultNotice=function(id){
    var l=(loans||[]).find(function(x){return x.id===id;}); if(!l){ toast('Loan not found'); return; }
    var typeEl=$('defType'), daysEl=$('defDays');
    var type=typeEl?typeEl.value:'demand';
    var days=Math.max(1, parseInt(daysEl&&daysEl.value,10)||7);
    var t=_dnIso();
    var d={ l:l, type:type, days:days, today:t, dpd:(l.due?_dnDays(l.due,t):0), out:_dnOut(l), arrears:Number(l.arrears)||0 };
    window._defData=d;
    $('defBody').innerHTML=_dnPreview(d);
    $('defOverlay').classList.add('show');
  };
  window.closeDefaultNotice=function(){ $('defOverlay').classList.remove('show'); };
  window.setDnLang=function(v){
    window._dnLang=(v==='hi')?'hi':'en';
    var seg=$('dnLangSeg'); if(seg){ [...seg.children].forEach(function(b){ b.classList.toggle('active', b.dataset.dnl===window._dnLang); }); }
    if(window._defData && $('defOverlay').classList.contains('show')) $('defBody').innerHTML=_dnPreview(window._defData);
  };

  function _dnEditedBody(){ var el=document.getElementById('dnEditable'); return el?el.innerHTML:(window._defData?_dnBody(window._defData):''); }
  window.printDefaultDoc=function(){ var d=window._defData; if(!d) return; var html=defaultDocHTML(d, _dnEditedBody());
    var f=document.createElement('iframe'); f.style.position='fixed'; f.style.right='0'; f.style.bottom='0'; f.style.width='0'; f.style.height='0'; f.style.border='0'; document.body.appendChild(f);
    var doc=f.contentWindow.document; doc.open(); doc.write(html); doc.close();
    setTimeout(function(){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} setTimeout(function(){ f.remove(); },1500); },350);
  };
  window.sendDefaultWA=function(){ var d=window._defData; if(!d) return; var l=d.l;
    var phone=(l.phone||'').replace(/\D/g,''); if(phone.length===10) phone='91'+phone; else if(phone.length===11&&phone[0]==='0') phone='91'+phone.slice(1);
    if(!phone){ toast('No phone number on this loan'); return; }
    var deadline=_dnLong(_dnAddDays(d.today, d.days));
    var head=d.type==='reminder'?'Payment reminder':(d.type==='final'?'FINAL demand notice':'Demand notice');
    var msg=head+' from Shivam Enterprises for loan account '+(l.acno||'')+'.\n\nDear '+(l.name||'')+', your account is overdue.\nOverdue amount: '+rupee(d.arrears)+'\nTotal outstanding: '+rupee(d.out)+'\nDays overdue: '+(d.dpd>0?d.dpd:0)+'\n\nPlease clear the overdue amount on or before '+deadline+'. The formal notice is attached. — Shivam Enterprises';
    window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(msg), '_blank');
    toast('WhatsApp opened — attach the downloaded PDF and send');
  };
})();
