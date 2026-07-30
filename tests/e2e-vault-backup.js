// Proves the document-vault backup/restore round-trip (KYC scans survive a wipe).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(async () => {
    // helper: raw add a doc (with a real Blob) straight into the vault store
    function vOpen(){ return new Promise((res,rej)=>{ const rq=indexedDB.open('shivamVault',1); rq.onupgradeneeded=e=>{ const db=e.target.result; if(!db.objectStoreNames.contains('docs')){ const st=db.createObjectStore('docs',{keyPath:'id',autoIncrement:true}); st.createIndex('custKey','custKey',{unique:false}); } }; rq.onsuccess=e=>res(e.target.result); rq.onerror=()=>rej(rq.error); }); }
    function vAdd(doc){ return vOpen().then(db=>new Promise((res)=>{ const tx=db.transaction('docs','readwrite'); tx.objectStore('docs').add(doc); tx.oncomplete=()=>res(); tx.onerror=()=>res(); })); }
    function vCount(){ return vOpen().then(db=>new Promise((res)=>{ const rq=db.transaction('docs','readonly').objectStore('docs').getAll(); rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>res([]); })); }
    function vClear(){ return vOpen().then(db=>new Promise((res)=>{ const tx=db.transaction('docs','readwrite'); tx.objectStore('docs').clear(); tx.oncomplete=()=>res(); tx.onerror=()=>res(); })); }

    await vClear();
    const png = new Blob([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4,5,6,7,8])], { type: 'image/png' });
    await vAdd({ custKey:'ramesh|se-0009', name:'aadhaar.png', category:'Aadhaar', type:'image/png', size:png.size, addedAt:1000, blob:png });
    await vAdd({ custKey:'ramesh|se-0009', name:'photo.png',   category:'Photograph', type:'image/png', size:png.size, addedAt:2000, blob:png });

    const before = (await vCount()).length;
    const backup = await window._vaultBackupData();       // build restorable payload
    const backupCount = backup.count;
    const firstHasData = /^data:image\/png;base64,/.test(backup.docs[0].data);

    await vClear();
    const afterWipe = (await vCount()).length;

    const added1 = await window._vaultRestoreData(backup); // restore from backup
    const afterRestore = (await vCount()).length;
    const added2 = await window._vaultRestoreData(backup); // restore AGAIN -> duplicates skipped

    // verify a restored blob is byte-identical
    const docs = await vCount();
    const buf = new Uint8Array(await docs[0].blob.arrayBuffer());
    const bytesOK = buf.length === 16 && buf[0] === 137 && buf[1] === 80 && buf[15] === 8;

    return { before, backupCount, firstHasData, afterWipe, added1, afterRestore, added2, finalCount: docs.length, bytesOK };
  });

  const checks = {
    'two docs seeded + backed up':        out.before === 2 && out.backupCount === 2,
    'backup stores base64 image data':    out.firstHasData === true,
    'wipe empties the vault':             out.afterWipe === 0,
    'restore brings all docs back':       out.added1 === 2 && out.afterRestore === 2,
    'restored bytes are identical':       out.bytesOK === true,
    'second restore skips duplicates':    out.added2 === 0 && out.finalCount === 2,
    'no page errors':                     errs.length === 0
  };
  console.log('\n===== DOCUMENT VAULT BACKUP =====');
  console.log('  state:', JSON.stringify(out));
  let bad = 0;
  Object.keys(checks).forEach(k => { const ok = checks[k]; if (!ok) bad++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + k); });
  if (errs.length) console.log('  errors:', errs);
  console.log('\n  ' + (bad === 0 ? '✅ VAULT BACKUP: DOCUMENTS SURVIVE A WIPE' : '❌ ' + bad + ' PROBLEM(S)') + '\n');
  await b.close();
  process.exit(bad === 0 ? 0 : 1);
})();
