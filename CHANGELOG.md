# Changelog — Shivam Enterprises LMS

All notable changes to this application. Newest first.

The lending model this app implements throughout: **flat (fixed) interest**, not reducing
balance. The monthly *byaj* is `total interest ÷ tenure` and stays the same every month. When a
borrower cannot pay an EMI, that month is **deferred** — only interest and any late fee are
charged, and the instalment itself moves forward, extending the schedule.

---

## 2.35.0

**Credit appraisal — how much can this borrower be lent.**

Loan form → Loan Terms → **Check eligibility** (beside the loan amount). Enter
the figures from the salary slip, ITR, 6-month bank statement, credit report
and property papers; the app works out a minimum, average and maximum loan the
way banks and NBFCs do, and grades the risk A–D.

- Income from salary / ITR (business ITR counted at 60–75%, as lenders do),
  never more than what actually reaches the bank.
- EMIs capped at 40 / 50 / 60% of income after existing EMIs (FOIR); average
  bank balance must cover the EMI 2× / 1.5× / 1×.
- Property capped at 40 / 50 / 60% of value — 5 points lower for shops, 10 for
  open plots — and only once the title is marked verified.
- Cuts for cheque/ECS returns, a weak bureau score or an overdue/settled
  account; the borrower's record with you (bounces, arrears, clean closures)
  counts in the score and any active loan with you is flagged.
- Knock-outs force grade D: 3+ returns with a score under 650, an overdue
  account with no verified security, age over 70 at the end of the loan.
- Interest-only loans are assessed as if repaid over 24 months.
- **Use ₹…** puts the recommended amount in the loan; the appraisal is saved
  with the loan and shown under the amount when it is reopened.
- **Print appraisal** gives an internal credit appraisal memo with a decision
  and sign-off block. It is deliberately not part of the Loan File, which goes
  to the borrower.
- Papers can be attached from the appraisal; Salary Slip and ITR are new
  document categories.
- The 40/50/60 limits are editable in the appraisal and travel with backups
  and cloud settings.

Nothing about existing loans, interest, EMI or outstanding changes.

---

## 2.34.3

**Fix: payments and edits disappearing days later.**

An edit that could not upload straight away (laptop just woke, Wi-Fi not up,
sign-in being renewed, app closed right after saving) waited in the outbox.
At the next sign-in the first sync replaced that loan with the cloud copy —
which was older — so the payment vanished from the screen, and the next save
uploaded the old copy over it everywhere.

- A waiting edit is now never replaced by an older cloud copy; it is kept and
  uploaded. A real clash with the other computer is still shown for choice.
- A sign-in renewal that fails only because the network is not up no longer
  signs the computer out. A genuinely expired sign-in now asks to sign in
  again instead of carrying on silently.
- If the app opens while offline, the first sync is retried every 30 seconds
  instead of not at all for the rest of the day.
- While a clash is waiting for a choice, saving another loan no longer
  uploads this computer's copy over the other computer's.

Interest, EMI, outstanding and every calculation are untouched.

---

## 2.34.2

Tax invoice and credit note now print in the same clean font as the payment
receipt's tables, with even-height figures; the firm name keeps its serif.
Nothing else in the app changed.

---

## 2.34.1

Release fix only — the app itself is identical to 2.34.0.

The Mac upload of 2.34.0 failed on every re-run. One Mac file (the zip's
`.blockmap`) had spaces in its name; GitHub stores spaces as dots, so on a
re-run the publisher could not find the earlier copy to replace it and gave up
with "already exists". Mac files are now named with dashes, like the Windows
installer, so a re-run can always replace them. Mac auto-update can now also
use the small differential download instead of the full zip.

---

## 2.34.0

GST tax invoices for the processing charge, and the guarantor's details in the
Loan File. Interest, EMI, total payable and outstanding are untouched by
everything here.

### Tax invoices

GSTIN 09JXBPK7550J2ZX, effective 20 November 2026. Interest stays exempt; the
processing charge is a fee for a service and carries GST at 18% (SAC 997113).

- **Issued automatically on Save** for any loan disbursed on or after 20 Nov 2026
  with a processing charge. The "saved" message names the number.
- **GST on top by default.** On a ₹2,50,000 loan: ₹10,000 + CGST ₹900 + SGST ₹900
  = ₹11,800 kept back, ₹2,38,200 paid out. A new **GST on processing** switch
  under the Processing field can set any single loan to *Included* instead
  (₹10,000 kept back, of which ₹1,525.42 is GST). A line under the switch shows
  the GST and the amount kept back before you save.
- **Net Disbursed** in the loan form and on the Welcome Letter now subtract the
  GST when it is on top. Nothing the borrower owes changes.
- **Numbered SE/26-27/0001 onward**, restarting each April; credit notes run
  SE/CN/26-27/0001. A number is never reused, even when its loan is deleted.
- **An issued invoice is never edited.** Change the charge, the GST switch or
  the disbursement date afterwards and the app asks: cancel it with a credit
  note and issue a new one, or keep it exactly as issued. Editing the borrower's
  name or address does not rewrite an issued invoice.
