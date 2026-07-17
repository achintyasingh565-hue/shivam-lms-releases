# Auto-updates — how it works

Your app now checks GitHub for new versions and pops up **"a new version is
available"** on both Windows and Mac.

- **Repository:** `achintyasingh565-hue/shivam-lms-releases` (Public)
- **Windows:** the pop-up offers **Download & install** → it downloads, then asks
  you to **Restart now**. (An "unknown publisher" prompt may appear — that's
  normal for an unsigned app; click through it.)
- **Mac:** the pop-up offers **Get update** → it opens the download page; drag the
  new app into Applications, replacing the old one. (Fully silent Mac updates
  need Apple's paid signing; the pop-up is the alternative until then.)
- The app checks on launch and again every 6 hours. Your data is never touched by
  an update.

---

## The everyday workflow (this is all you do)

1. I send you a new zip with the changes. **I bump the version number** each time
   (e.g. 2.0.0 → 2.0.1) — this is what makes the other apps notice the update.
2. On ONE computer, extract the new zip and run the matching publisher:
   - **Windows:** double-click **PUBLISH-UPDATE-WIN.bat** (click **Yes** on the
     Administrator prompt).
   - **Mac:** run **PUBLISH-UPDATE-MAC.command** (open it with the `bash` + drag
     trick the first time, per READ-ME-FIRST-MAC.txt).
3. It asks you to paste your **GitHub token**, then builds and uploads the release.
4. Done. Within a few hours (or on next launch), **every installed app** on all
   your devices shows the update pop-up.

You only build+publish **once per update**, on one machine — not on every device.

> Tip: to update the *Windows* apps you must publish from a *Windows* machine, and
> to update the *Mac* apps, publish from a *Mac*. You can do both, once each, per
> release.

---

## Your GitHub token

You created this once (GitHub → Settings → Developer settings → Personal access
tokens → Tokens (classic), with the **public_repo** box ticked). The publisher
scripts ask you to paste it each time and never store it. If you lose it or it
expires, just generate a new one the same way.

---

## First time only — set the baseline

The very first publish makes the current version live. Install that version on all
your devices (Windows via the Setup .exe, Mac via the app). From then on, every
future publish updates them automatically.

## If the pop-up never appears
- The published version must be **higher** than the installed one (I handle this).
- The GitHub release must be **published** (not a draft). The scripts publish it
  live automatically.
- The device needs internet. It checks on launch + every 6 hours.
