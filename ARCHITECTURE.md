# Shivam Enterprises LMS — Frontend Architecture

This document explains how the frontend is now organised, why it is built this
way, and how to keep extending it safely.

The old `index.html` was a single 5,600-line, 1.3 MB file: all HTML, ~1,900
lines of CSS in five `<style>` blocks, two minified vendor libraries, and ~3,300
lines of application JavaScript with **381 functions** wired to **227 inline
`onclick`/`oninput` handlers** in the markup. That file is now *source*, split
into small, single-responsibility files, and reassembled by a build step into
the exact same app the Electron shell loads.

Nothing about the running app changed. The build output is verified
**byte-identical in JavaScript**, **identical in DOM markup**, and **identical in
runtime behaviour** (same globals, same rendered dashboard, zero console errors)
to the original.

---

## Folder structure

```
shivam-enterprises-lms/
├── main.js                 Electron main process (unchanged)
├── preload.js              contextBridge / window.electronAPI (unchanged)
├── build.js                Frontend build: bundles + assembles
├── package.json            Build now runs before start/dist
│
├── src/                    ← everything you edit lives here
│   ├── index.template.html Shell: <head>, sidebar, topbar, modals + include markers
│   │
│   ├── styles/             CSS, one file per concern
│   │   ├── 01-base.css         design tokens, :root vars, light/dark themes, layout
│   │   ├── 02-components.css   buttons, cards, tables, modals, forms
│   │   ├── 03-glass.css        the "glass skin" theme
│   │   ├── 04-no-flicker.css   first-paint / anti-flicker rules
│   │   └── 05-mobile.css       responsive / mobile layout
│   │
│   ├── vendor/             third-party libraries, isolated
│   │   ├── pdf-lib.js          PDF engine (PDFLib)
│   │   └── fontkit.js          font subsetting for PDFLib
│   │
│   ├── views/              one file per screen (the DOM for each nav section)
│   │   ├── lock-screen.html    the login / lock screen
│   │   ├── dashboard.html      #sec-dash
│   │   ├── customers.html      #sec-cust  (Customers & Loans)
│   │   ├── payments.html       #sec-pay
│   │   ├── reports.html        #sec-reports
│   │   ├── loan-documents.html #sec-hpfile
│   │   ├── certificates.html   #sec-cert
│   │   ├── default-notices.html#sec-defaults
│   │   ├── messages.html       #sec-messages (Reminders & Messages)
│   │   ├── proposal.html       #sec-proposal
│   │   └── administration.html #sec-backup (Backup / Audit / WhatsApp settings)
│   │
│   └── app/                application logic, split by concern (load order = filename order)
│       ├── 01-core-store.js       app state, localStorage + IndexedDB, schema/migrations
│       ├── 02-helpers-nav.js      shared helpers (currency, dates, escaping) + nav plumbing
│       ├── 03-emi-schedule.js     EMI / repayment schedule maths
│       ├── 04-overdue.js          overdue / DPD tracking & buckets
│       ├── 05-ui-shell.js         go() view-switcher, sidebar, search, small chart helpers
│       ├── 06-dashboard.js        renderDash() and its widgets (KPIs, donut, risk chart)
│       ├── 07-loans-crud.js       loan table + add/edit/delete modal
│       ├── 08-certificate.js      certificate builder + print
│       ├── 09-proposal.js         proposal form
│       ├── 10-loan-documents.js   mortgage file, agreement, security letter, promissory note
│       ├── 11-reminders.js        reminders & greetings
│       ├── 12-whatsapp.js         batch WhatsApp, review/approval queue, history
│       ├── 13-security-lock.js    app lock, users, Touch ID, forgot-password flow
│       ├── 14-pwa-backup.js       install prompt + backup / restore / auto-backup
│       ├── 15-init-errors.js      startup init + global error safety net
│       ├── 16-wa-token-migrate.js one-time WhatsApp token → keychain migration
│       ├── 17-restructure.js      restructure / prepayment overlay
│       └── 18-docgen.js           on-the-fly document HTML/PDF generators
│
├── index.html              ← BUILD OUTPUT (generated; do not edit)
└── app.bundle.js           ← BUILD OUTPUT (generated; do not edit)
```

`index.html` and `app.bundle.js` are produced by the build and are the only two
JS/HTML artifacts the app loads at runtime (plus the linked CSS and vendor
files). They are in `.gitignore`; edit the files under `src/` instead.

---

## The build (`node build.js`)

Two deterministic, order-preserving steps:

**1. Bundle** — every file in `src/app/` is read in filename order and
concatenated into one script, then passed through **esbuild** (whitespace and
comment stripping only) to produce `app.bundle.js`.

**2. Assemble** — `src/index.template.html` is read, each
`<!--#include views/NAME.html-->` marker is replaced with that partial's
contents, and `<script src="app.bundle.js">` is dropped in at the end of
`<body>`. The result is written to `index.html`.

`package.json` runs the build automatically before `start` and every `dist`
target, so the existing double-click **BUILD-MAC.command** / **TEST-RUN-MAC.command**
flow is unchanged for the end user — it just assembles the app first.

If esbuild is ever unavailable, `build.js` falls back to a plain (un-minified)
concatenation, so the build can never be blocked by a missing tool.

---

## Why concatenation into one scope, and not `import`/`export` per module

This is the single most important design decision, so it is worth being explicit.

