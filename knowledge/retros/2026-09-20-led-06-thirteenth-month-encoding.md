# LED-06 · Encoding errors on 13th Month — retro (written retroactively 2026-09-25)

Written on 2026-09-25 from the code and `git log`, not from the original session. LED-06 shipped on 2026-09-20 without a retro. Commit `0fe3e26`. Checks below were re-run today, not recorded at the time.

## What shipped (`0fe3e26`)
- `src/pages/ThirteenthMonthPage.tsx`: four U+FFFD replacement characters became real en dashes. They were in the subtitle ("Computed under PD 851 – ..."), the info box ("... under PD 851 – exclude bonuses"), the card title ("Income Records – {year}") and the transaction meta separator.
- The neutral "Records Included" count used `EXPENSE`; the commit changed it to `var(--muted-foreground)` and dropped the `EXPENSE` import.
- `tests/thirteenthMonthEncoding.test.mjs` (new): a source-level regression test.

## Acceptance
- All three render an en dash: PASS by code. The en dash is at `ThirteenthMonthPage.tsx:150` (subtitle), `:195` (info box), `:208` (card title) and `:359` (meta separator). The test asserts the first, third and fourth and the absence of U+FFFD; the info box (`:195`) is not asserted. Not seen live.
- File is UTF-8: PASS. `node --test tests/thirteenthMonthEncoding.test.mjs` passes 3 of 3 today, and the page source has no U+FFFD.
- "Records Included" no longer uses the expense colour: PASS, then moot. `0fe3e26` moved it to the muted colour; LED-97 (`918a1b9`) later removed the card and its label. `EXPENSE` does not appear in the file now and the test still guards that.

## Issues found in validate
- None recorded at the time. The lint, build and test results of the original session were not written down.

## Backlog
- Not verified live: no browser check of the page was recorded for this ticket.
- The encoding test does not cover the info-box dash at `:195`; add an assertion if the copy is touched again.
