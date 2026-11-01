# Shivam LMS v2.20.0 — response to the round-4 reviews

Two independent reviews of v2.19.0: **Codex, 9 findings; Gemini, 7.** All 16 are
implemented. One item Codex raised is deliberately **not** done and is listed at
the end with the reason.

Every claim was reproduced against the source before anything was changed.

**Before starting, at your request, I re-asserted the lending model** — the 15
rules you set yourself — and re-asserted them again afterwards. Both runs:
`ALL CORE RULES INTACT`.

```
flat interest = P x r x n                    byaj: interest payments leave the principal
total payable = principal + interest         byaj: the monthly due IS the interest
EMI = total / tenure                         byaj: no notional interest added to the debt
4% deduction: not the loan amount            flat: an interest-only payment does not reduce the balance
4% deduction: not the EMI                    flat: it is recorded as interest income
Adjustment: not the total payable            ordinary loan: outstanding
neither reduces the outstanding              ordinary loan: schedule reconciles / EMI
```

Nothing in this release changes how interest is calculated, how the 4%
deduction behaves, or how a byaj loan treats its principal.

---

## The two that mattered most

**A settled byaj loan re-opened itself every month, and grew.** Interest accrued
up to *today* instead of up to the day the principal came back. A loan closed in
January was Overdue again in February, and ₹2,000 larger every month after that
— for ever. It now stops on the repayment date.

The same fix had to leave the opposite case alone: a borrower who skipped two
months and then returned the principal still owes exactly those two months,
₹4,000 — and that figure no longer climbs either. Both cases are pinned in the
tests.

**A regression of mine, caught by Codex.** The per-version sync fix I shipped in
v2.19.0 wrote `_hash` onto the row object that gets serialised into the Supabase
request. `public.loans` has only `(id, data, deleted, updated_at, updated_by)`,
so PostgREST would have rejected **every** loan upsert — no edit would have
synced at all. The version now lives in a side map that never leaves the device.
This is the second time an external review has caught a fix of mine; both times
the error was putting state where it did not belong.

---

## Codex findings

| # | Finding | Status |
|---|---|---|
| 1 | byaj interest accrued past the principal return | **Fixed** — stops on the repayment date; a genuine shortfall is held, not grown |
| 2 | byaj payoff receipt read ₹0 against a ledger in arrears | **Fixed** — the receipt carries unserviced interest as at its own date |
| 3 | Combining byaj loans deleted the pending dues typed in | **Fixed** — carried as a named charge, which the byaj engine does add to the balance |
| 4 | `emiPaidByIndex` and the modal schedule misread a byaj receipt | **Fixed** — both use the same loan-aware rule as the engine |
| 5 | `_hash` written as a column Supabase does not have | **Fixed** — side map; the POST body is back to the four real columns |
| 6 | An in-flight upsert resurrected a loan deleted meanwhile | **Fixed** — rows re-checked against the live book after the last await |
| 7 | Restore left queued edits for loans it had removed | **Fixed** — both queues and both caches are rebuilt around the restored book |
| 8 | `pushDelete` reported nothing, so restore claimed success | **Fixed** — returns a boolean; a failed tombstone fails the reconcile |
| 9 | Taking "theirs" re-recorded the same conflict for ever | **Fixed** — the accepted copy becomes the new baseline |

## Gemini findings

| # | Finding | Status |
|---|---|---|
| 1 | byaj interest accrued after the principal came back | **Fixed** (same as Codex 1) |
| 2 | Restructure double-counted charges; repaid principal lost | **Fixed** — `tpay` is set net of the folded charges, and repaid principal is read from `l.paid` rather than `tpay − outstanding` |
| 3 | The statement's arithmetic did not add up | **Fixed** — subtracts principal repaid, reports interest serviced beside it, labels every interest receipt on screen, in print and in the CSV |
| 4 | Welcome letter ignored the restructure baseline | **Fixed** — the final instalment was the balance *plus everything already paid*; dates were anchored to the original disbursement |
| 5 | `dueToDate` reported nothing for a byaj loan; `delLoan` waved one through | **Fixed** — real months, payable and received, and they reconcile; any loan with a balance is now named before deletion |
| 6 | Modal contradicted itself on Total Interest and Amount paid | **Fixed** — a hand-set total drives the interest shown with it; "Amount paid" now means what `recomputeLoan` means by it |
| 7 | Bare `new Date(iso)` reads as the previous day in IST | **Fixed** — seven parses anchored to local midnight |

---

## Where I had to correct the tests, not the code

Three existing fixtures failed after the accrual fix. In all three the **code is
now right and the fixture was encoding the bug**:

- `e2e-interest-only-principal.js` returned the principal on 1 October and still
  expected a ninth month of interest. That month's instalment fell due on
  9 October — after the money was back. The fixture now returns the principal on
  20 October (so the ninth instalment genuinely did fall due unpaid), and I
  added the mirror case: returned before the next due date, nothing is charged.
- `e2e-round4-fixes.js` expected ₹10,000 where four instalments had fallen due:
  ₹8,000.
- `e2e-round5-fixes.js` expected ₹8,000 where four had fallen due and one was
  serviced: ₹6,000.

I have written the reasoning into each file so a future reader does not "fix"
them back.

`e2e-round5-fixes.js` also asserted the `_hash`-on-the-row shape, which was the
defect. Those assertions now pin the side map and additionally assert that
`_hash` is **never** assigned onto a row.

---

## Not done, deliberately

**The atomic-write RPC.** Codex supplied complete SQL for
`lms_upsert_loan_if_version`. I have not applied it and have not put it in the
repo as something runnable.

The precheck in `pushChanged` reads each row's server version and compares it to
our baseline before writing, which closes the common case. It is read-then-write,
so two devices writing in the same instant can still both succeed. Closing that
needs the version check inside the UPDATE, server-side.

That is a schema change on the live database holding your real borrower records,
and it is your own rule that this needs an explicit go-ahead, a fresh backup and
a test project first. I also cannot reach Supabase from here, so I could not
test it even if you said yes today.

**No conflict-resolution panel.** `cloudConflicts()` and
`cloudResolveConflict()` work and are now correct, but there is no UI for them —
a clash still needs the browser console.

---

## Verification

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run build` | clean |
| `node tools/scan-collisions.js` | 36 files, 0 duplicate globals |
| 37 offline Node suites | **all pass** |
| the same 37 under `TZ=Asia/Kolkata` | **all pass** |
| core lending rules | 15/15 intact, before and after |
| 36 modules + bundle parse | clean |
| 559 element ids | 0 duplicates |
| 157 inline handlers | all resolve |
| markup balance | 735 / 735 |
| 49 Playwright suites | **not run — no browser in this environment** |

The Playwright line is the honest limit of what I can prove here, and it is
unchanged from previous rounds. Those 49 suites cover click-paths, not
arithmetic; everything in this release is arithmetic, document text, or sync
logic, and all of it is covered by the offline suites.

`tests/e2e-round6-fixes.js` — 70 checks, one section per finding.