- **Deleting a loan** with an invoice asks whether to cancel it (entered by
  mistake) or keep it (GST still due).
- **Reports → GST Invoices**: invoices and credit notes for any month, taxable
  value, CGST, SGST and GST payable net of credit notes — the figures for GSTR-1
  and GSTR-3B. CSV and print. It lists any qualifying loan without an invoice
  (for example one saved before this version) with an **Issue invoice** button,
  and warns if two devices ever issue the same number at once.
- **Kept safe.** Every invoice and credit note is also kept in a log on the
  device, in the backup file and in the daily cloud snapshot, so a deleted loan
  never takes its tax record with it. A restore adds invoices; it never drops
  one issued since.
- **Firm Details** gains the effective date, the address exactly as on the GST
  certificate, and an email, all printed on the invoice. The GSTIN now also
  shows on every document's letterhead, as it does for a registered business.

Intra-state only (CGST + SGST): every borrower so far is in Uttar Pradesh. A
borrower outside UP would need IGST — say if that ever comes up.

### Guarantor details in the Loan File

The loan form has always taken the guarantor's father's / husband's name,
address and phone. The Loan File printed the guarantor's **name only** on the
application page, and the Loan Agreement printed blank lines for the guarantor's
father and address whatever was on record. Both now print what was entered; a
detail left empty still prints a line to fill by hand. Combining loans also
dropped the guarantor's father and address — fixed — and the Excel export now
includes them.

### Verified

49 offline suites pass, and again under `TZ=Asia/Kolkata`; the consistency fuzz
and core lending rules pass. The invoice arithmetic is checked for every amount
from ₹1 to ₹60,000 both ways. The printed invoice was rendered and checked
against the approved sample. The 49 browser suites still cannot run here, so the
new switch in the loan form has not been clicked on a real screen.

---

## 2.33.0

An EMI-day setting, and a whole-app audit. Interest, EMI and total payable are
untouched. **Outstanding changes in one case only** — a byaj loan whose charge
has been paid — and it is listed first below.

### EMI day

A loan disbursed on the 14th had every EMI on the 14th, and the only way to give
a borrower the 20th was to type a Next Due Date by hand, which changed the label
and none of the arithmetic.

Type the date in **Next Due Date** as before. If it falls in that instalment's
own month it becomes the loan's **EMI day**: that instalment and every later one
move to it, and a line under the field says so. Because the change is made in
the one function every screen asks for a due date, arrears, late-fee detection
and its grace period, both schedules, the statement, the Welcome Letter, the
agreement dates and the reminders all move together.

- Instalments already behind you keep their dates, so no past payment turns
  late or on-time after the fact. The day can be changed again later.
- The **first** instalment may also land in a neighbouring month (disbursed on
  the 28th, first EMI on the 5th). After that only the day within the month can
  change, because payments are filed by calendar month and a month with no
  instalment, or two, would lose them.
- A date further out than that — a promise date on an account in arrears — stays
  a one-off for that instalment, exactly as in 2.32.0. The arrears do not vanish.
- **↻ use schedule** puts the loan back on its disbursement day. The app's own
  safety note has told people to click that for a long time; it was never
  actually on the screen.
- Byaj loans do not take an EMI day (their interest is counted in whole months
  from disbursement), and a restructure starts a new plan, so it drops one.
- Nothing is converted behind your back: a loan whose date was typed by hand
  before this version stays as it is until you press **Make it the EMI day**.

**Both devices must be on this version.** An older build ignores the EMI day and
will show that loan's dates on the disbursement day.

### The audit

Hand-written tests cover the cases someone thought of. This release adds
`tests/fuzz-consistency.js`: thousands of random loans — flat and byaj, paid
early, late, in part, twice over, by cheques that bounced, with interest-only
months, charges and EMI days — run through the engine and through every screen
that restates its figures, failing if any two disagree by more than a rupee. It
found the following. Each also has a named, readable case in
`tests/e2e-audit-v233.js`.

**Byaj: a charge could never be paid.** *(changes outstanding)* On a byaj loan
only a payment tagged as principal ever came off the balance, and charges were
added in full for ever. A borrower charged ₹500 who handed over ₹500 still owed
"principal + 500", and when he returned the principal in full the loan stayed
open and Overdue with ₹500 outstanding. Principal is still untouched by ordinary
receipts — but those receipts service the interest due to date first, and what
has been received beyond that now goes against the charges. A byaj loan with no
charges is unaffected in every figure.

**A closed loan showed "Remaining ₹500".** Every EMI paid, a late fee settled
with the last one: the ledger had the loan closed while the schedule window and
the Welcome Letter still showed the fee as remaining, because they only counted
money that landed on an instalment.

**The closing advisory counted one instalment too many** for every interest-only
month on an EMI loan. The ledger defers the schedule by a month for each; the
"instalments to date" figure shown before closing or deleting a loan did not.

**The report schedule's Paid column did not add up.** A regular payment made in
a month that was serviced by interest reached the balance but not the Paid
column, so the column totalled less than the "Received" figure above it.

