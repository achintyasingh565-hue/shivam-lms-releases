# Changelog — Shivam Enterprises LMS

All notable changes to this application. Newest first.

The lending model this app implements throughout: **flat (fixed) interest**, not reducing
balance. The monthly *byaj* is `total interest ÷ tenure` and stays the same every month. When a
borrower cannot pay an EMI, that month is **deferred** — only interest and any late fee are
charged, and the instalment itself moves forward, extending the schedule.

---

## 2.2.1

### Fixed

- **Money paid before the first EMI fell due vanished from the schedule.** A payment made on the
  disbursement day, or any advance paid before instalment #1 was due, belonged to no month the
  schedule walked, so it was silently dropped and the closing balance came out too high. It is now
  credited against the first instalment. *(This one mattered: the schedule and the outstanding
  disagreed, and the schedule is what goes to the customer.)*
- **On an overpaid loan, charges could never be cleared.** The running balance capped the
  instalment portion at zero separately from the fees, so surplus payments could not settle a late
  fee and the last row of the schedule disagreed with the outstanding. The balance is now the same
  single calculation used everywhere else: `max(0, total payable + charges − paid)`.
- **Instalment numbers restarted after the tenure.** Accrual months printed as "11 ext, 12 ext…"
  directly below instalment 12, which read as an error on the customer's copy. Those months are
  accrual months, not instalments, so they no longer carry a number.

### Added

- **"Charge only from" date** on the one-click overdue button. After entering years of handwritten
  history the app would otherwise be entitled to back-charge every missed month at once; this sets
  a floor. Blank keeps the previous behaviour. The hint below says how many months were skipped.
- **Diagnostics panel** in Administration. The app was already recording faults but there was no
  way to read them — now there is, with one-click copy for a support message.
- **`safe(fn, context)`** helper so new code can guard against a failure without swallowing it
  silently, as a bare `try {} catch {}` does.
- **Accessibility pass**: every icon-only control gets a real accessible name, and the page
  landmarks (navigation, banner, main) and the three full-page sheets are labelled.
- **`tests/e2e-reconciliation.js`** — a property test over 60 generated loan shapes (varied
  amounts, tenures, rates, part payments, lump sums, interest-only months, missed months, pending
  cheques, post-tenure charges) asserting that the schedule's closing balance, the outstanding,
  and the statement arithmetic all agree. Both balance bugs above were found by this test, not by
  hand. It is wired into `npm test`.

### Changed

- The version shown in Diagnostics now comes from `package.json` at build time, like the version on
  the lock screen — it can no longer drift.
- CI: `npm ci` instead of `npm install` (reproducible installs), and `package-lock.json` is now
  committed. Publishing uses `GH_TOKEN`, since the default `GITHUB_TOKEN` cannot publish to the
  separate releases repository.

---

## 2.2.0

### Added

- **Bulk entry** for historical payments — a grid with manual control over each date and amount,
  duplicate detection, an over-payment warning, and a single-click undo of the whole batch.
- **Rapid entry** — Enter saves the payment and moves to the next, for typing years of records.
- **Global search** (Ctrl/Cmd + K) across borrowers by name, account number or phone.
- **Action centre** on the dashboard: overdue, due this week, pending cheques, charges to apply.
- **Design system** (`src/styles/08-system.css`) — shared tokens for shadows, radii, easing and
  focus rings, so the screens stop drifting apart from each other.
- Esc closes the topmost sheet; clicking the backdrop closes it where no unsaved work is at risk;
  Tab is trapped inside an open sheet and focus returns where it was on close.

### Changed

- The Payments tab was decluttered into two clickable register pages (payments, charges), each a
  full-page sheet that keeps the edit and remove actions.
- Recorded-charges list no longer truncates at 60 rows; the payments register pages in blocks of 200.

---

## 2.1.x

### Added

- **Auto-deferral of unpaid EMIs.** A month with nothing paid charges interest and a late fee and
  pushes the instalment forward, so 12 EMIs with 2 deferred months run over 14 months.
- **Manual "Overdue interest ₹/month"** override applied to every fully-unpaid month.
- **Schedule extends past the tenure**, so payments and charges recorded after the original end
  date appear and reconcile.
- Co-applicant / guarantor name on the schedule; a Late Fee column on the printed schedule, which
  now fits one page; a plain-language legend and reconciliation box at the foot of the schedule.
- Right-click cut / copy / paste in the app.

### Fixed

- Overdue interest was being calculated as a reducing rate. It is a **fixed** rate: ₹50,000 at 2.5%
  is ₹1,250 every month, whatever has been repaid.
- Recorded charges were displayed but never applied — adding, editing or deleting a charge now
  recomputes the loan, so the outstanding, schedule, reminders and reports all move together.
- Processing fees and deductions no longer reduce the outstanding. They are withheld at
  disbursement; the borrower still owes the full amount. The statement explains this in a footnote.
- A "phantom EMI" appeared each month past the tenure. Those months accrue interest only.
- A lump-sum payment was carried forward to extended months instead of clearing instalments in the
  month it was received.
- The printed statement now includes charges and reconciles against them.
