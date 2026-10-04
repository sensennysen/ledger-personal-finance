# LED-85 · Account form: type grid, liability sign, period fields — retro (2026-09-24)

## What shipped
- An 8-cell type grid: `role=radiogroup`, arrow keys, `ACCOUNT_ICONS`. It comes first, since the type decides the fields.
- Liabilities ask for "Amount currently owed", with the sign explained where it's typed. A negative entry says it's saved the same way.
- `src/lib/accountFormHints.ts` (tested): `daysToPay` (next statement close to the due date after it, clamped for short months), `availableCredit`, `ordinal`.
- The card section previews "Statement closes the 16th, payment due the 1st — about 16 days to pay" and computes available credit live. Limit, statement day and due day are marked optional, with what's lost by skipping them.
- `loanScheduleControl()` in `accountSchema` is the one source for which control a period needs. Both `superRefine` and the form hint use it.
- A valid schedule previews as it will read on Accounts. The form uses `mode: 'onTouched'`, so errors show on blur, not only on submit.

## Acceptance
- 8-cell type grid: PASS (browser).
- Liability sign explained where entered: PASS (browser).
- Days-to-pay preview: PASS (browser, 16 + 1 gives "about 16 days").
- Each loan period's control shown live: PASS (browser; twice-monthly 15/15 shows "Choose two different due days" on blur; 15/30 previews "Twice a month · days 15 & 30").
- Available credit live: PASS (browser, $4,000 − $1,240 = $2,760).
- Optional fields marked, with what's lost: PASS.

## Backlog
- Arrow-key movement in the type grid wasn't exercised in the browser (unit logic only). LED-90 covers keyboard navigation.
- The balance-adjustment warning in the edit form still uses raw `yellow-*` classes (not in this ticket).
