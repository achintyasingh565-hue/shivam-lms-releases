# Sharing your data across two computers (Supabase)

This makes both computers use the **same loan book** — add a payment on one, and
the other sees it within a few seconds. Your Supabase address and key are already
filled into the app (`src/app/00-cloud-config.js`), so you only need to do the
three one-time steps below.

You do this **once**, from any computer. After that, each staff device just signs in.

---

## Step 1 — Create the database table (2 minutes, done once)

1. Open your project on **supabase.com** and sign in.
2. In the left menu, click **SQL Editor**, then **New query**.
3. Open the file **`supabase/schema.sql`** from this project, copy **all** of it,
   paste it into the query box, and click **Run**.
4. You should see "Success". That created the secure tables your loans and daily
   backups live in. (It's safe to run again — if you set this up before the daily
   backup feature was added, just **re-run it** to add the backups table.)

## Step 2 — Create a login for each device (done once)

Your data is **locked** — nobody can read it without a login. Make one login per
person (or one shared login for both devices — your choice):

1. In the left menu, click **Authentication**, then **Users**, then **Add user →
   Create new user**.
2. Enter an **email** and a **password**, and **tick "Auto Confirm User"** (so it
   works right away without email verification). Click **Create user**.
3. Repeat if you want a second, separate login.

Write these email/password logins down — that's what staff type into the app.

## Step 3 — Sign in on each computer

1. Open the app (**TEST-RUN-MAC.command**, or the installed app) on the first
   computer.
2. A **"Connect to shared data"** box appears. Enter one of the logins from Step 2
   and click **Sign in**.
3. Do the same on the second computer, using a login from Step 2.

That's it. Both computers now share one loan book. To check: add a test borrower on
one computer and watch it appear on the other within about 7 seconds. (You can
delete the test one afterwards — deletions sync too.)

---

## Good to know

- **Offline is fine.** If the internet drops, the app keeps working on that
  computer's local copy and syncs back up when the connection returns. There's a
  small **"synced / offline"** indicator you can wire into the top bar if you'd
  like (ask me).
- **Work locally instead?** On the sign-in box, click **"Skip for now"** to use
  that computer on its own data without cloud.
- **Turn cloud off completely:** open `src/app/00-cloud-config.js` and set
  `enabled: false`, then rebuild. The app goes back to pure local, unchanged.
- **The publishable key in the app is safe** to ship — it can do nothing until
  someone signs in, and the table is locked by Row Level Security. Never put the
  *secret* key in the app.

## Optional — encrypt Aadhaar / PAN before they go online

By default your data is protected by the **login + the locked table + being hosted
in the Mumbai region**. If you want an *extra* layer so those ID numbers are
unreadable even inside the database, you can switch on field encryption:

1. In `src/app/00-cloud-config.js`, set `encryptIds: true`, rebuild.
2. The first time each device signs in, it asks for a **data-protection
   passphrase**. Use the **exact same passphrase on both computers.**

⚠️ **Important trade-off:** this passphrase is never sent anywhere, so if you
**forget it, the Aadhaar/PAN fields cannot be recovered** (the rest of the loan
data is unaffected). That's why it's **off by default** — turn it on only if
you're comfortable safekeeping the passphrase. My honest recommendation: keep your
logins private and this is optional; turn it on if you specifically want the extra
protection.

---

## Limits of this first version (so there are no surprises)

- **Two devices editing the *very same* loan at the *very same* second:** the last
  save wins for that one record. In normal use (different borrowers, or a few
  seconds apart) everything merges cleanly.
- **A delete made while fully offline** won't reach the other device until that
  computer is back online *and* you delete it again while connected. Deletes made
  online sync fine. If this ever matters to you, tell me and I'll add an
  offline-delete queue.

These are the kinds of things worth checking together on your real two computers —
tell me how the first live test goes and I'll tune anything that needs it.
