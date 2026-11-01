# What to check after installing v2.20.0

Everything I changed, in the order I would check it. **Take a backup from the
Backup tab before you start.**

For each item: where to look, what the right answer is, and what would be a bug.
If something is wrong, tell me the item number, the borrower's A/C number, and
what the screen says versus what you expected.

---

## TIER 1 — check these first, they affect daily use

### 1. Loan modal: "Amount paid" on a byaj loan

**This will look different from before, and that is the change working.**

- Open any byaj (interest-only) loan that has interest receipts recorded.
- Look at **Amount paid**.

**Right:** it shows only money that reduced the principal — so on a loan where
the borrower has only ever paid monthly interest, it reads **₹0**.
The **Received** line below still shows every rupee that came in.

**Bug if:** the Outstanding in the modal no longer matches the Outstanding in
Loan Records for the same loan, or saving the loan changes the Outstanding.

> Why it changed: "Amount paid" is saved as the figure the ledger uses for
> `paid`, and interest receipts don't reduce the balance. It used to include
> them, so the modal showed a lower balance than the ledger until the next
> recompute quietly corrected it.

### 2. Loan modal: hand-typed Total Payable

- New loan. Enter a loan amount, a rate and a tenure.
- Now **type over Total Payable** with your own figure.

**Right:** Total Interest changes to match what you typed (your total minus the
loan amount). EMI stays whatever you set.

**Bug if:** Total Interest still shows the figure calculated from the rate, or
the EMI changes on its own, or the Outstanding doesn't follow your total.

### 3. A byaj loan where the principal has come back

The big one. Find a byaj loan that is settled — principal returned, interest was
being serviced.

**Right:** status **Closed**, outstanding **₹0** — and it stays that way next
month, and the month after.

**Bug if:** it shows Overdue, or any outstanding amount, on a loan you know is
finished.

Then the opposite case — a byaj loan where the borrower skipped months and then
returned the principal:

**Right:** it owes exactly the interest for the months that fell due **before**
the principal came back, and that figure **does not grow** next month.

**Bug if:** the figure is bigger than the months he actually missed, or it grows.

### 4. Payment receipt on a byaj loan

- Record (or re-print) the receipt for a **principal return** on a byaj loan.

**Right:** if he owed unserviced interest, the receipt's balance shows it. If
interest was fully current, the receipt reads **₹0**.

**Bug if:** the receipt says ₹0 while Loan Records shows arrears for the same
loan — those two must agree.

### 5. Deleting a loan that still has a balance

- Try to delete any loan with money outstanding. **Cancel at the warning** — do
  not actually delete.

**Right:** a box saying *"THIS LOAN STILL HAS A BALANCE"* with the outstanding
figure, which you can cancel.

**Bug if:** a byaj loan with the full principal still out gets deleted with no
warning at all.

---

## TIER 2 — check when you next do one of these

### 6. Statement of Account (Reports tab)

Print a statement for a loan that has **interest-only receipts** on it.

**Right:** the box at the bottom reads
*Total payable … + charges … − **principal repaid** … = Outstanding …*
and the figures actually add up. Below it, a line saying interest serviced is
income and is not subtracted. Each interest receipt in the table is marked
**(interest only)**.

**Bug if:** the subtraction doesn't come out to the Outstanding shown, or the
Outstanding differs from Loan Records.

Also check the **CSV export** — there's a new "Applied to" column saying
*Interest only* or *Principal / EMI*.

### 7. Restructure — the change I'm least sure of

Restructure a loan that has **a late fee or bounce charge on it**.

**Right:** after restructuring, the Outstanding equals the new planned balance
you were shown in the modal. The charge is **not** added on top a second time.

**Bug if:** the Outstanding is higher than the modal said by exactly the amount
of the charge. That is the old double-count and I want to know immediately.

Also in the restructure modal, before you apply: a **Charges levied** line now
appears, and *Total payable − paid + charges* should equal **Remaining**.

### 8. Combining loans

Combine two loans where you have **typed in pending dues** in the modal.

**Right:** the new combined loan's balance includes those dues. On a **byaj**
combine they appear as a charge line named *"Dues carried in on merge from …"*,
and the principal itself is only the principal carried over.

**Bug if:** the pending dues vanish, or the new loan's monthly interest is
calculated on principal + dues instead of principal alone.

### 9. Repayment Schedule on a byaj loan

Open the schedule for a byaj loan with interest receipts.

**Right:** interest receipts show as their own *"Interest paid"* rows and tick
**no** instalment. Only a payment recorded as a principal return counts.

**Bug if:** an interest payment is marked ✓ Paid against an instalment.

### 10. Welcome Letter on a restructured loan

Print the welcome letter / schedule for a loan you have restructured.

**Right:** the last instalment is roughly the same size as the others, and the
dates start from the **restructure date**, not the original disbursement.

**Bug if:** the final instalment is huge — several times the EMI. That was the
bug: it included everything already paid.

### 11. Closing / No Dues on a byaj loan

Try to issue a No Dues Certificate for a byaj loan that is **behind on interest**.

**Right:** the advisory shows real months elapsed, interest payable to date,
interest received, and *still to pay* — and payable − received equals still to
pay.

**Bug if:** it says "Installments to date (0)" or "Received ₹0" next to a
non-zero amount owed.

### 12. Document dates

Print the **Loan File** (agreement and promissory note) and the **Letterhead**.

**Right:** the day, month and year in the agreement text match the disbursement
date exactly. The letterhead date matches the date in the box.

**Bug if:** any of them is **one day earlier** than it should be. Worth checking
once **early in the morning before 5:30 AM** if you ever work at that hour —
that's when the old bug showed.

---

## TIER 3 — I could not test these at all here

### 13. Cloud sync (4 changes, none tested against your real database)

I have no network in my environment, so these are verified by reading the code
only:

- A loan deleted while it was uploading should stay deleted, not come back.
- Taking the cloud's version when two devices clash should settle it — the same
  conflict should not keep reappearing.
- Restoring a backup should not re-create loans the backup didn't contain.
- A restore should say *"Restored on THIS device only"* if the cloud couldn't be
  reached, instead of claiming success.

**Watch for:** a deleted borrower reappearing, a "record was edited on another
device" message that won't go away, or a loan you deleted turning up again after
a restore.

Also — and this is the important one — **the fix for my own v2.19.0 bug means
loan sync should work at all.** In 2.19.0 I had accidentally added a field
Supabase doesn't have, which would have made *every* loan upsert fail. So:

**Check that an edit on one device reaches the other.** If loan changes stop
syncing entirely, that is this bug and I need to know at once.

### 14. Anything involving clicking through the app

The 49 browser tests that cover button wiring, modals opening and saving could
not run here. If a button does nothing, or a modal won't close, or a field won't
save — that's the gap, and it's the kind of thing only you will find.

---

## What I did NOT touch

So you can rule these out:

- Flat interest is still `amount × rate × tenure`. No change.
- The 4% processing deduction still changes only the cash handed over — not the
  loan amount, EMI, total payable or outstanding. No change.
- Byaj principal is still untouched by interest payments. No change.
- Monthly byaj is still total interest ÷ tenure. No change.
- Deferral (unpaid month = interest + late fee, instalment moves forward). No
  change.
- The app's look and layout. No change this round.

I re-asserted all fifteen of these rules before and after the batch; both runs
came back intact. If one of them looks wrong, it is far more likely something I
broke indirectly than a deliberate change — report it as high priority.
