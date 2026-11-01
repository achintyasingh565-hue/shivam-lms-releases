# Changelog — Shivam Enterprises LMS

All notable changes to this application. Newest first.

The lending model this app implements throughout: **flat (fixed) interest**, not reducing
balance. The monthly *byaj* is `total interest ÷ tenure` and stays the same every month. When a
borrower cannot pay an EMI, that month is **deferred** — only interest and any late fee are
charged, and the instalment itself moves forward, extending the schedule.

---

## 2.20.0

Sixteen defects from two independent reviews of 2.19.0 (Codex, 9 findings; Gemini, 7). Every one
was reproduced in the source before anything was changed. None of them altered the lending model:
the 15 core rules were re-asserted before and after this batch.

### Fixed — money

- **A settled byaj loan re-opened itself every month.** Interest accrued up to *today* rather than
  to the day the principal came back, so a loan closed in January was Overdue again in February and
  grew by another month's interest every month after that. Interest now stops on the repayment
  date. A loan whose interest was genuinely short still owes exactly that shortfall, and the figure
  no longer climbs.
- **A byaj payoff receipt printed ₹0 while the ledger showed arrears.** The receipt balance counted
  only principal and charges. It now carries the interest that had fallen due and not been
  serviced, so the receipt and the ledger agree.
- **Combining byaj loans deleted the pending dues typed into the merge.** The byaj engine resets
  total payable to the principal, so anything folded into the plan was wiped the moment the new
  loan was recomputed. Those dues are now carried as a named charge, which the engine does add to
  the balance.
- **A restructure charged late fees twice.** The re-planned balance already contained the unpaid
  charges, and the recompute added them again — a ₹500 fee reappeared as ₹500 of extra balance
  after every restructure.
- **A restructure also lost repaid principal.** Remaining principal was read as
  `total payable − outstanding`, which is short by every unpaid charge, so a ₹500 fee made ₹500 of
  repaid principal vanish and the combined loan carried that much too much principal forward.
- **Two schedule paths read a byaj interest receipt as an instalment paid**, so the modal schedule
  disagreed with the ledger.

### Fixed — what the borrower is shown

- **The statement's own arithmetic did not add up.** "Total payable + charges − paid = outstanding"
  was wrong by every rupee of interest ever serviced, because interest is income and does not
  reduce the balance. The line now subtracts principal repaid and reports interest serviced beside
  it; each interest receipt is labelled on the printed statement, on screen and in the CSV.
- **The welcome letter's schedule ignored a restructure.** The final instalment came out as the
  re-planned balance *plus everything already paid*, and every due date was anchored to the
  original disbursement rather than the restructure date.
- **The closing advisory told the owner nothing about a byaj loan** — it printed "instalments to
  date (0)" and "received ₹0" beside a figure he was being asked to override. It now reports the
  real months elapsed, interest payable and interest received, and the three reconcile.
- **Deleting a byaj loan with the whole principal still out passed silently**, because the advisory
  only asks whether the borrower is behind on dues *to date*. Any loan with a balance is now named
  before it leaves the books.
- **The loan modal contradicted itself in two places**: a hand-entered Total Payable left the Total
  Interest box showing a figure derived from the rate instead, and "Amount paid" counted
  interest-only receipts, making the modal's Outstanding lower than the ledger's until the next
  recompute silently corrected it.
- **Document dates could slip a day.** Three places parsed a bare ISO date, which JavaScript reads
  as UTC — before 05:30 IST the agreement and the letterhead printed yesterday's date.

### Fixed — cloud sync

- **A loan deleted while its upload was in flight came back from the dead.** The upsert landed
  after the tombstone and wrote `deleted:false` on every device. Rows are now re-checked against
  the live book after the last network wait.
- **Resolving a conflict by taking the server's copy re-recorded the same conflict**, for ever —
  the baseline was never moved on, so the next push compared against the pre-conflict version
  again.
- **A snapshot restore left queued edits for loans it had just removed**, which re-created them on
  the next flush.
- **`pushDelete` reported nothing at all**, so a restore announced success on every device even
  when a tombstone had failed.
- **A regression of my own, caught by Codex:** the per-version fix shipped in 2.19.0 wrote `_hash`
  onto the row object serialised into the Supabase request. `public.loans` has no such column, so
  PostgREST would have rejected **every** loan upsert. The version now lives in a side map that
  never leaves the device.

### Still open, deliberately

- **Atomic cross-device writes.** The precheck is read-then-write, so two devices writing in the
  same instant can both still succeed. Closing that needs a Postgres function doing the version
  check inside the UPDATE — a schema change on the live database holding real borrower records.
  Not done without an explicit go-ahead, a fresh backup and a test project.
- **No conflict-resolution panel.** `cloudConflicts()` and `cloudResolveConflict()` work; there is
  no UI, so a clash needs the console.

### Tests

`tests/e2e-round6-fixes.js` — 70 checks over all sixteen fixes. Three existing fixtures had to be
corrected rather than the code: they encoded the over-accrual this release fixes, expecting interest
for a month in which the borrower no longer held the money.

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
