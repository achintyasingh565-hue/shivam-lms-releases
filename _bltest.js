const {chromium}=require("playwright");const path=require("path");
(async()=>{
  const b=await chromium.launch();const p=await b.newPage();
  const errs=[];p.on("pageerror",e=>errs.push(String(e)));
  await p.goto("file://"+path.resolve(__dirname,"index.html"),{waitUntil:"load"});
  await p.waitForTimeout(400);
  const r=await p.evaluate(()=>{
    openBlankLetter();
    const body=document.getElementById("blBody");
    body.innerHTML="<p>Test paragraph one.</p>";
    blSaveDraft();
    let fe=false; try{ blFont("Arial, sans-serif"); blSize("5"); }catch(e){ fe=String(e); }
    const ov=document.getElementById("blOverlay");
    ov.dispatchEvent(new MouseEvent("click",{bubbles:true}));
    const stillOpenAfterBackdrop = ov.style.display!=="none";
    closeBlankLetter();
    const hiddenAfterClose = ov.style.display==="none";
    openBlankLetter();
    const preserved = document.getElementById("blBody").innerHTML.includes("Test paragraph one");
    let pasted="skip";
    try{
      const dt=new DataTransfer(); dt.setData("text/plain","Pasted line");
      const ev=new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true});
      document.getElementById("blBody").focus();
      document.getElementById("blBody").dispatchEvent(ev);
      pasted=document.getElementById("blBody").innerText.indexOf("Pasted line")>=0;
    }catch(e){ pasted="ERR:"+e.message; }
    return {fe, stillOpenAfterBackdrop, hiddenAfterClose, preserved, pasted};
  });
  console.log("RESULT",JSON.stringify(r));
  console.log("pageerrors",errs.length, errs.slice(0,3));
  await b.close();
})();