The original app is built on a **shared global scope**. All 381 functions are
global, they call each other freely, they rely on JavaScript **function
hoisting**, and — critically — **227 inline handlers in the HTML** call them by
name, e.g. `onclick="authSubmit()"`, `oninput="recalc()"`, `onclick="go('pay')"`.

True ES-module files (`import`/`export`) give each file its **own** scope. Converting
this app to that model literally means:

* re-exporting all 381 functions and rewiring every one of the 227 inline
  handlers to `addEventListener`, and
* untangling hundreds of cross-references and hoist-dependent calls by hand,

on a live, business-critical app with **no automated test suite** to catch a
missed wire. A single missed reference is a runtime crash the user only sees when
they click the wrong button days later.

So the frontend is modular **at the source level** — small files by concern —
while the build concatenates the `src/app/` files **in their original order**
into one shared scope. That reproduces the exact runtime the app already relies
on (hoisting intact, every global present, every inline handler still resolving),
which is why the output is verifiably identical. You get the maintainability win
(navigate and edit small files) without betting the business app on a big-bang
rewrite.

The bundle is loaded once at the end of `<body>`, after all markup is parsed, so
every element exists before any app code runs (this was verified safe against the
original's script positions).

---

## Worked example — the Dashboard (and Lock Screen)

The Dashboard is a good template for how any screen is now spread across three
clean files instead of being buried in the monolith:

* **Markup** → `src/views/dashboard.html` — just the `<section id="sec-dash">`
  container.
* **Styles** → the dashboard's KPI/donut/chart rules live in
  `src/styles/01-base.css` and `02-components.css` (search for `.kpi`, `.donut`,
  `.bars`, `.rk`).
* **Logic** → `src/app/06-dashboard.js` — `renderDash()` plus its widget helpers
  (`kpi`, `donutSvg`, `spark`, `barsChart`, `riskChart`). `go('dash')` in
  `05-ui-shell.js` shows the view and calls `renderDash()`.

The **Lock Screen** is the same story: `src/views/lock-screen.html` for the
markup, its styles in `01-base.css`/`02-components.css` (`.auth-*`, `.lockscreen`),
and its behaviour in `src/app/13-security-lock.js` (`authSubmit`, `showLock`,
`touchUnlock`, …).

---

## How to make common changes

* **Edit a screen's layout** → the matching file in `src/views/`.
* **Edit a screen's logic** → the matching `src/app/NN-*.js`.
* **Change styling/theme** → the matching file in `src/styles/`.
* **Add a whole new screen** →
  1. add a nav link in `src/index.template.html` (`<a data-sec="mysec">`),
  2. add `src/views/my-view.html` containing `<section id="sec-mysec" class="section">…`,
     and an `<!--#include views/my-view.html-->` marker where you want it,
  3. add `src/app/19-my-view.js` with a `renderMySec()` function, and a
     `if(sec==='mysec') renderMySec();` line inside `go()` in `05-ui-shell.js`.
* **Rebuild** → `npm run build` (or just run the app / build the installer, which
  build automatically).

Always keep `src/app/` files numbered — the number is the load order, and load
order is what preserves the single-scope behaviour.

---

## Path to *true* ES modules, later and safely

The structure above is the right foundation to migrate to real ESM
incrementally, one module at a time, **once a smoke test exists** to catch
regressions. The safe recipe for a single module:

1. Add `export` to the functions in, say, `06-dashboard.js`.
2. In a small `bridge.js`, `import` them and do
   `Object.assign(window, { renderDash, /* … */ })` so the inline handlers and
   the rest of the (still-global) code keep resolving the names.
3. Switch the build for that one module to `esbuild --bundle --format=iife`
   (IIFE, not `esm` — an `.mjs`/`type="module"` loaded over Electron's `file://`
   protocol hits CORS and will not load; bundling to a classic IIFE avoids that
   entirely).
4. Verify, then repeat for the next module.

Doing it module-by-module behind a test is how you reach the fully decoupled
architecture without ever shipping a broken build to the office.

---

## Enterprise hardening (added in the QA / architecture pass)

New source files and what they add (see **AUDIT-REPORT.md** for the full audit):

```
src/app/19-sqlite-sync.js   renderer side of the ACID (SQLite) store — DB is authoritative,
                            localStorage/IndexedDB remain as cache + fallback
main.js                     + better-sqlite3 handlers (WAL + FULL sync, transactional writes,
                            in-DB rolling snapshots) and electron-updater OTA (guarded, mac-signing-aware)
preload.js                  + db* API and onUpdateStatus channel
src/index.template.html     + strict Content-Security-Policy meta tag
.github/workflows/build.yml GitHub Actions: build.js -> package mac+win -> publish release artifacts
tests/                      harness.js, audit.js, e2e-restructure.js, e2e-verify-fixes.js  (npm test)
```

The financial-math fixes are edits inside the existing modules
(`08-certificate.js`, `03-emi-schedule.js`, `04-overdue.js`, `17-restructure.js`,
`18-docgen.js`, `07-loans-crud.js`, `02-helpers-nav.js`) — each change is commented
inline explaining what it guards against.

Because `src/app/*.js` are concatenated in filename order, `19-sqlite-sync.js`
loads after the core app, so it can safely reference `loans`, `recomputeAll`,
`renderLoans`, etc. New app logic should keep following the numeric-prefix convention.