**The report schedule could close above the ledger.** When a part-paid
instalment was followed by a lump covering the later ones, the surplus sat as an
"advance" while the part-paid one was still short — ₹2 of rounding in some
loans, the whole shortfall in others.

**Byaj: interest still owed after the principal came back was missing from both
schedules.** The ledger has carried it since an earlier release; the schedules
closed at nil. They now close on the ledger's figure, on a line that names it.

**"Overdue" on the dashboard meant the whole balance.** The Overdue Amount tile,
the Action Centre's Overdue box and the notification bell all showed the full
outstanding of every overdue account — one missed EMI on a 48-month loan read as
₹4,90,000 overdue — while the Missed / Overdue tile on the same screen and the
Overdue report used the arrears. All now show the amount actually overdue.
Portfolio at Risk still uses the whole balance, which is what it measures. The
bell also showed the full balance for an EMI that was merely due soon.

### Checked and left alone

Dates parsed without a time, and `toISOString` used for a calendar date: every
remaining use is correct in Indian time and is covered by the suites run under
`TZ=Asia/Kolkata`. Every element id the code looks up exists, apart from one in
a function nothing calls. Storage is bounded everywhere it grows. The overdue
*reminder* still quotes the total outstanding, because that sentence is your
approved WhatsApp wording — say if you would rather it quoted the overdue amount.

### Verified

47 offline suites pass, and again under `TZ=Asia/Kolkata`; the fuzz passes on
every seed tried (15,000+ loans); core lending rules intact; lint, build, bundle
parse, scope and collision scans clean. Three fixtures that pinned superseded
behaviour were corrected and say why. The 49 browser suites could not be run
here, so the EMI-day line under the Next Due Date field has not been seen on a
screen.

---

## 2.32.0

Reminders that were not being raised, a wrong message in the custom blast, and a
sweep for anything that could leave the app unable to open. Interest, EMI, total
payable and outstanding are untouched; three things about **arrears, the Overdue
flag and the Next Due date** did change and are listed plainly below.

### "All the reminders are missing"

The automatic scan fired only when the day count was **exactly** 7, 3 or 1 before
an EMI, or exactly 1, 7, 15 or 30 after one. So:

- a reminder existed only if the app was opened on that exact day — open it on
  day 4 instead of day 3 and that borrower was never reminded;
- an account more than 30 days overdue was never mentioned again. A/C 16289,
  68 days overdue, could not appear: 68 is not one of the four numbers;
- which is why the panel read "You're all caught up" with overdue accounts on
  the book.

A stage is now a **window**. Four days before an EMI the 7-day stage has been
reached, so it is raised; ten days late is the 7-day overdue stage; and past 30
days the reminder returns every 30 — at 60, 90, and so on. Each stage is still
raised once, and a reminder already raised under the old rule is not repeated.

Two things had to change with it:

- **Dismiss and Clear queue now stay cleared.** They used to also forget the
  reminder had been raised, which was needed when a reminder had one day to
  exist; with windows it would have put the same reminder back each time the
  screen opened. **Run scan now** is the deliberate way to bring back
  everything still due.
- **Nobody is queued for a message they were already sent** in the current
  stage — checked against the WhatsApp history, so a reminder sent from the
  custom blast counts too. A failed send does not count.

### Custom blast sent an overdue demand for an EMI that was not due yet

Under "Due soon", Mrs. Shalu's row read: *"…was due on 20-11-26 and is now
overdue. Your outstanding amount is ₹4,90,000"* — on the 16th, four days before
that date, quoting the whole balance of a 48-month loan in place of one EMI.

The wording was chosen on the account's status alone. It now follows the date:
an instalment dated today or later is an **EMI reminder** with the EMI amount,
whatever the status; the overdue wording needs the account overdue **and** the
date behind us. The automatic scan uses the same rule — before, an account in
that state fell between the two branches and got no reminder of either kind.

### Why that account was flagged Overdue at all — two engine faults

**A charge that had been paid still counted as arrears.** Charges are kept as
line items, and arrears added every one ever raised, for ever. A borrower
charged a ₹500 late fee who paid it — every EMI up to date — still carried
"arrears ₹500" and an Overdue badge until the loan closed. The balance already
treats money as money (payable + charges − received); arrears now do too: what
has been received beyond the instalments due to date has gone against the
charges. An **unpaid** charge is still arrears exactly as before.

**A Next Due Date typed by hand was only a label.** The schedule counts from the
disbursement date, so a loan disbursed on the 14th has its EMI on the 14th. Type
the 20th and the screen said "Next due 20-11" while the arithmetic had already
counted the EMI as due on the 14th — a new account went Overdue six days before
the date printed beside it. Now:

- while the typed date is still ahead, and that next instalment is the *only*
  one the schedule counts as due, it is not yet due. Deliberately narrow: an
  account two or more instalments behind is unchanged — a typed date there is a
  promise to pay, not a reason to stop calling it overdue;
- a typed date used to freeze for ever. Once it has passed and the next unpaid
  instalment falls after it, the schedule takes over again. Before, the screen
  kept the old date, no EMI reminder was ever raised for that account again,
  and the next missed EMI was announced as overdue since a date that had been
  paid.

