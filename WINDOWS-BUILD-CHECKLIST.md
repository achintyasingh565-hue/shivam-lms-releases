# Building the Windows app over AnyDesk — checklist

Follow top to bottom. Tick each box as you go. Total time ≈ 15–20 minutes
(most of it is waiting while it downloads and builds).

## Before you start — have these ready
- [ ] AnyDesk running on **both** your Mac and the Windows PC, and you can see the Windows screen.
- [ ] The project zip (`shivam-enterprises-lms-cloud.zip`) available to copy over.
- [ ] The Windows PC is switched on and **connected to the internet**.

---

## Step 1 — Copy the project to the Windows PC
- [ ] In the AnyDesk window, open **File Transfer** (or the file-manager icon).
- [ ] Copy `shivam-enterprises-lms-cloud.zip` from your Mac to the Windows **Desktop**.
- [ ] *(Alternative if file transfer is awkward: on the Windows PC open a browser, go to Google Drive/your email where you saved the zip, and download it to the Desktop.)*

## Step 2 — Unzip it
- [ ] On the Windows Desktop, **right-click** the zip → **Extract All** → **Extract**.
- [ ] You now have a folder called **shivam-refactor**. Open it. You should see
      `BUILD-WIN.bat`, `package.json`, `src`, etc.

## Step 3 — Install Node.js (one time on this PC)
- [ ] On the Windows PC, open a browser and go to **https://nodejs.org**
- [ ] Download the **LTS** version, run the installer, and click **Next / Next / Install**
      (accept the defaults). Finish it.

## Step 4 — Build the app
- [ ] In the **shivam-refactor** folder, **double-click `BUILD-WIN.bat`**.
- [ ] A **Windows prompt asks for Administrator rights — click YES.** (The build
      needs this to unpack one of its components; without it you'll see a
      "Cannot create symbolic link" error.)
- [ ] A black window opens and shows progress. **Leave it running** — the first
      time it downloads components (a few minutes).
- [ ] If Windows shows a blue "Windows protected your PC" box, click
      **More info → Run anyway** (it's your own file).
- [ ] Wait until it says **DONE!**

## Step 5 — Get the installer
- [ ] Open the **dist** folder inside shivam-refactor.
- [ ] Find **`Shivam Enterprises LMS Setup …​.exe`** — that's your Windows app installer.
- [ ] Double-click it to install the app on this PC.

## Step 6 — Sign in and check it's sharing data
- [ ] Open the installed **Shivam Enterprises LMS** app.
- [ ] When the **"Connect to shared data"** box appears, sign in with one of your
      Supabase logins.
- [ ] Watch the top-bar pill turn green **Synced** — your borrowers should appear,
      matching the Mac. ✅

---

## To put it on other Windows PCs
You only build **once**. Copy that single `Shivam Enterprises LMS Setup .exe` to any
other Windows PC (USB stick, Google Drive, or AnyDesk file transfer), run it, and
sign in — it shares the same data automatically.

## If something goes wrong
- **"Cannot create symbolic link : A required privilege is not held"** → the build
  wasn't run as Administrator. Close the window, double-click `BUILD-WIN.bat` again,
  and click **YES** on the Administrator prompt. (Alternative, if you can't use
  admin: turn on **Settings → Privacy & Security → For developers → Developer Mode**,
  then run it again.)
- **"npm is not recognised" / build closes instantly** → Node.js isn't installed
  or the PC needs a restart after installing it. Restart Windows, then double-click
  `BUILD-WIN.bat` again.
- **Build fails partway** → make sure the PC stayed online, then run
  `BUILD-WIN.bat` again (it's safe to re-run).
- **Anything else** → take a photo/screenshot of the black window's last few lines
  and send it to me; I'll tell you exactly what to do.
