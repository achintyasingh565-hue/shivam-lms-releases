  /* ---------- Reminders & Messages ---------- */
  const MSG_STORE="shivam_msg_v1";
  const DEFAULT_TPL={
    reminder:"Namaste {name}, this is a friendly reminder from Shivam Enterprises. For your loan account {acno}, the EMI of {emi} is due on {due_date}. Kindly pay on time to keep your account in good standing. Thank you. - Shivam Enterprises",
    overdue:"Namaste {name}, this is an important reminder from Shivam Enterprises. The EMI for your loan account {acno} was due on {due_date} and is now overdue. Your outstanding amount is {outstanding} and a late fee of {fine} now applies. Please clear it at the earliest to avoid further charges. Thank you. - Shivam Enterprises",
    greeting:"Namaste {name}, Shivam Enterprises warmly wishes you and your family a very happy {occasion}! Thank you for your continued trust. - Shivam Enterprises",
    holiday:"Namaste {name}, please note our office will remain closed on account of {occasion} on {date}. For urgent matters, please call us. - Shivam Enterprises",
    thanks:"Namaste {name}, we have received your payment of {emi} towards loan account {acno}. Your remaining balance is {outstanding}. Thank you for paying on time. - Shivam Enterprises",
    welcome:"Namaste {name}, your loan (account {acno}) has been sanctioned and disbursed. Your monthly EMI is {emi}. Thank you for choosing Shivam Enterprises.",
    finalnotice:"Namaste {name}, despite earlier reminders, the overdue amount of {outstanding} on loan account {acno} is still unpaid. Please clear it immediately to avoid further action as per your loan agreement. - Shivam Enterprises",
    demandnotice:"Namaste {name}, this is a formal demand notice from Shivam Enterprises in respect of your loan account {acno}, which has fallen overdue. You are hereby called upon to pay the overdue amount of {arrears} and to regularise the said account within 7 days from the date of this message. Your total outstanding balance on this account is {outstanding}. Failing timely payment, Shivam Enterprises shall be constrained to initiate judicial proceedings and pursue such other remedies as are available under law, at your risk as to costs and consequences. Please contact our office to settle the dues. - Shivam Enterprises",
    reminder_hi:"नमस्ते {name}, शिवम एंटरप्राइज़ेस की ओर से एक विनम्र अनुस्मारक। आपके लोन खाता {acno} की {emi} की किस्त {due_date} को देय है। कृपया समय पर भुगतान करें ताकि आपका खाता अच्छी स्थिति में बना रहे। धन्यवाद। - शिवम एंटरप्राइज़ेस",
    overdue_hi:"नमस्ते {name}, शिवम एंटरप्राइज़ेस की ओर से महत्वपूर्ण सूचना। आपके लोन खाता {acno} की किस्त {due_date} को देय थी और अब बकाया है। आपकी शेष राशि {outstanding} है तथा {fine} विलंब शुल्क लागू है। कृपया अतिरिक्त शुल्क से बचने हेतु शीघ्र भुगतान करें। धन्यवाद। - शिवम एंटरप्राइज़ेस",
    greeting_hi:"नमस्ते {name}, शिवम एंटरप्राइज़ेस की ओर से आपको एवं आपके परिवार को {occasion} की हार्दिक शुभकामनाएँ! आपके निरंतर विश्वास हेतु धन्यवाद। - शिवम एंटरप्राइज़ेस",
    holiday_hi:"नमस्ते {name}, कृपया ध्यान दें कि {occasion} के अवसर पर हमारा कार्यालय {date} को बंद रहेगा। किसी आवश्यक कार्य हेतु कृपया संपर्क करें। - शिवम एंटरप्राइज़ेस",
    thanks_hi:"नमस्ते {name}, आपके लोन खाता {acno} में {emi} का भुगतान प्राप्त हुआ है। आपकी शेष राशि {outstanding} है। समय पर भुगतान हेतु धन्यवाद। - शिवम एंटरप्राइज़ेस",
    welcome_hi:"नमस्ते {name}, आपका लोन (खाता {acno}) स्वीकृत एवं वितरित कर दिया गया है। आपकी मासिक किस्त {emi} है। शिवम एंटरप्राइज़ेस को चुनने हेतु धन्यवाद।",
    finalnotice_hi:"नमस्ते {name}, पूर्व सूचनाओं के बावजूद आपके लोन खाता {acno} पर {outstanding} की बकाया राशि अभी तक जमा नहीं हुई है। कृपया लोन अनुबंध के अनुसार आगे की कार्यवाही से बचने हेतु इसे तुरंत चुकाएँ। - शिवम एंटरप्राइज़ेस",
    demandnotice_hi:"नमस्ते {name}, शिवम एंटरप्राइज़ेस की ओर से आपके लोन खाता {acno} के संबंध में यह एक औपचारिक मांग सूचना (डिमांड नोटिस) है, जो बकाया हो चुका है। आपसे अपेक्षा है कि {arrears} की बकाया राशि का भुगतान कर इस खाते को इस संदेश की तिथि से 7 दिनों के भीतर नियमित करें। इस खाते पर आपकी कुल बकाया राशि {outstanding} है। समय पर भुगतान न होने पर शिवम एंटरप्राइज़ेस को न्यायिक कार्यवाही (judicial proceedings) आरंभ करने तथा विधि अनुसार उपलब्ध अन्य उपाय अपनाने हेतु बाध्य होना पड़ेगा, जिसका समस्त व्यय एवं परिणाम आपके जोखिम पर होगा। कृपया बकाया राशि चुकाने हेतु हमारे कार्यालय से संपर्क करें। - शिवम एंटरप्राइज़ेस",
    bounce:"Namaste {name}, we wish to inform you that your cheque no. {cheque} towards loan account {acno} has been returned unpaid by the bank. A charge of Rs {amount} is now applicable. Kindly arrange the payment at the earliest to avoid further action. - Shivam Enterprises",
    bounce_hi:"नमस्ते {name}, हम आपको सूचित करना चाहते हैं कि ऋण खाता {acno} के लिए आपका चेक नं. {cheque} बैंक द्वारा अस्वीकृत (बाउंस) कर दिया गया है। अब Rs {amount} का शुल्क लागू है। कृपया आगे की कार्रवाई से बचने के लिए शीघ्र भुगतान की व्यवस्था करें। - शिवम एंटरप्राइज़ेस",
    closed:"Namaste {name}, congratulations! Your loan account {acno} with Shivam Enterprises has been fully repaid and is now closed. No further dues remain. Thank you for your trust and timely payments. - Shivam Enterprises",
    closed_hi:"नमस्ते {name}, बधाई हो! शिवम एंटरप्राइजेज के साथ आपका ऋण खाता {acno} पूर्ण रूप से चुकता हो गया है और अब बंद कर दिया गया है। कोई बकाया शेष नहीं है। आपके विश्वास और समय पर भुगतान के लिए धन्यवाद। - शिवम एंटरप्राइज़ेस",
    cleared:"Namaste {name}, we confirm that your cheque no. {cheque} of Rs {amount} towards loan account {acno} has been successfully cleared by the bank. Thank you for your payment. - Shivam Enterprises",
    cleared_hi:"नमस्ते {name}, हम पुष्टि करते हैं कि ऋण खाता {acno} के लिए आपका चेक नं. {cheque} राशि Rs {amount} बैंक द्वारा सफलतापूर्वक क्लियर हो गया है। आपके भुगतान के लिए धन्यवाद। - शिवम एंटरप्राइज़ेस",
    restructure:"Namaste {name}, your loan account {acno} has been restructured. Your revised EMI is {emi} over a tenure of {tenure} months. Thank you. - Shivam Enterprises",
    restructure_hi:"नमस्ते {name}, आपके ऋण खाता {acno} का पुनर्गठन कर दिया गया है। आपकी संशोधित EMI {emi} है तथा अवधि {tenure} माह है। धन्यवाद। - शिवम एंटरप्राइज़ेस",
    accwelcome:"Namaste {name}, welcome to Shivam Enterprises! Your account {acno} has been opened. We are glad to have you with us and are here to help whenever you need. - Shivam Enterprises",
    accwelcome_hi:"नमस्ते {name}, शिवम एंटरप्राइज़ेस में आपका स्वागत है! आपका खाता {acno} खोल दिया गया है। आपको हमारे साथ पाकर हमें प्रसन्नता है और किसी भी सहायता हेतु हम सदैव उपलब्ध हैं। - शिवम एंटरप्राइज़ेस",
    birthday:"Namaste {name}, wishing you a very happy birthday from all of us at Shivam Enterprises. May the year ahead bring you happiness and good fortune.",
    birthday_hi:"नमस्ते {name}, शिवम एंटरप्राइज़ेस की ओर से आपको जन्मदिन की हार्दिक शुभकामनाएँ। आने वाला वर्ष आपके लिए खुशियाँ और सौभाग्य लाए।",
    fine:100 };
  let TPL={...DEFAULT_TPL};
  function loadTpl(){ TPL={...DEFAULT_TPL}; }
  function saveTemplates(){
    /* merge onto DEFAULT_TPL so message types without an edit field (bounce, closed,
       cleared, restructure, accwelcome, ...) keep their default text instead of being dropped */
    TPL=Object.assign({}, DEFAULT_TPL, { reminder:$('tpl_reminder').value, overdue:$('tpl_overdue').value, greeting:$('tpl_greeting').value, holiday:$('tpl_holiday').value,
          thanks:$('tpl_thanks').value, welcome:$('tpl_welcome').value, finalnotice:$('tpl_finalnotice').value, demandnotice:($('tpl_demandnotice')?$('tpl_demandnotice').value:DEFAULT_TPL.demandnotice),
          reminder_hi:$('tpl_reminder_hi').value, overdue_hi:$('tpl_overdue_hi').value, greeting_hi:$('tpl_greeting_hi').value, holiday_hi:$('tpl_holiday_hi').value,
          thanks_hi:$('tpl_thanks_hi').value, welcome_hi:$('tpl_welcome_hi').value, finalnotice_hi:$('tpl_finalnotice_hi').value, demandnotice_hi:($('tpl_demandnotice_hi')?$('tpl_demandnotice_hi').value:DEFAULT_TPL.demandnotice_hi),
          fine:Number($('tpl_fine').value)||0 });
    try{ localStorage.setItem(MSG_STORE, JSON.stringify(TPL)); }catch(e){}
    toast('Templates saved');
  }
  function fillTplForm(){
    if(!$('tpl_reminder')) return;
    $('tpl_reminder').value=TPL.reminder; $('tpl_overdue').value=TPL.overdue; $('tpl_greeting').value=TPL.greeting; $('tpl_holiday').value=TPL.holiday;
    $('tpl_reminder_hi').value=TPL.reminder_hi; $('tpl_overdue_hi').value=TPL.overdue_hi; $('tpl_greeting_hi').value=TPL.greeting_hi; $('tpl_holiday_hi').value=TPL.holiday_hi;
    $('tpl_thanks').value=TPL.thanks; $('tpl_welcome').value=TPL.welcome; $('tpl_finalnotice').value=TPL.finalnotice; $('tpl_thanks_hi').value=TPL.thanks_hi; $('tpl_welcome_hi').value=TPL.welcome_hi; $('tpl_finalnotice_hi').value=TPL.finalnotice_hi;
    if($('tpl_demandnotice')){ $('tpl_demandnotice').value=TPL.demandnotice||DEFAULT_TPL.demandnotice; $('tpl_demandnotice_hi').value=TPL.demandnotice_hi||DEFAULT_TPL.demandnotice_hi; }
    $('tpl_fine').value=TPL.fine;
  }
  function getLateFee(){ return TPL.fine||0; }
  function applyVars(text, l, extra){
    extra=extra||{};
    const map={
      '{name}':l?l.name:'', '{acno}':l?l.acno:'', '{emi}':l?inr(l.emi):'', '{due_date}':l?(fmtDate(l.due)||'—'):'',
      '{outstanding}':l?inr(l.outstanding):'', '{arrears}':l?inr(l.arrears||0):'', '{amount}':l?inr(l.emi):'', '{fine}':inr(getLateFee()), '{rate}':l?(l.rate+'%'):'',
      '{occasion}':extra.occasion||'', '{date}':extra.date||'', '{cheque}':extra.cheque||''
    };
    // explicit extra values override the defaults (e.g. bounce amount, cheque no.)
    Object.keys(extra).forEach(function(k){ if(extra[k]!=='' && extra[k]!=null) map['{'+k+'}']=extra[k]; });
    return (text||'').replace(/\{[a-z_]+\}/g, m=> (m in map)?map[m]:m );
  }
  function normPhone(v){ let d=String(v||'').replace(/\D/g,''); if(d.length===11 && d[0]==='0') d=d.slice(1); if(d.length===12 && d.slice(0,2)==='91') d=d.slice(2); if(d && (d.length!==10 || !/^[6-9]/.test(d))){ toast('Warning: phone number "'+v+'" is not a valid 10-digit mobile number \u2014 WhatsApp may not deliver'); } return d; }
  function intlPhone(phone){ let d=(phone||'').replace(/\D/g,''); if(d.length===10) d='91'+d; else if(d.length===11&&d[0]==='0') d='91'+d.slice(1); return d; }
  function waSend(phone,msg){ const d=intlPhone(phone); if(!d){ toast('No phone number for this customer'); return; } window.open('https://wa.me/'+d+'?text='+encodeURIComponent(msg),'_blank'); }
  function smsSend(phone,msg){ const d=intlPhone(phone); window.open('sms:'+(d?('+'+d):'')+'&body='+encodeURIComponent(msg),'_blank'); }
  function copyMsg(msg){ try{ navigator.clipboard.writeText(msg); toast('Message copied'); }catch(e){ toast('Copy not available'); } }
  window._msgCache={};
  function msgBtns(phone,msg){
    const key='m'+(Math.random().toString(36).slice(2)); window._msgCache[key]=msg;
    const ph=(phone||'').replace(/'/g,'');
    return `<div class="rowact">
      <button class="btn btn-sm" style="background:#25D366;color:#fff;" onclick="waSend('${ph}',window._msgCache['${key}'])">WhatsApp</button>
      <button class="iconbtn" title="SMS" onclick="smsSend('${ph}',window._msgCache['${key}'])">✉</button>
      <button class="iconbtn" title="Copy" onclick="copyMsg(window._msgCache['${key}'])">⧉</button>
    </div>`;
  }
  function setMsgView(v){
    [...$('msgseg').children].forEach(b=>b.classList.toggle('active', b.dataset.m===v));
    ['reminders','greetings','history'].forEach(k=>{ const e=$('mv-'+k); if(e) e.style.display=(k===v)?'block':'none'; });
    if(v==='reminders'){ try{ autoRemScan(); }catch(e){} renderAutoPending(); renderReminders(); }
    if(v==='greetings') renderGreetings(); if(v==='history') renderWaHistory();
  }
  if($('msgseg')) $('msgseg').addEventListener('click', e=>{ if(e.target.dataset.m) setMsgView(e.target.dataset.m); });

  function renderReminders(){
    const f=$('remFilter').value; const lang=$('remLang')?$('remLang').value:'en'; const today=todayISO();
    const in7=new Date(); in7.setDate(in7.getDate()+7); const in7s=in7.toISOString().slice(0,10);
    let list=loans.map(l=>({...l,_st:autoStatus(l)})).filter(l=>l._st!=='Closed');
    if(f==='overdue') list=list.filter(l=>l._st==='Overdue');
    else if(f==='due') list=list.filter(l=>l.due && l.due>=today && l.due<=in7s);
    list.sort((a,b)=>(a.due||'').localeCompare(b.due||''));
    if(!list.length){ window._remList=[]; $('remWrap').innerHTML=`<div class="empty"><div class="big">&#128100;</div><div class="empty-t">No borrowers in this group</div><div class="empty-s">Change the language or filter above to see who matches.</div></div>`; return; }
    window._remList = list.map(l=>{ const over=(l._st==='Overdue'); const tpl=lang==='hi'?(over?TPL.overdue_hi:TPL.reminder_hi):(over?TPL.overdue:TPL.reminder); const av=(t)=>applyVars('{'+t+'}',l,{}); return {lang:lang, name:l.name, phone:l.phone, acno:l.acno, cat:(over?'Overdue Reminder':'EMI Reminder'), msg:applyVars(tpl,l,{}), tpl:tpl, loanId:l.id, amt:(over?Math.round(Number(l.outstanding)||0):Math.round(Number(l.emi)||0)), vars:{name:l.name, acno:l.acno||'', emi:inrPlain(l.emi), due_date:av('due_date'), outstanding:inrPlain(l.outstanding), fine:inrPlain(getLateFee()), rate:av('rate'), amount:inrPlain(l.outstanding), loanid:l.acno||''}}; });
    $('remWrap').innerHTML=`<div class="table-wrap"><table class="data"><thead><tr><th>Borrower</th><th>Phone</th><th class="right">EMI</th><th>Due</th><th>Status</th><th>Message</th></tr></thead><tbody>`+
      list.map(l=>{ const over=(l._st==='Overdue');
        const tpl = lang==='hi' ? (over?TPL.overdue_hi:TPL.reminder_hi) : (over?TPL.overdue:TPL.reminder);
        const msg=applyVars(tpl,l,{});
        return `<tr><td class="name">${esc(l.name)}</td><td class="muted">${esc(l.phone||'—')}</td><td class="right num">${inr(l.emi)}</td><td>${fmtDate(l.due)||'—'}</td><td><span class="badge ${l._st.toLowerCase()}">${l._st}</span></td><td class="muted" style="max-width:340px;font-size:11.5px;">${esc(msg)}</td></tr>`;
      }).join('')+`</tbody></table></div>`;
  }
  function renderGreetings(){
    const type=$('grType').value, lang=$('grLang')?$('grLang').value:'en', occ=$('grOccasion').value.trim(), dt=$('grDate').value.trim(), who=$('grWho').value;
    let list=loans.map(l=>({...l,_st:autoStatus(l)})); if(who==='active') list=list.filter(l=>l._st!=='Closed'); if(type==='bounce'){ list=list.filter(l=>Array.isArray(l.charges)&&l.charges.some(c=>c.type==='Cheque bounce')); } if(type==='closed'){ list=list.filter(l=>l._st==='Closed'); } if(type==='cleared'){ list=list.filter(l=>Array.isArray(l.payments)&&l.payments.some(p=>p.mode==='Cheque'&&p.status==='Cleared')); } if(type==='demandnotice'){ list=list.filter(l=>l._st==='Overdue'); }
    const tpl = lang==='hi' ? (TPL[type+'_hi']||TPL.greeting_hi) : (TPL[type]||TPL.greeting);
    if(!list.length){ window._grList=[]; $('grWrap').innerHTML=`<div class="empty">No customers to message.</div>`; return; }
    const GR_CAT={greeting:'Greeting / Notice',holiday:'Office Closure',thanks:'Payment Confirmation',welcome:'Loan Approval',finalnotice:'Final Notice',demandnotice:'Default Notice',bounce:'Cheque Bounce',closed:'Loan Closed',cleared:'Cheque Cleared',restructure:'Loan Restructured',accwelcome:'Welcome / Account Opened'}; const gcat=GR_CAT[type]||'Greeting / Notice'; const grVars=(l)=>{ var _lp=(l.payments||[]).filter(function(p){return Number(p.amount)>0;}).slice(-1)[0]||null; var _cc=(l.payments||[]).filter(function(p){return p.mode==='Cheque'&&p.status==='Cleared';}).slice(-1)[0]||{}; var _bc=(l.charges||[]).filter(function(c){return c.type==='Cheque bounce';})[0]||{}; var _due=(fmtDate(l.due)||fmtDate(l.disb)||''); if(type==='holiday') return {name:l.name, occasion:occ||'', date:dt||''}; if(type==='thanks') return {name:l.name, amount:inrPlain(_lp?_lp.amount:l.emi), acno:l.acno||'', txn:((_lp&&(_lp.ref||_lp.cheque||fmtDate(_lp.date)))||_due||('A/C '+(l.acno||''))), outstanding:inrPlain(l.outstanding)}; if(type==='welcome') return {name:l.name, acno:l.acno||'', emi:inrPlain(l.emi), due_date:_due, amount:inrPlain(l.principal)}; if(type==='finalnotice') return {name:l.name, acno:l.acno||'', outstanding:inrPlain(l.outstanding), due_date:_due}; if(type==='demandnotice') return {name:l.name, acno:l.acno||'', arrears:inrPlain(l.arrears||0), due_date:_due, outstanding:inrPlain(l.outstanding)}; if(type==='bounce') return {name:l.name, acno:l.acno||'', amount:inrPlain(_bc.amount||0), txn:(_bc.cheque||''), cheque:(_bc.cheque||'')}; if(type==='closed') return {name:l.name, acno:l.acno||'', principal:inrPlain(l.principal||0)}; if(type==='cleared') return {name:l.name, acno:l.acno||'', amount:inrPlain(_cc.amount||0), txn:(_cc.cheque||''), cheque:(_cc.cheque||'')}; if(type==='restructure') return {name:l.name, acno:l.acno||'', emi:inrPlain(l.emi), tenure:String(l.tenure||'')}; if(type==='accwelcome') return {name:l.name, acno:l.acno||''}; if(type==='birthday') return {name:l.name}; return {name:l.name, occasion:occ||''}; }; window._grList = list.map(l=>({lang:lang, name:l.name, phone:l.phone, acno:l.acno, cat:gcat, msg:applyVars(tpl,l,Object.assign({occasion:occ||'',date:dt||''}, (['bounce','closed','cleared'].indexOf(type)>=0)?grVars(l):{})), tpl:tpl, loanId:l.id, amt:(/\{(emi|amount|outstanding)\}/.test(tpl)?Math.round(Number(String((grVars(l).amount)||'').replace(/[^0-9.]/g,''))||(Number(l.emi)||0)):null), vars:grVars(l)}));
    $('grWrap').innerHTML=`<div class="table-wrap"><table class="data"><thead><tr><th>Borrower</th><th>Phone</th><th>Message</th></tr></thead><tbody>`+
      list.map(l=>{ const msg=applyVars(tpl,l,{occasion:occ||'(occasion)',date:dt||'(date)'});
        return `<tr><td class="name">${esc(l.name)}</td><td class="muted">${esc(l.phone||'—')}</td><td class="muted" style="max-width:380px;font-size:11.5px;">${esc(msg)}</td></tr>`;
      }).join('')+`</tbody></table></div>`;
  }