What this does **not** give you is a real "EMI day" setting. A loan disbursed on
the 14th still has its *following* instalments on the 14th.

### A/C 16289 — ₹25,000 against your ₹22,600

Not an arithmetic fault. 69,600 payable − 48,500 received = 21,100; your two late
fees and the bounce make 22,600. The other **₹2,400 is two "Overdue interest"
charges of ₹1,200** — one month's interest (9,600 ÷ 8) for each month in which
nothing was paid, added when overdue charges were applied with interest
included. They are ordinary lines in that loan's Charges list and can be removed
there. Any loan where overdue interest was applied carries the same kind of
line. Reproduced in the engine and pinned by a test.

### Things that could have left the app unable to open

**One bad record stopped everything.** `recomputeAll` runs before every screen is
drawn and was a bare loop: one record the engine could not work out — a null
inside a payments list from a half-written cloud row, a date stored as a number
— threw out of it and took every other loan and the navigation with it. Each
loan is now worked out on its own; a bad one is reported once in Diagnostics
and the rest carry on. The engines themselves no longer throw on those entries.

**Four of the six ways the book is replaced did not check what they read.**
Startup and backup-file restore repaired incoming records; rows from the other
device, a cloud snapshot, the in-app snapshot and the IndexedDB mirror went
straight in. All six now repair: non-records are dropped from payment and charge
lists, timestamps and DD-MM-YYYY dates are converted, a number or object in a
date field is emptied. A healthy record passes through byte-for-byte.

**A correct recovery password could be refused.** The sign-in accounts are
encrypted with the Mac's keychain. If the keychain is reset, or the data folder
is moved to another Mac, they cannot be read — and recovery then answered a
correct recovery password with "No Administrator account found". It now
re-creates the Administrator account once the recovery secret is verified, and
sign-in explains what has happened instead of "Incorrect username or password".

**Smaller:** the date helpers no longer throw on a non-text date or print
"NaN-NaN-NaN"; the expense, recycle-bin, message-history and audit loaders
always return a list.

### Not changed, and why

`main.js` has no handler for the page process crashing, and the menu that would
offer Reload is removed, so a crashed window stays blank until the app is quit
and reopened. That file is outside `src/`, which is the agreed edit area.

### Verified

44 offline suites pass, and again under `TZ=Asia/Kolkata`; core lending rules
intact; lint, build, bundle parse, scope and collision scans clean. Two test
fixtures that asserted the old reminder rule were corrected and say so. The
browser suite for "dismissed reminder returns on re-scan" was updated to the
new behaviour but, like the other 48 browser suites, could not be run here.

---

## 2.31.0

Everything here is about what survives a machine being replaced or reset. No
change to the lending model, and no change to the Supabase schema.

### The manual backup button was the weakest backup the app made

This is the one that mattered. **"Backup (.json)" wrote a bare array of loans —
nothing else.** No expense register, no firm details, no recycle bin, no message
templates, no audit log. Meanwhile the *automatic* backup to your chosen folder
has always written the full payload, and the restore has always been able to
read it. So the backup you take deliberately, before wiping a computer, was
worse than the one the app takes on its own.

It now writes exactly what the automatic backup writes, and tells you the record
count and file size when it's done.

### Fee settings now travel with the book

Late fee, bounce fee, grace days, manual overdue interest and its start date,
and the light/dark theme used to live only on the machine that set them. A
replaced laptop came back with your loan book intact and your fee rules silently
reset to their defaults — which is the kind of wrong that isn't noticed until a
charge comes out at ₹500 instead of ₹750.

They now ride in both the backup file and the daily cloud snapshot (bumped to
v3). Older snapshots still restore: a v2 has no settings key and is simply left
alone, and a legacy bare-array snapshot loads as before.

They're stored as raw strings, exactly as the app writes them — not JSON-wrapped
— because `getLateFeeRate` and its siblings do `Number(raw)`, and a quoted
`"750"` would read as NaN and fall back to the default. There's a test pinning
that specifically.

**What deliberately does not travel:** the WhatsApp token, the ID-encryption
passphrase and the user roster. The token is a live credential to your Meta
account; the passphrase is the key to the ID fields sitting encrypted in that
same cloud, so storing it beside them would leave you with the appearance of
encryption and none of the substance.

### Scanned documents can go in the backup file

The KYC scans live in this device's IndexedDB and are never synced. There was
already a separate vault backup button; the problem was remembering to press it.

There's now a tick-box on the backup screen — **"Also include scanned
documents"** — that folds every scan into the one file. Off by default, because
base64 scans turn a 200 KB backup into tens of megabytes. Restore is additive
and skips duplicates, so restoring the same file twice is harmless, and a
backup made before this version restores fine with no documents in it.

The warning on that screen now says plainly that the scans are gone if the
machine is wiped without either the tick-box or the separate vault backup.

### Verified

42 offline suites pass, and again under `TZ=Asia/Kolkata`. Core lending rules
intact. Lint, build, bundle parse, scope and collision scans all clean. 569
element ids with no duplicates, 735/735 divs balanced.

