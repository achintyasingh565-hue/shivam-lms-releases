// Consistency fuzz.
//
// Every figure the app shows is restated somewhere else: the ledger's
// outstanding reappears as the report schedule's closing balance, the modal
// schedule's "Remaining", the receipt's balance and the closing advisory's
// "still to pay". Hand-written cases only cover the shapes someone thought of;
// this builds thousands of random loans — flat and byaj, paid early, late, in
// part, twice over, by cheques that bounced, with interest-only months, charges
// and (half the flat ones) an EMI day set the way the loan form sets it — and
// fails if any two of those places disagree by more than a rupee.
//
// The run that introduced it found four real disagreements (v2.33.0):
//   * a closed loan whose late fee had been paid showed "Remaining Rs 500";
//   * the closing advisory counted one instalment too many for every
//     interest-only month on an EMI loan;
//   * a payment made in an interest-serviced month reached the balance but not
//     the schedule's Paid column;
//   * money left as an "advance" while a part-paid instalment was still short
//     left the schedule's closing balance above the ledger's.
// It is seeded, so a failure reproduces exactly.
const fs=require('fs'),vm=require('vm'),path=require('path');
const APP=path.join(__dirname,'..','src','app');
const R=f=>fs.readFileSync(path.join(APP,f),'utf8');
function fn(src,name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('nf '+name);let b=src.indexOf('{',i),d=0;for(let j=b;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)return src.slice(i,j+1);}}
const H=R('02-helpers-nav.js'),C=R('08-certificate.js'),SC=R('03-emi-schedule.js'),RS=R('17-restructure.js');
function world(today){
  const ls={};
  const sb={todayISO:()=>today,console,Math,Number,Array,Date,JSON,String,isNaN,isFinite,parseInt,parseFloat,Object,SCHED_MAX_ROWS:600,
    localStorage:{getItem:k=>(k in ls?ls[k]:null),setItem:(k,v)=>{ls[k]=String(v)},removeItem:k=>{delete ls[k]}}};
  vm.createContext(sb);
  let code=['repPad','repAddMonths','repDaysBetween'].map(n=>fn(H,n)).join('\n');
  ['emiDueDate','calcLoanTotals','_recomputeInterestOnly','recomputeLoan','monthlyInterestOf','balanceAtPayment','getLateGraceDays','getLateFeeRate','_lfAddDays','_ymKey','emiPaidByIndex','overdueEmiIdxs','overdueMonthlyInterest','firstUnpaidIdx','emiDayDecide','emiDayApply'].forEach(n=>{code+='\n'+fn(C,n);});
  ['repScheduleData','emiDueTillToday','dueToDate'].forEach(n=>{code+='\n'+fn(SC,n);});
  ['addMonths','fmt','rupee','build'].forEach(n=>{code+='\n'+fn(RS,n);});
  vm.runInContext(code,sb); return sb;
}
let seed=Number(process.argv[2]||20261116); const rnd=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
const ri=(a,b)=>a+Math.floor(rnd()*(b-a+1)); const pick=a=>a[ri(0,a.length-1)];
const iso=(y,m,d)=>y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
function addDays(s,n){const p=s.split('-');const d=new Date(+p[0],+p[1]-1,+p[2]+n);return iso(d.getFullYear(),d.getMonth()+1,d.getDate());}
const bad={}; let N=0, anch=0;
function flag(k,l,info){ (bad[k]=bad[k]||[]); if(bad[k].length<2) bad[k].push({info,loan:JSON.stringify(l).slice(0,900)}); bad[k].n=(bad[k].n||0)+1; }
for(let t=0;t<2500;t++){
  const byaj=rnd()<0.25;
  const P=pick([20000,50000,60000,100000,250000]), rate=pick([1,1.5,2,2.5,3]), n=byaj?0:ri(3,18);
  const disb=iso(2026,ri(1,8),ri(1,28));
  const today=addDays(disb, ri(5,420));
  const W=world(today);
  const tot=W.calcLoanTotals(P,rate,n);
  const l={id:'F'+t,principal:P,rate,tenure:n,tint:byaj?0:tot.tint,tpay:byaj?P:tot.tpay,emi:byaj?Math.round(P*rate/100):tot.emi,disb,charges:[],payments:[]};
  if(byaj) l.interestOnly=true;
  const np=ri(0,10); let d=disb;
  for(let i=0;i<np;i++){ d=addDays(d,ri(3,55)); if(d>today) break;
    const amt=pick([l.emi,l.emi,l.emi,Math.round(l.emi/2),l.emi*2,ri(100,3000)]);
    const p={date:d,amount:amt,status:pick(['Cleared','Cleared','Cleared','Cleared','Pending','Bounced'])};
    if(!byaj && rnd()<0.08){ p.intOnly=true; }
    if(byaj && rnd()<0.1){ p.kind='principal'; p.amount=pick([P,Math.round(P/2)]); }
    l.payments.push(p); }
  const nc=ri(0,3); for(let i=0;i<nc;i++){ const cd=addDays(disb,ri(20,400)); if(cd>today) continue; l.charges.push({type:pick(['Late fee','Cheque bounce','Overdue interest','Other']),amount:pick([500,500,1200,250]),date:cd}); }
  // set exactly the way the form does: decide, then apply
  if(!byaj && rnd()<0.5){ const k=W.firstUnpaidIdx(l); const cand=addDays(W.repAddMonths(disb,k),ri(-20,25)); const dec=W.emiDayDecide(l,cand); if(dec.mode==='day'){ W.emiDayApply(l,dec); anch++; } }
  N++;
  let snap;
  try{ W.recomputeLoan(l); snap=JSON.stringify([l.outstanding,l.arrears,l.status,l.due,l.paid]); W.recomputeLoan(l); }catch(e){ flag('ENGINE THROWS',l,e.message); continue; }
  if(JSON.stringify([l.outstanding,l.arrears,l.status,l.due,l.paid])!==snap) flag('not idempotent',l,snap);
  const fees=l.charges.reduce((a,c)=>a+c.amount,0);
  if(!(isFinite(l.outstanding)&&isFinite(l.arrears))) flag('non-finite figure',l,[l.outstanding,l.arrears]);
  if(l.arrears<0||l.outstanding<0) flag('negative figure',l,[l.outstanding,l.arrears]);
  if(l.arrears>l.outstanding+0.5 && l.status!=='Closed') flag('arrears exceed outstanding',l,[l.outstanding,l.arrears]);
  if(l.outstanding<=0 && l.status!=='Closed' && !byaj) flag('nothing owed but not Closed',l,[l.outstanding,l.status]);
  if(l.status==='Closed' && l.outstanding>0.5) flag('Closed with money owed',l,[l.outstanding]);
  if(!byaj){
    const clearedNI=l.payments.filter(p=>p.status==='Cleared'&&!p.intOnly).reduce((a,p)=>a+p.amount,0);
    const want=Math.max(0,l.tpay+fees-clearedNI);
    if(Math.abs(l.outstanding-want)>0.5) flag('outstanding != payable + charges - received',l,[l.outstanding,want]);
    let D; try{ D=W.repScheduleData(l); }catch(e){ flag('SCHEDULE THROWS',l,e.message); }
    if(D){
      if(Math.abs(D.cleared-clearedNI)>0.5) flag('schedule: received differs from ledger',l,[D.cleared,clearedNI]);
      if(Math.abs(D.totalChg-fees)>0.5) flag('schedule: charges differ from ledger',l,[D.totalChg,fees]);
      const last=D.rows[D.rows.length-1];
      if(last && Math.abs(last.bal-l.outstanding)>0.5) flag('schedule: closing balance differs from outstanding',l,[last.bal,l.outstanding]);
      const sumPaid=D.rows.reduce((a,r)=>a+(Number(r.paid)||0),0); const intRecv=l.payments.filter(p=>p.status==='Cleared'&&p.intOnly).reduce((a,p)=>a+p.amount,0);
      if(Math.abs(sumPaid+(D.advance||0)-(clearedNI+intRecv))>1) flag('schedule: rows do not add up to what was received',l,[sumPaid,clearedNI]);
      if(D.rows.some(r=>!isFinite(r.bal)||r.bal<-0.5)) flag('schedule: a row has a bad balance',l,'');
      if(D.rows.some(r=>/NaN|undefined/.test(String(r.due)))) flag('schedule: a row has a bad date',l,'');
    }
    let B; try{ B=W.build(l); }catch(e){ flag('MODAL SCHEDULE THROWS',l,e.message); }
    if(B && Math.abs(B.remaining-l.outstanding)>0.5) flag('modal schedule: remaining differs from outstanding',l,[B.remaining,l.outstanding]);
    let T; try{ T=W.dueToDate(l); }catch(e){ flag('dueToDate THROWS',l,e.message); }
    if(T && l.status!=='Closed'){
      const wantArr=Math.min(l.outstanding,Math.max(0,T.outstanding));
      if(Math.abs(l.arrears-wantArr)>1) flag('closing advisory "still to pay" differs from arrears',l,[T.outstanding,l.arrears,JSON.stringify(T)]);
    }
    // a receipt reprinted for the LAST payment must show today's balance when nothing was charged after it
    const idxs=l.payments.map((p,i)=>i).filter(i=>l.payments[i].status==='Cleared');
    if(idxs.length){ const li=idxs.reduce((a,i)=>(l.payments[i].date>=l.payments[a].date?i:a),idxs[0]); const ld=l.payments[li].date;
      if(!l.charges.some(c=>c.date>ld)){ let bp; try{ bp=W.balanceAtPayment(l,li);}catch(e){ flag('RECEIPT THROWS',l,e.message); }
        if(bp!=null && Math.abs(bp-l.outstanding)>0.5) flag('receipt balance after the last payment differs from outstanding',l,[bp,l.outstanding]); } }
  } else {
    const pp=l.payments.filter(p=>p.status==='Cleared'&&p.kind==='principal').reduce((a,p)=>a+p.amount,0);
    const ip=l.payments.filter(p=>p.status==='Cleared'&&p.kind!=='principal').reduce((a,p)=>a+p.amount,0);
    const mi=Math.round(P*rate/100);
    if(l.emi!==mi) flag('byaj: monthly due is not the interest',l,[l.emi]);
    { let D; try{ D=W.repScheduleData(l); }catch(e){ flag('byaj SCHEDULE THROWS',l,e.message); }
      if(D){ const withBal=D.rows.filter(r=>r.bal!=null); const last=withBal[withBal.length-1];
        if(last && Math.abs(last.bal-l.outstanding)>0.5) flag('byaj schedule: closing balance differs from outstanding',l,[last.bal,l.outstanding]); }
      let B; try{ B=W.build(l); }catch(e){ flag('byaj MODAL SCHEDULE THROWS',l,e.message); }
      if(B && Math.abs(B.remaining-l.outstanding)>0.5) flag('byaj modal schedule: remaining differs from outstanding',l,[B.remaining,l.outstanding]); }
    if(pp<P){
      // whole months from disbursement to today, the engine's own rule, re-derived here
      const d0=new Date(disb+'T00:00:00'), dn=new Date(today+'T00:00:00');
      let mo=(dn.getFullYear()-d0.getFullYear())*12+(dn.getMonth()-d0.getMonth()); if(dn.getDate()<d0.getDate()) mo--; mo=Math.max(0,mo);
      const intArr=Math.max(0,mi*mo-ip), feesDue=Math.max(0,fees-Math.max(0,ip-mi*mo));
      if(Math.abs(l.outstanding-Math.max(0,P-pp+feesDue))>0.5) flag('byaj: outstanding != principal - returned + UNPAID charges',l,[l.outstanding,P-pp+feesDue]);
      if(Math.abs(l.arrears-(intArr+feesDue))>0.5) flag('byaj: arrears != unserviced interest + unpaid charges',l,[l.arrears,intArr+feesDue]);
      if(l.outstanding<P-pp-0.5) flag('byaj: an ordinary receipt reduced the PRINCIPAL',l,[l.outstanding,P-pp]);
      let T; try{ T=W.dueToDate(l); }catch(e){ flag('byaj dueToDate THROWS',l,e.message); }
      if(T && Math.abs(T.outstanding-l.arrears)>1) flag('byaj: closing advisory differs from arrears',l,[T.outstanding,l.arrears]);
    }
  }
}
console.log('loans exercised: '+N+'  (with an EMI day: '+anch+')');
const keys=Object.keys(bad);
if(!keys.length) console.log('PASS  no two views disagree');
keys.forEach(k=>{ console.log('\nFAIL  '+k+'  — '+bad[k].n+' of '+N); bad[k].forEach(b=>console.log('   '+JSON.stringify(b.info)+'\n   '+b.loan)); });
console.log(keys.length ? '\n'+keys.length+' KIND(S) OF DISAGREEMENT' : '\nALL CHECKS PASS');
process.exitCode = keys.length ? 1 : 0;
