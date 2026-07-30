# Shivam Enterprises LMS — pre-launch review (v2.0.24)

A senior-developer pass over the whole app ahead of going live. Below is what I
checked, what I fixed in this build, and the few things I want you to know or do
before launch.

## Verdict

The app is in good shape to go live. Money maths, saving, backup/restore, cloud
sync, security and the Electron desktop shell are all sound. I fixed one real
data-safety gap and a couple of smaller issues this build, and there is one
operational thing (documents backup) I want you to actually *do* before launch.

All 23 automated test files pass, ESLint is clean, and the built page has no
duplicate element IDs.

## Fixed in this build (v2.0.24)

1. **Document (KYC) backup — the important one.** Uploaded scans and photographs
   (Aadhaar, PAN, signed agreements, property papers) were stored only in this
   device's browser database. They were **not** part of the record backup and are
   **not** synced to the cloud — so a lost or reset computer would lose every
   scan even though you had "taken a backup." Added **Administration → Backup &
   Data → Back up documents / Restore documents**, plus a clear warning on that
   screen. Restore is additive (never deletes; skips duplicates). Covered by a new
   round-trip test that proves a scanned file survives a full wipe byte-for-byte.

2. **Notices now always use fresh figures.** A demand/final notice previously read
   each borrower's saved arrears/outstanding without recomputing for today, so a
   notice could understate what is actually owed. Notices now recompute against
   today's date before filling the figures.

3. **Duplicate element id fixed.** The notice language selector's id existed twice,
   so the two toggles could show different states. Given a distinct id and kept in
   sync. Full scan now shows zero duplicate IDs across the app.

4. **Desktop hardening.** External links now open only for `http/https` schemes,
   and in-app navigation away from the bundled page is blocked. (Low risk, but
   tightens the desktop shell.)

## Checked and found healthy (no change needed)

- **Loan maths:** flat interest, EMI, arrears, outstanding, cheque-bounce fees,
  restructure/prepay. Verified by an exhaustive sweep of **11,520** record shapes
  plus targeted tests — all invariants hold.
- **Saving & durability:** localStorage primary + IndexedDB mirror + timestamp
  reconciliation; corrupt rows are repaired on load; storage-full is handled
  gracefully without data loss.
- **Restore:** integrity check (count + checksum), refuses newer-schema backups,
  snapshots before restoring, and preserves the WhatsApp token.
- **Security:** no secrets ship in the code (only the Supabase *publishable* key,
  which is safe). The WhatsApp token lives only in the OS keychain and can never
  be read back by the page. `contextIsolation` on, `nodeIntegration` off, PDF
  rendering sandboxed, and a strict Content-Security-Policy (`default-src 'none'`,
  network limited to your Supabase URL only).
- **Cloud sync:** last-write-wins with a two-device conflict guard; "Delete all"
  now propagates deletes to the cloud so records don't re-hydrate.

## Do these before you go live

1. **Take both backups on day one, and keep a routine.** Administration → Backup:
   (a) *Download Backup* (.json — records & settings) **and** (b) *Download all
   documents* (scans & photos). Keep them together off the machine (pen drive +
   email/cloud). The record backup does **not** contain the scans — you need both.
2. **Set a backup folder** so automatic backups run, and confirm "last backup" is
   recent on the dashboard safety banner.
3. **Set a recovery code** (Administration → Security & Team) so a forgotten
   password can never lock you out.
4. **Confirm WhatsApp** is connected and send one test message before relying on
   reminders/notices. Templates must stay approved in Meta.
5. **Run the in-app Health Check** (Administration → Maintenance) on each computer
   after installing this build.
6. If you use two computers, open both once so cloud sync links them, and verify a
   change on one appears on the other.

## Known limitations (not bugs — decisions to be aware of)

- Document scans are **per-device** and only protected by the new documents
  backup above (not by cloud sync). Back them up on every computer that holds them.
- macOS auto-update shows a "get the update" dialog that opens the download page
  (silent auto-update needs an Apple Developer signature). Windows auto-updates
  in place. This is expected.