---

## 2.30.1

### Festival greetings: the app was telling you they were sent when it did not know

This is the answer to why reminders arrive and greetings do not.

WhatsApp sorts every approved template into **Utility** or **Marketing**, and delivers them
under different rules. Your reminders — `emi_due_reminder`, `overdue_reminder`,
`payment_received` — are utility: attached to a transaction, so they go through. Your
`festival_greeting` is **Marketing**, confirmed in WhatsApp Manager.

A marketing template is rate-limited per recipient: WhatsApp limits how many marketing
templates one person receives **from this business** in a period, and limits hardest for
people unlikely to reply or engage. Over that limit it **accepts** the message, returns HTTP
200 with a message id, and then declines to deliver it. The refusal is error **131049**,
reported on the "messages" status webhook — which needs a public HTTPS server this desktop
app does not have and cannot have. So the app is never told.

WhatsApp Manager shows it under **Insights › Ecosystem health**, as *"Meta chose not to
deliver"* with a count. That screen is the only place the real outcome is visible, and the
app now points you at it.

The app was writing that 200 response into Message History as **"Sent"**, which read as proof
of delivery. It was never that. It only ever meant WhatsApp took the message.

It worked before because WhatsApp re-categorises templates — a greeting first approved as
Utility gets moved to Marketing with as little as one day's notice. Nothing in the app caused
it, and nothing in the app can undo it.

**What changed — wording only, sending is untouched:**

- History now records and shows **"Accepted"**, with a tooltip saying delivery is not
  confirmed here. Entries recorded before this version still read correctly.
- Greeting, birthday, office-closure and business-launch messages carry a visible
  **"may not be delivered"** note in History. Reminders and payment confirmations do not.
- Before sending a batch containing any of those four, a box explains the cap and asks
  whether to send anyway. You can still send.
- The toast and the audit entry say *accepted*, not *sent*.

**Your options, none of which the app can do for you:** request a category review of
`festival_greeting` in WhatsApp Manager; send greetings to fewer people at a time, since the
limit is per recipient and weighted by how often that person replies to you; or send them
from WhatsApp directly, where a personal message is not a template and no limit applies.

### The core lending rules are now a committed test

The 16 assertions I re-run after every change — flat interest, the 4% deduction, byaj
principal, interest receipts, reconciliation — lived in a scratch file and had to be rebuilt
from memory each session. They are now `tests/core-lending-rules.js` and run with everything
else. 40 offline suites.

---

## 2.29.0

A verification release. No new features and no change to the lending model — this is the
result of going back through 2.28.0 looking for what I had got wrong, and I found four
things. All four were in my own colour work; none of them had shipped yet.

### The logo would have been an empty navy square

The monogram's ink is **navy** — sampled from the file, the dominant colour is rgb(0,28,56).
When I restyled the brand block I set the plate behind it to `#061832`, which is the same
navy. Contrast of the S against its own plate: **1.03:1** — invisible. The same mistake was
in the sign-in page's seal.

Both now keep the cream plate the printed logo uses, which gives the navy **14.3:1**, with a
thin brown edge because cream on the gold panel is only 1.07:1 and the tile would otherwise
have had no shape.

This is the one I am most annoyed about: the contrast audit I ran on 2.28.0 only measured
*text*, so an image sitting on a background of its own colour went straight past it.

### Fourteen of my seventeen sidebar rules were being overruled

`.sidebar .nav a:hover` with `!important` exists in both `03-glass.css` and `06-redesign.css`,
and `01-base.css` carries `html.dark #nav a:hover` — an **ID**. My replacements were written
with classes only, so the old navy-sidebar colours would have won and the menu would have
rendered white text on the new gold panel.

Every rule has been rewritten as `html body .sidebar #nav …`, duplicated for `html.dark`. A
cascade resolver run against all eight stylesheets in load order now reports **0 of my rules
losing**, across 28 surfaces in both light and dark mode.

### The totals row was unreadable in dark mode

`table.data tr.tot td` put navy text on a gold wash. Against the dark panel that is
**1.17:1**. Dark mode now gets its own rule — gold text on a faint gold wash, **13.9:1**.

### A section label just missed the line

Burnt gold `#8a5204` on the dark-mode panel's lower stop measured 4.34:1. The labels are
10.5px uppercase, so they need 4.5:1. Darkened to `#7d4a03` — **5.00:1** dark, 6.53:1 light.

### What was verified before release

- 39 offline test suites pass, and pass again under `TZ=Asia/Kolkata`
- the 15 core lending rules re-asserted — flat interest, the 4% deduction, byaj principal
- lint clean, build clean, bundle parses, all 36 modules parse
- 568 element ids with no duplicates, 735/735 divs balanced, every inline handler resolves
- no scope leaks (`tools/scan-scope.js`), no duplicated globals (`tools/scan-collisions.js`)
- every foreground on the two gold panels measured: **lowest 4.60:1**, nothing below threshold

**Not verified:** the 49 Playwright suites still need a browser I do not have, and I could not
render the interface to look at it — so the *balance* of the gold panel against the content
area is still something only you can judge on screen.

