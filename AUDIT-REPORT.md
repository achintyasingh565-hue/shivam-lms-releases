# Shivam Enterprises LMS — Financial Engine Audit & Enterprise Hardening

Prepared as a Senior Financial-Software QA / Enterprise-Architecture review.
Every finding below was reproduced by running your **actual shipped functions**
(extracted by brace-matching from `src/app/`, not re-typed) inside a controllable
test harness, and every fix was re-verified the same way. The harness and the
end-to-end tests are included under `tests/` so you can re-run them any time with
`npm test`.

Reproduce everything:

```
node tests/audit.js            # unit-level edge cases against the real math
node tests/e2e-verify-fixes.js # behavioural proof of the fixes in the running app
```

---

## Phase 1 — Financial mathematics & state audit

### Severity summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A2 | Interest-only loans (`tenure = 0`) could **never** become Overdue — they showed "Active" with ₹0 arrears forever | **Critical** | Fixed |
| C1 | Arrears used `dueByToday × emi`, which overstates the final month by the EMI rounding drift | High | Fixed |
| D2 | Printed repayment schedule used **unclamped** month math (Jan 31 + 1m → Mar 3), disagreeing with the EMI table | High | Fixed |
| E2 | Duplicate / double-submitted payments were silently double-counted (no payment identity, no double-click guard) | High | Fixed |
| B1/B2 | Negative rate or negative principal produced a valid-looking contract where the customer owed *less* than the principal | High | Fixed |
| R1 | Restructure destroyed the original contract terms and kept only the *last* restructure date (no history ledger) | **Critical** | Fixed |
| R2 | A lump-sum **larger than the outstanding** rewrote `tpay`, making the books claim the customer owed more than the agreement | **Critical** | Fixed |
| T3 | Interest-income report used the post-restructure `tint/tpay` ratio, distorting booked interest after any restructure | Medium | Fixed |
| F1 | The EMI-schedule report counted `status !== 'Pending'` as paid, so **bounced** cheques showed as cleared (disagreed with the loan balance) | Medium | Fixed |
| G2 | A tiny EMI on a large balance generated up to ~1,000,000 schedule rows → UI freeze | Medium | Fixed |
| H1 | `todayISO()` used UTC, so before **05:30 AM IST** every "due/overdue" status was a day behind | Medium | Fixed |
| G1 | `build()` rendered an empty schedule for interest-only loans | Low | Fixed |

### 1. Edge cases & boundaries

**A2 — interest-only loans never went overdue (Critical).** Your own import file
contains real loans with `tenure: 0` and a manual monthly figure (e.g. A/C 16287,
₹5,00,000, "Tenure: Intt."). `recomputeLoan` looped `for(i=1;i<=n;i++)` with
`n = tenure`, so with `n = 0` **no** EMI was ever considered due — the loan sat at
₹0 arrears / "Active" no matter how long it went unpaid. Reproduced: 17 months
unpaid → `status:"Active", arrears:0`.
Fix: a `horizon` of `tenure` (or, for interest-only loans, a 50-year cap) drives
the due-date loop, and interest-only loans now accrue arrears correctly
(`status:"Overdue", arrears:₹1,27,500` in the same test).

**B1/B2 — negative inputs (High).** `calcLoanTotals(100000,-2,12)` returned
`tint:-24000, tpay:76000`; a negative principal returned a negative EMI. Fix:
inputs are clamped (`principal>0`, `rate≥0`, integer `tenure`, finite), and a
strict `validateLoanTerms()` is available for the entry points (rate > 100%/month
and tenure > 600 months are also rejected as fat-finger errors).

**D1/D2 — month-end dates (High).** The main EMI table (`repAddMonths`) already
clamps correctly (Jan 31 + 1m → Feb 28; Feb 29 + 12m → Feb 28). But the
**restructure/printed** schedule used raw `new Date(y, m+1, d)`, so Jan 31 + 1
month rolled to **Mar 3**. The two schedules disagreed on due dates for any loan
disbursed on the 29th–31st. Fix: the schedule generator's `addMonths` now delegates
to the same clamping `repAddMonths`. Verified the two paths now agree exactly.

### 2. Floating-point precision

**C2 — the model is integral.** Every monetary result runs through `Math.round`
at the source (`tint`, `tpay`, `emi`), so the ledger is always in whole rupees;
there is no fractional-cent accumulation. Verified across fractional-rate cases.

**C1 — the one real drift (High, bounded).** `emi × n` can differ from `tpay` by a
few rupees (e.g. ₹100000 @ 2.7% × 7: `emi×7 = 118902` vs `tpay = 118900`). The
schedule already absorbed this into the **last** installment, but `recomputeLoan`
computed arrears as `dueByToday × emi`, overstating final-month arrears by the
drift. Fix: expected-by-today is capped at the (forward) total payable, so both
`recomputeLoan` arrears and the schedule now sum to **exactly** `tpay`
(verified: arrears `₹1,18,900` = schedule sum `₹1,18,900` = `tpay`).

### 3. Restructure ledger integrity

**R1 — destructive history (Critical).** `applyRestructure` overwrote `tpay`,
`tint` (implicitly, via the ratio), `tenure`, `emi`, and stored only
`restructuredAt` (a single date). The original signed contract and any prior
restructure were **gone** — fatal for audit, disputes, or interest reporting.
Fix: on the first restructure the original terms are frozen into
`tpay0/tint0/tenure0/rate0/emi0`, and **every** restructure appends a full record
to a permanent `restructures[]` ledger (old/new EMI, tenure, rate, outstanding,
lump, arrears at the time, operator). Verified: after a restructure,
`tpay0 = 124000`, `restructures.length = 1`, prior payments intact.

