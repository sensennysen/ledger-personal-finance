# Epics 8-13 phase 10 · Design parity: Home, Accounts, Import, Login, Legal — retro (2026-09-26)

Branch `epics-8-13-phase-10`: LED-146, 145, 147, 144, 143 (25 points), one commit each, plus one fix for LED-145 found in the live check. Lint, build and all 617 tests pass (589 before).

## Ticket retros
[LED-146](2026-09-26-led-146-one-card-payment-path.md) · [LED-145](2026-09-26-led-145-home-pay-now.md) · [LED-147](2026-09-26-led-147-import-leftovers.md) · [LED-144](2026-09-26-led-144-login.md) · [LED-143](2026-09-26-led-143-deletion-export.md)

## Decisions worth keeping
- A card payment is a transfer (`rules/card-payment-is-a-transfer.md`); no migration. It went unnoticed since LED-24 because nobody saved one in a browser.
- Every transfer into a credit card runs the statement steps, whichever form made it.
- The deletion export is one CSV per kind, not a zip.
- Pay now exists for loan bills only.

## Live checks
Local Supabase test user, headless Chrome over CDP at 1280x900, 1280x1000 and 390x844. Card payment from three entry points, Pay now, both loan buttons, the import dialog with an ambiguous file, login in both themes with synthetic install events, the export with blocked reads, and an offline entry on Home. The live checks found three real bugs the suite did not: the locked-target Pay from gap, the export card crash, and Home not showing queued rows.

## Backlog (not verified or deferred)
- "First four widgets above the fold" cannot be met at 390x844 (LED-145 retro); decide with LED-134.
- The rendered contrast scan was not run on Login, the account page or the deletion page.
- Recurring transfers to a card skip the statement steps; editing a card payment does not adjust it.
- `signInWithGoogle` ignores its error result.
- Loan repayment duplicates were not run through the import dialog.
- Offline, the add form opens without an account until the cache loads.
- The epic CSVs and `.claude/launch.json` are still untracked; ticket statuses were not flipped.
- The local test user `phase10@example.test` was removed at the end of the session.