---

## 2.28.0

### The sidebar is now gold, not navy

I had read "#fff3a6 in the sidebar" as an accent colour and used it on text. It meant the
**panel background**. Both the application sidebar and the sign-in page's side panel are now
`#fff3a6`, and everything on them has been re-coloured for a light surface:

- menu items in deep navy, section labels and icons in burnt gold
- hover is a wash of navy rather than of white
- **a selected tab is a navy pill that glows** — a gold edge marker with a soft halo, gold icon and
  cream label. On a gold panel, navy is the only thing that reads as "selected".
- the brand mark keeps a navy plate behind it, because the monogram's gold E needs a dark ground

Every rule in the base stylesheet assumed a dark panel — white text, white-alpha hovers, dark
borders — so each one is answered individually rather than left to cascade.

**Contrast was measured, not eyeballed.** Every element on the gold panel passes WCAG AA; the
lowest ratio is 5.10:1 (the version line) against a 4.5 requirement, and the selected tab reaches
16.28:1.

### Customers & Loans

- **The New / Earlier headings now always appear.** They were only shown when a borrower had both
  kinds, so a borrower with a single new loan looked no different from one with an old loan — which
  is exactly the case you were looking at. The heading is the confirmation.

---

## 2.27.0

### Sidebar

- **The brightest gold (#fff3a6) now marks the live item** — the active section's label, icon and
  edge marker, plus hover. Resting rows stay quieter so the active one actually stands out rather
  than competing with eight others.
- **The build number sits under the firm name** in the footer. It is substituted from
  `package.json` at build time, so it can never drift from the real version.

### Customers & Loans

- **Borrowers are numbered.** The list was already in A–Z order; each card now carries its position
  as a small gold chip, so a borrower can be referred to by number.
- **A borrower's loans are grouped New / Earlier.** Recent lending was getting lost among older
  records. Each table now splits under two headings — and the headings only appear when both groups
  have rows, so a borrower with a single loan still sees a plain list.

### Dashboard

- **"New Business (from Oct)" is now just "New Business."** The badge tooltip no longer names a
  date either; it explains the distinction instead — new business as opposed to a historical record
  entered at setup.

The 1 Oct 2026 boundary itself is unchanged and still drives the figure. I briefly replaced it with
a rolling 90-day window and reverted that: the date is not arbitrary, it separates real lending from
the historical records keyed in during setup, and a rolling window would have erased that
distinction after three months.

---

## 2.26.0

### Brand

- **The logo is now the SE monogram alone** — no ring, no wordmark — cut from the artwork and keyed
  to a transparent background, so it sits on any surface. It is the app icon on macOS and Windows,
  the PWA icon, and the mark on the lock screen, the sign-in card and the sidebar.
- **The monogram's S is navy, so on the navy sidebar it would disappear.** In dark contexts it sits
  on the same cream plate the printed logo uses. On light surfaces it stands alone.
- Quantising the icons to PNG8 with alpha cut them from 56 KB to 8 KB of base64; the bundle came
  *down* 26 KB despite the new artwork.

### Interface

A pass over the whole shell, **in CSS only** — no markup and no script was touched, so none of it
can reach the loan arithmetic:

- **Tables** — a soft navy-on-ivory header, alternating ivory rows, a clear hover, and a gold-tinted
  totals row. Money columns now use tabular figures so digits line up down the column.
- **Figures** — KPI numbers enlarged and set in brand navy with uppercase labels; the first tile in
  each row carries a gold top edge so the eye has somewhere to land.
- **Panels** — a longer, softer shadow that lifts slightly on hover.
- **Sidebar** — gold section labels, more air between items, and an active item lit with a gold wash
  instead of blue.
- **Topbar** — a faint gold rule across the very top of the application.
- **Forms** — focus rings in brand navy (gold in dark mode) rather than a generic blue.
- **Modals** — a gold hairline under the header, deeper shadow, rounder corners.
- **Empty states** — the monogram as a 4% watermark.

Everything above is appended to `src/styles/07-brand.css` as one block. Deleting that block returns
the app to its previous appearance exactly. Printed documents are explicitly excluded.

---

## 2.25.0

### Brand

- **The Shivam Enterprises emblem is now the app's identity.** It replaces the lettered "SE" marks
  on the lock screen, the sign-in card and the sidebar, and it is the application icon on macOS and
  Windows and in the PWA manifest.
- **The palette is sampled from the emblem**, not chosen by eye: the navy field (#061832), the cream
  plate (#f7e8d7) and the five stops of the gold bevel, from the #fff3a6 highlight down to the
  #7a4700 shadow.
- **Gold is used in four places only**, where it reads as finish rather than decoration: the
  wordmark, a hairline under the page title, the active section marker, and a shorter hairline
  under each panel heading. Primary buttons keep a navy body with one lit top edge. Printed
  documents are untouched.

Technical notes: the emblem is masked to a transparent disc so it sits cleanly on light and dark
surfaces — the square source would otherwise box it in. The in-app copy is a 256px file under
`src/assets` rather than an inline data URI; only the two manifest icons are embedded, at 192px and
128px, which costs the bundle 8 KB.

---

## 2.24.1

### Build pipeline

- **Silenced the GitHub Actions Node 20 deprecation warning.** `actions/checkout` and
  `actions/setup-node` bumped v4 → v5 in all three jobs (test, boot-smoke, build). v5 runs on
  Node 24, which is what the runner was forcing them onto anyway. A warning only — builds were
  never failing.
- **`node-version: '20'` is deliberately unchanged.** That is the Node the app is *built* with, not
  the Node the action runs on, and the warning did not concern it. Changing it could alter how
  Electron packages the app, so it stays until there is a reason to move it.

---

## 2.24.0

### Removed — Hindi borrower names

The "Name in Hindi" field, the automatic transliteration, the learned-corrections map, the bulk
"Suggest Hindi names" tool and the Hindi substitution of occasions are **all removed**.

They produced bad output on real names: **Chaudhary** came out as चुधरय, **Kajal** as कजल, and
**M/S M.A. Enterprises** as मस मा एंतेरपरिसेस. Roman spelling does not say whether a vowel is long
or short, so rules cannot resolve it, and a mangled name in a customer's message is worse than an
English one.

**From now on: the message TEMPLATE is Hindi; the name, the occasion and every other value go out
exactly as recorded, in English.** Nothing else about messages changed.

Any `nameHi` already stored on a loan is simply ignored — no record is altered.

### Fixed

- **The firm name was spelled two ways in the shipped wording.** शिवम एंटरप्राइजेज in the
  loan-closed Hindi template against शिवम एंटरप्राइज़ेस in the other 22. Now consistent.

### Added

- **Restore Default Wording** button in Administration › Message Wording Templates. Saved wording
  overrides what ships with the app, so a correction in a new version could never reach a book that
  had been edited. This puts the shipped text back, after a confirmation that names what is lost.
  Borrowers, loans and payments are untouched.

---

## 2.23.0

### Fixed

- **A blank field silently lost the message.** An Office Closure sent with the Date box empty went
  to WhatsApp with an empty `{date}` value, and Meta rejected it — *(#131008) Required parameter is
  missing*. The message was gone and the only trace was a Failed row in History. The app now checks
  every selected message before the first API call, **stops the whole batch**, and names the empty
  field and who it affects. A half-sent batch is worse than none.
- **The Hindi name stopped keeping up with the English one.** The suggestion refused to touch a box
  that already had anything in it, so typing "Achintya", then adding " Kumar", left the Hindi name
  at अचिंत्य. It now refreshes while the value is still a suggestion of ours, and stops the
  moment you edit it yourself or the record is loaded from the book — a name you typed is never
  overwritten.

### Not a defect: festival greetings arriving once, then not at all

Confirmed as Meta's **per-user marketing frequency cap**. Festival greetings are a Marketing
template; Meta limits how many marketing templates a person receives in a rolling window, counted
across *every* business that messages them, and silently drops the rest — the API still returns
success. This is why the first greeting arrives and later ones do not, regardless of language, while
EMI reminders and payment confirmations (Utility templates) are unaffected. There is nothing to fix
in the app.

---

## 2.22.2

### Fixed

- **A fault could flash on screen and leave no record.** The app has two error handlers. One
  records to the Audit Log and Diagnostics; the other shows the toast that names the file, and
  recorded nothing. So the message seen on screen was the one that logged nothing — which is why
  Diagnostics and the Audit Log were both empty after a visible fault. The notifying handler now
  records as well, for both thrown errors and rejected promises. reportError de-duplicates, so the
  two handlers cannot double-log.
- **The toast also pointed at the wrong panel** — it said "Audit Log" when the stack trace lives in
  **Administration › Diagnostics**. Both toasts now name Diagnostics.

Proven by replaying the exact fault: the toast reads
`⚠ Something went wrong: _dispName is not defined [11-reminders.js:176]` and the log now holds
`{where:'11-reminders.js:176', msg:'_dispName is not defined'}`.

---

## 2.22.1

### Fixed — a regression I introduced in 2.21.0

- **The EMI / Overdue reminder list stopped building.** A helper I wrote inside `renderGreetings`
  was also called from `renderReminders`, where it was not in scope. The resulting
  `ReferenceError` aborted the list, so the Reminders view came up empty and the brief
  "Something went wrong" toast appeared. The helper is now defined at module scope and takes the
  language as an argument.
  **Greetings were never affected by this** — the helper was in scope there.
- **A fault in a message view vanished instead of being recorded.** The three message renders were
  called bare, so a throw killed the view without reaching the log. They now go through `safe()`,
  which records the fault in Diagnostics and lets the other views render.
- **The error toast pointed at the wrong panel.** It said the fault was "recorded in the Audit Log
  (Administration)" when the stack trace is in **Administration › Diagnostics**. It now names both.

### Added — so this class of bug cannot ship again

- **`npm run scope`** (`tools/scan-scope.js`). `no-undef` is off for `src/app` by design — the app is
  one shared global scope, so it would flag every cross-file call. But in the **built bundle** every
  real global is a top-level declaration or a `window.*` assignment, so anything still unresolved is
  a genuine scope leak. Verified by reintroducing the bug: lint stayed clean, all 39 suites passed,
  the bundle parsed — and this tool named `_dispName` immediately.
- **`tests/e2e-message-list-builds.js`** — runs `renderReminders()` and `renderGreetings()` for real,
  in English and Hindi, across all 14 greeting types, and asserts each produces rows with a usable
  name. The earlier tests only checked source text, which is why none of them caught this.

---

## 2.22.0

### Added

- **Hindi names are now suggested, not typed.** Typing a hundred borrower names in Devanagari on a
  desktop keyboard is not realistic, so the app fills a suggestion from the English name and you
  correct it. Three parts:
  - **In the loan modal**, leaving the Borrower Name box fills the Hindi box — but only if it is
    still empty. Anything you have typed is never overwritten.
  - **In Administration**, *Suggest Hindi names for all borrowers* fills every record that has none,
    after showing you five examples and asking. Existing Hindi names are left alone.
  - **It learns.** Correct a name once and that spelling is used for every borrower sharing the
    word. Fix "Nishad" on one record and every other Nishad is right from then on.
- **Occasions are translated for Hindi messages.** The Occasion box is shared by both languages, so
  typing *Diwali* now produces दीपावली in a Hindi message and *Diwali* in an English one. Around 30
  common occasions are recognised; Devanagari typed straight into the box is passed through.

### How good are the suggestions

About 150 common Indian names and surnames are built in and come out right. Anything outside that
list is transliterated by rule, which handles gemination (Munna → मुन्ना), homorganic nasals
(Phoolchand → फूलचंद) and word-final vowels (Chaturvedi → चतुर्वेदी), but **cannot resolve the
long/short vowel ambiguity in Roman spelling** — "Ram" could be रम or राम and nothing in the
spelling says which. **Treat every suggestion as a draft and check it before sending.** The
learning map is what makes this workable at a hundred names: you correct each surname once.

Documents are untouched throughout — the loan file, agreement, promissory note, notices and
certificates all continue to use the English name.

---

## 2.21.0

### Fixed — messages

- **A Hindi message carried an English borrower name.** `{name}` resolves from the one name field on
  the loan record, which is also what prints on the loan file, the agreement, the promissory note
  and every notice and certificate. Editing the Hindi template could never change it, and renaming
  the borrower in Hindi would have put Hindi names on documents that may end up in court. There is
  now an **optional "Name in Hindi" field** on the borrower tab, used *only* when the message
  language is Hindi, falling back to the English name when it is blank. Nothing else reads it —
  every document is unchanged.
- **An unrecognised placeholder was sent to the borrower verbatim.** The substitution returned the
  token unchanged when it wasn't in the map, so a template edited to use `{tenure}` or `{bank}`
  WhatsApped a customer the literal text `{tenure}`. Unknown tokens are now dropped, and the double
  space and the space-before-punctuation they leave behind are tidied — including before a Hindi
  danda (।).
- **`{tenure}`, `{bank}`, `{txn}` and `{loanid}` were missing from the base variable map** and only
  resolved for the handful of message types whose own variable list happened to carry them. All
  four now resolve for every type. `{tenure}` uses the product-aware wording, so a byaj loan reads
  "Monthly, until the principal is repaid" rather than 0.
- **The WhatsApp send path now carries the row's language**, so an edited Hindi message keeps the
  Hindi name when it is actually sent rather than reverting on the way out.

### Checked, no defect found

All 16 English templates have a Hindi counterpart, and every en/hi pair uses an identical set of
placeholders — verified by comparing the two sets template by template.

### Tests

`tests/e2e-hindi-name-templates.js` — 33 checks, including a sweep that renders **all 32 shipped
templates** and asserts none leaves an unresolved token, and that every Hindi template carrying
`{name}` shows the Hindi name and not the English one.

---

## 2.20.1

### Fixed

- **Byaj (interest-only) loans printed a bare "0" where the instalment count belongs.** A byaj
  loan has no tenure — the borrower services the monthly interest and the principal stands until
  he returns it — so every document that printed `tenure` put a zero on a page meant to be signed:
  *"repay the Loan with interest in **0** monthly instalments of Rs. 2,000"*, *"Monthly instalment
  Rs. 2,000 × **0**"*, *"Tenure 0 months"*, *"Balance Instalments 0"*, *"This loan has 0 EMIs"*.
  A clause stating zero instalments states nothing.

  Byaj loans now get their own wording everywhere: the Loan File agreement, the Loan Documents
  agreement, the Schedule of Loan, the Statement of Account, the Welcome Letter, the EMI schedule
  legend and the WhatsApp `{tenure}` variable. The agreement clause now reads that interest of
  Rs. X is payable monthly until the principal of Rs. Y is repaid in full, and that the principal
  does not stand reduced by any payment of interest — which is what was actually agreed.

  **Wording only. No stored figure changed** — `tenure` is still 0 in the data, and the monthly
  interest, the principal and the outstanding are all exactly as before.

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
