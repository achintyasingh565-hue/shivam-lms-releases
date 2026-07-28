# Release runbook — Shivam Enterprises LMS

Short, practical steps for shipping safely and recovering if a release goes wrong.

## Normal release
1. Push the new version to GitHub (GitHub Desktop).
2. Actions tab → **build-and-release** → Run workflow.
3. The **test** gate runs first (lint + npm audit + full test suite + health check).
   If it's red, nothing is published — fix and re-run.
4. On green, the Mac + Windows apps publish to Releases and clients get the update
   pop-up within a few hours.

## Staged rollout (ship to a fraction of clients first)
`electron-updater` honours a `stagingPercentage` field in the release's `latest.yml`
/ `latest-mac.yml`. To roll out to, say, 25% first:
1. After the workflow publishes the release, open the GitHub Release → edit
   `latest.yml` (and `latest-mac.yml`) and add a line: `stagingPercentage: 25`.
2. Watch for a day. If healthy, raise it to `100` (or remove the line).
   Each client deterministically decides in-or-out by its own id, so the same
   machines stay in the rollout as you raise the percentage.

## Rollback (a bad version shipped)
Clients only update to a **higher** version, so you can't "downgrade" them by
re-publishing an older number. Instead:
1. **Stop the spread:** in the bad GitHub Release, set `stagingPercentage: 0` in
   `latest.yml`/`latest-mac.yml` (or delete/mark the release as draft). New clients
   stop being offered it immediately.
2. **Ship a fix-forward:** make the fix, bump to the NEXT version, and publish. This
   is the normal path and is faster than trying to revert.
3. Keep the **previous good installers** available (don't delete old Releases) so a
   machine can be manually re-installed from a known-good build if needed.

## Data safety during a bad release
- Every device keeps a **daily cloud snapshot** of the whole book — restore from
  Administration → cloud backups if an edit/delete syncs everywhere wrongly.
- Local **auto-backups** (Administration → Backup) carry a checksum now; a corrupted
  file is caught on restore instead of loading silently.

## Enabling PII (Aadhaar/PAN) field encryption — your call
This is OFF by default on purpose, because it requires a passphrase that must be
**identical on both devices**, and turning it on prompts for that passphrase.
To enable it deliberately:
1. Decide a strong passphrase and share it securely between your two machines.
2. Set `encryptIds: true` in `src/app/00-cloud-config.js`, bump the version, ship.
3. On first sync each device prompts once for the passphrase (enter the SAME one on
   both). New saves then encrypt `idproof`/`coid` before upload; existing plaintext
   rows re-encrypt as they're next saved. If the two passphrases differ, one device
   will show unreadable tokens for the other's IDs — so coordinate carefully.
   (The daily snapshot still stores the book as-is; encrypting that too is a further
   change to schedule separately.)
