# LED-84 · Name the cost of borrowing — retro (2026-09-24)

## What shipped
- `getPurchaseCostPreview` and `getLoanEffect` in `src/lib/loanSummary.ts` (8 tests). The preview uses the save path's `installment × term` for total payable, `addMonthsClamped` for the final date, and the DB's balancing formula for the last installment.
- `LoanPurchaseForm` has three sections (The purchase / The financing / Where it starts) and a "What this costs" panel:
  - Total payable, split into Purchase and Interest, with "You'll pay N% more than the sticker price over T months". Negative interest (installment edited too low) and zero interest have their own sentences.
  - Schedule: first payment, final payment, last installment, opening progress "N of T" and "$X treated as already paid".
  - Adds to this loan (edit: "Effect on this loan"): outstanding now → after adding/saving, and "Monthly obligation rises to / becomes $Y across N purchases".
- Layout:
  - ≥ lg: form and panel side by side, dialog `lg:max-w-3xl`.
  - sm to lg: the panel sits below the form.
  - < sm (`useMediaQuery`): two steps, Purchase then Financing. Term moved to step 2, so term and rate share a screen at every width.
- The flat-interest note is a full sentence naming the principal and saying the effective rate is roughly double a reducing-balance loan's.
- "Already Paid" is labelled "Installments already paid", with an "of T" suffix.
- `LoanPurchaseTracker` passes `loanContext`. An edit excludes the edited purchase and counts repayments already applied to it, which matches the update trigger.

## Acceptance
- Interest named next to total payable: PASS ($2,400 at 1.25% over 24 months gives $720, 30%; unit and browser).
- Term and rate visible together: PASS (one section on desktop; step 2 on a phone, checked at 390).
- Schedule preview (first date, last date, true final installment): PASS (unit, including clamping from Jan 31; browser).
- "Already Paid" count and the adjacent currency summary both labelled: PASS.
- Effect on the parent loan: PASS. Create: $8,680 → $10,500 and $740 across 3 purchases, which matches the trigger. Edit with nothing changed: $8,680 → $8,680.

## Issues found in validate (`8c0b223`)
- "Installments already paid" was squeezed to 45px. `FormControl` renders a wrapper `div`, so flex sizing has to go on `FormControl`, not the `Input`.
- The "$X treated as already paid" text wrapped inside a right-aligned cell. It now has its own line.
- The edit dialog said "Adds to this loan". It now says "Effect on this loan".

## Backlog
- Changing from wide to narrow mid-form keeps the step state. A validation error in a step-1 field can end up hidden while you're on step 2.
- "Monthly obligation" adds up the purchases' monthly installments. It ignores the account's `loan_pay_period` (weekly or quarterly loans), just like the schedule does.
