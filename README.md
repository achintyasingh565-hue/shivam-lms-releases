# Shivam Office Suite — Mac App (modular frontend)

This turns your Office Suite into a real Mac application (.app) that runs in its
own window with its own icon — completely separate from any web browser. Your
data stays private on the Mac.

You build it ONCE. After that you have a normal Mac app.

The app is exactly the same as before — Dashboard, Loan Records, Certificates,
Proposal Form, Loan Documents, Reminders & Messages, Backup & Restore. What
changed is only *behind the scenes*: the giant single `index.html` has been
split into small, tidy files under `src/` so it is easy to maintain. A quick
build step re-assembles them into the app automatically. See **ARCHITECTURE.md**
for the full layout.

--------------------------------------------------------------------
## One-time setup on this folder
--------------------------------------------------------------------
Copy your existing **build** folder (the one with `icon.png` and `icon.ico`)
into this folder if it isn't here already. Everything else is included.

You also need Node.js (free) — go to https://nodejs.org, download the **LTS**
version, open the downloaded .pkg and install it (click through). You don't need
to learn it; it just runs in the background to build the app.

--------------------------------------------------------------------
## How to build  (easy way)
--------------------------------------------------------------------
1. Keep all files in this folder together.
2. Double-click **BUILD-MAC.command**.
   - The FIRST time only, macOS blocks it with *"Apple could not verify..."*
     (because it was downloaded and isn't Apple-signed). This is normal — it's
     your own file. Click **Done** (NOT "Move to Trash"), then either:
       • **No Terminal:** open **System Settings → Privacy & Security**, scroll
         to *Security*, and next to *"BUILD-MAC.command was blocked"* click
         **Open Anyway**, then enter your password. OR
       • **Always works:** open **Terminal**, type `bash` and a space, drag
         **BUILD-MAC.command** into the window, and press **Enter**.
     See **READ-ME-FIRST-MAC.txt** for the same steps with pictures-in-words.
     You only do this ONCE — the script then unblocks the whole folder and the
     app it builds, so nothing nags you again. (You do NOT need `xattr`/`chmod`.)
3. A Terminal window shows progress and downloads components the first time
   (a few minutes). Leave it running. It now also assembles the app from the
   `src/` files before packaging — this is automatic.
4. When it says **DONE!**, open the new **dist** folder.
5. Drag the **Shivam Enterprises LMS** app onto your **Applications** folder.
6. Open it from Applications / Launchpad like any app.

First time opening the app: because it isn't from the App Store, macOS may warn.
Right-click the app → **Open** → **Open**, or go to
**System Settings → Privacy & Security → Open Anyway**. You only do this once.

Want to preview before building? Double-click **TEST-RUN-MAC.command**.

--------------------------------------------------------------------
## Editing the app later
--------------------------------------------------------------------
Everything you would change now lives under **src/**:

- `src/views/` .......... the screens (one file each: dashboard, payments, …)
- `src/styles/` ......... the look & feel / colours / themes
- `src/app/` ............ the app logic (one file per feature area)
- `src/vendor/` ......... the PDF engine (leave alone)
- `src/index.template.html` the outer shell (sidebar, top bar, pop-ups)

After any edit, run the app or build the installer — the build step
(`npm run build`) re-assembles `index.html` + `app.bundle.js` for you. Those two
files are generated; don't edit them by hand.

IMPORTANT: still use **Backup & Restore** inside the app now and then to save a
copy of your data, and to move it to another computer.

--------------------------------------------------------------------
## Files here
--------------------------------------------------------------------
- src/ .................. the application, split into tidy files (edit here)
- build.js .............. re-assembles src/ into the app
- main.js ............... opens it as a Mac app window
- preload.js ............ safe bridge to macOS features (Touch ID, PDF, backup)
- package.json .......... build settings (Mac + Windows)
- build/icon.png/.ico ... the app icon (copy yours in)
- BUILD-MAC.command ..... double-click to build the Mac app
- TEST-RUN-MAC.command .. double-click to preview the app
- ARCHITECTURE.md ....... how the new structure works, in detail
- README.md ............. this guide

(The settings also support building a Windows version later with
`npm run dist:win`, in case you ever need it.)

Need changes — new fields, another document, a password lock, a different icon?
Just ask.
