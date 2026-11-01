  /* ---------- Aadhaar/PAN field-encryption panel (Administration → Security) ----------
     Thin UI over the sync module's enableIdEncryption / disableIdEncryption /
     idEncryptionStatus hooks. The crypto itself (deriveKey / ensureCryptoKey /
     keychain) is unchanged — this only sets the passphrase and the on/off flag. */
  function renderIdEncPanel(){
    var badge=$('idEncStatus'); var offBtn=$('idEncOffBtn'); if(!badge) return;
    var st=(typeof idEncryptionStatus==='function')?idEncryptionStatus():{on:false,keyed:false,forcedByConfig:false};
    if(st.on){ badge.textContent = st.keyed ? 'On' : 'On (enter passphrase)'; badge.className='wa-stat on'; if(offBtn) offBtn.style.display = st.forcedByConfig ? 'none' : ''; }
    else { badge.textContent='Off'; badge.className='wa-stat off'; if(offBtn) offBtn.style.display='none'; }
  }
  function idEncMsg(t, ok){ var m=$('idEncMsg'); if(m){ m.textContent=t||''; m.style.color = ok ? 'var(--ok,#0b7a4b)' : 'var(--muted)'; } }
  async function idEncTurnOn(){
    if(typeof enableIdEncryption!=='function'){ idEncMsg('Cloud sync is not available.'); return; }
    var el=$('idEncPass'); var pass=el?el.value:''; if(!pass || !pass.trim()){ idEncMsg('Enter a passphrase first.'); return; }
    if(!confirm('Turn on ID encryption?\n\nYou MUST enter the SAME passphrase on your other device, or it will not be able to read the ID numbers. Store the passphrase somewhere safe — if it is lost, the encrypted ID fields cannot be recovered.')) return;
    idEncMsg('Enabling…');
    var r=await enableIdEncryption(pass);
    if(r && r.ok){ if(el) el.value=''; idEncMsg('Encryption is on. Enter the same passphrase on your other device.', true); toast('ID encryption enabled'); }
    else { idEncMsg((r&&r.error)||'Could not enable encryption.'); }
    renderIdEncPanel();
  }
  function idEncTurnOff(){
    if(typeof disableIdEncryption!=='function') return;
    if(!confirm('Turn off ID encryption on THIS device?\n\nRecords already encrypted stay encrypted in the cloud; this device will simply stop encrypting new saves. To read existing encrypted IDs again you will need the passphrase.')) return;
    disableIdEncryption(); idEncMsg('Turned off on this device.'); renderIdEncPanel();
  }
  async function idEncRestore(){
    if(typeof restoreReadableIds!=='function'){ idEncMsg('Cloud sync is not available on this device.'); return; }
    if(!confirm('Restore readable ID numbers and turn OFF encryption?\n\nRun this on the device where you set the passphrase (enter it in the box above if asked). It decrypts the ID numbers back to plain text and switches encryption off, so both devices show readable numbers again.')) return;
    var el=$('idEncPass'); var pass=el?el.value:'';
    idEncMsg('Restoring…');
    var r=await restoreReadableIds(pass);
    if(r && r.ok){ if(el) el.value=''; idEncMsg('Restored '+r.done+' ID number(s)'+(r.failed?(' · '+r.failed+' could not be read — check the passphrase'):'')+'. Encryption is now off.', true); toast('Readable IDs restored'); }
    else { idEncMsg((r&&r.error)||'Could not restore.'); }
    renderIdEncPanel();
  }
  window.renderIdEncPanel=renderIdEncPanel; window.idEncTurnOn=idEncTurnOn; window.idEncTurnOff=idEncTurnOff; window.idEncRestore=idEncRestore;
