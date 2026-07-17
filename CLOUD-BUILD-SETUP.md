# Cloud build — publish Mac AND Windows without owning both machines

With this, **GitHub's own computers build both apps for you.** You never run a
publisher on a Mac or a Windows PC again, and you never paste a token again.

You do the setup below **once**. After that, every future update is: put the new
files in the folder, click a couple of buttons, done.

---

## One-time setup (about 15 minutes)

### Step 1 — Install GitHub Desktop
This is the friendly app for putting your code on GitHub (no Terminal, no tokens).

1. Download from **https://desktop.github.com** and install it.
2. Open it and **sign in** with your GitHub account (achintyasingh565-hue).

### Step 2 — Clone your releases repo
1. In GitHub Desktop: **File → Clone repository**.
2. Pick **achintyasingh565-hue/shivam-lms-releases** from the list.
3. Choose where to put it on your Mac (e.g. Documents) and click **Clone**.

This makes a local folder that is linked to GitHub.

### Step 3 — Put the app's source into that folder
1. Open the folder GitHub Desktop just made (it has a `README.md` inside).
2. From the zip I sent you, copy **everything** into that folder — when your Mac
   asks about replacing `README.md`, choose **Replace**. (Make sure the hidden
   `.github` folder comes across too. In Finder press **Cmd+Shift+.** to show
   hidden files if you want to confirm it's there.)

### Step 4 — Push it to GitHub
1. Back in GitHub Desktop you'll see a long list of added files.
2. In the bottom-left, type a short summary like `Add app source`, then click
   **Commit to main**.
3. Click **Push origin** (top bar). Your code is now on GitHub.

### Step 5 — Allow releases (one setting)
1. On the website, open your repo → **Settings** → **Actions** → **General**.
2. Scroll to **Workflow permissions**, choose **Read and write permissions**,
   and **Save**. (This lets the automatic build create the release.)

**Setup is done.** You never repeat Steps 1, 2, or 5.

---

## Publishing an update (the everyday flow)

Whenever I send you a new version:

1. **Replace the files:** open your local repo folder, copy in the new files
   from my zip (Replace when asked).
2. **Push:** in GitHub Desktop → type a summary (e.g. `Update to 2.0.1`) →
   **Commit to main** → **Push origin**.
3. **Build:** on the website, open your repo → **Actions** tab →
   **build-and-release** → **Run workflow** → green **Run workflow** button.
4. Wait about **10 minutes**. When both jobs show a green tick, the new Mac and
   Windows apps are live on Releases. Every installed app shows the update
   pop-up within a few hours (or on next launch).

That's the whole job — no Mac build, no Windows PC, no token.

> The version number still has to go up each time (2.0.0 -> 2.0.1). I handle that
> in every zip I send, so you don't have to think about it.

---

## Good to know
- **It's free** for this public repo — unlimited build minutes.
- **First time:** after the first cloud publish, install that version on each of
  your devices once (from the Releases page) to set the baseline. After that,
  updates arrive automatically.
- **Mac still shows "Open Anyway" on first install** — that's the unsigned-app
  step, unrelated to this, and only needs Apple's paid signing to remove.
- If a build ever fails, open the red job in the Actions tab and send me a
  screenshot of the failed step — I'll fix it.
