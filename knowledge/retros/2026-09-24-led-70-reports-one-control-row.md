# LED-70 · One set of controls, not two — retro (2026-09-24)

## What shipped
- The ticket text is older than LED-21 and LED-33. The presets, the `md:hidden` Select tree and the Date Range / Saved Presets cards were already gone. What was left was a stacked header: page h1, range label, tabs, the 13th Month link, CSV and PDF.
- The tabs, the 13th Month link and one "Export" menu (CSV / PDF) now render once, inside `<PageActions>`. At md and up they go into row 2 of the shell. Below md they render inline in the same tree. The portal keeps the Tabs context.
- Removed the page's range label, which the CycleStepper already shows. The mobile h1 is now `sr-only`, because the mobile TopBar title is a `<p>`.

## Acceptance
- One control tree serves both breakpoints: PASS (code).
- The control cards are folded into the header row: PASS (code).
- Lint, build and test pass.

## Issues found in validate
- By width estimate, the phone row needs about 390px and gets 358. It now wraps below md (`a5f1717`).

## Backlog
- Not verified live (Google OAuth sign-in). Unconfirmed: the row-2 layout at 1920/1024, and the wrapped row at 390.
- 9a labels the 13th Month entry "13th Mo" on phones. It still says "13th Month Pay".