**R2 — over-payment rewrote the contract (Critical).** Entering a lump-sum larger
than the outstanding set `newOut = 0` but then `tpay = paid + 0`, i.e. `tpay`
was inflated to equal everything ever paid — the books claimed the customer owed
**more than the loan agreement**. Reproduced: outstanding ₹1,03,334, entered
₹1,53,334 → `paid:174000, tpay:174000`. Fix: the lump is capped at the outstanding,
the excess is surfaced to the operator (preview warning + confirm dialog) and
recorded as `overpayRejected` rather than absorbed. Verified: same input now →
`paid:124000, tpay:124000, status:Closed`, excess ₹50,000 flagged.

### 4. Idempotency & duplicate state

**E1 — `recomputeLoan` is idempotent.** Calling it twice on the same loan yields
identical `paid/outstanding/arrears/status/due`. Confirmed (it is a pure
recomputation from the payments array, storing no deltas).

**E2 — duplicate payments (High).** Payments had no identity, so an accidental
double-submit (double-click, or re-recording the same cheque) was counted twice
with no warning. Fix: every payment now gets a unique `pid`; both entry points
(`recordPayTab` and the modal `addPayment`) detect an identical
date+amount+mode+cheque/ref entry and require explicit confirmation, and
`recordPayTab` has a re-entrancy guard against double-clicks. Verified end-to-end:
a repeated submit leaves `paid` unchanged.

### 5. Strict guards added

`validateLoanTerms()` (principal > 0, rate 0–100%/month, whole-number tenure
≤ 600 months); input clamping inside `calcLoanTotals`; the over-payment cap and
negative-rate rejection in the restructure `compute()`; the schedule row-count cap
(`SCHED_MAX_ROWS = 600`); the cleared-only filter alignment; and the local-time
`todayISO()`.

---

## Phase 2 — Enterprise architecture pillars

All four are implemented and, where testable headless, verified.

### 1. ACID storage — `better-sqlite3` in the main process

- New `dependencies`: `better-sqlite3`. Compiled per-OS in CI via
  `electron-builder install-app-deps` (wired as the `postinstall` script).
- `main.js` opens `lms.db` in `userData` with `journal_mode = WAL` and
  `synchronous = FULL`, and writes the whole loan book inside a single
  `db.transaction(...)` — an interrupted save or power loss can never leave a
  half-written book; the last committed state is what survives.
- Verified with your **real 54-loan import file**: full round-trip intact, and a
  deliberately failing batch **rolled back** leaving all 54 rows untouched (ACID
  holds). A rolling 30-entry in-DB snapshot table guards against accidental deletes.
- Storage model chosen: **SQLite authoritative, old storage as fallback**
  (`src/app/19-sqlite-sync.js`). On start, DB data replaces the localStorage cache;
  an empty DB is seeded from existing localStorage on first run; if the native
  module fails to load, the app silently continues on localStorage + IndexedDB.

### 2. Strict Content-Security-Policy

Injected into `src/index.template.html`:

```
default-src 'none'; script-src 'self'; script-src-attr 'unsafe-inline';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;
connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; ...
```

- `script-src 'self'` + `connect-src 'none'` mean no foreign script can load/run
  and the renderer can make **no** network requests (WhatsApp runs in the main
  process), so injected data can neither execute nor phone home.
- `script-src-attr 'unsafe-inline'` is the one concession: your UI is wired through
  227 inline `on*` handlers that call functions already in your own bundle — this
  permits *invoking your own code*, not loading foreign code.
- Verified empirically headless: **0 violations** across every screen, the schedule
  overlay, theming and PDF generation; and an attack test confirmed a remote
  `<script>`, an inline `<script>`, an eval-injected script, and a `fetch()` to an
  attacker host are all **blocked**, while the app's own inline handlers still fire.

### 3. OTA auto-updates — `electron-updater`

- `main.js` `setupAutoUpdates()` reads the GitHub Releases feed
  (`build.publish` in `package.json`), downloads in the background, and prompts
  "Restart now / Later". It re-checks every 6 hours.
- Guarded: disabled in dev; on **unsigned macOS** it does *not* silently fail —
  it shows a "new version available → download" dialog instead, because
  electron-updater refuses to auto-install unsigned macOS apps. Windows and
  (once you add an Apple Developer ID) signed macOS get true silent updates.
- `mac.target` is now `dmg` + `zip` (the `.zip` is what the macOS updater consumes).

### 4. CI/CD — GitHub Actions

`.github/workflows/build.yml`: on push to `main` (and on `v*` tags) it runs
`npm ci` → `npm run build` → `node tests/audit.js` → packages on **macOS and
Windows** in parallel, and on a tag **publishes** the `.dmg/.zip/.exe` plus the
`latest*.yml` update manifests to a GitHub Release — the exact feed the in-app
updater reads. Code-signing secrets are pre-wired as commented env vars to switch
on later. YAML validated.

---

## What you must do to activate pillars 3 & 4

1. Create the GitHub repo and push this project.
2. Replace `OWNER`/`REPO` in **`package.json` → `build.publish`** and in
   **`main.js`** (the macOS fallback download link).
3. To release: bump `version` in `package.json`, commit, then
   `git tag v1.0.1 && git push --tags`.
4. For trusted, signed installs (and silent macOS auto-update) enrol in the Apple
   Developer Program and add the signing secrets listed in the workflow comments.
   Until then, Windows auto-update and manual macOS download both work.
