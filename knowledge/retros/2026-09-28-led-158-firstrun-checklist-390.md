# LED-158 · First-run checklist step 2 is crushed at 390 — retro (2026-09-28)

## What shipped
- Only the transaction step's button group (`Import` + `Add entry`) changed: `w-full basis-full sm:w-auto sm:basis-auto` added alongside its existing `shrink-0`/`gap-2`. Inside the row's existing `flex flex-wrap` container, a full-width flex item is forced onto its own line below `sm` (640px) instead of competing with the text column for space on one line — which is what let the text column get crushed to a few characters wide before wrapping. At `sm`+ the group returns to `w-auto`/`basis-auto`, identical to today.
- Steps 1 ("Add account") and 3 ("Set your pay cycle") have a single button each and were not touched — they weren't reported broken and this keeps the diff to the one row that was.

## Acceptance
- (a) At 390 step 2 is no taller than about 130px, title wraps at most twice: **PASS by layout reasoning, not measured live.** Icon+text now share one line unsqueezed (icon `size-11`/44px + `gap-4`/16px leaves the text column most of the ~390px row width, plenty for "Record something, or import a statement" to wrap at most twice at `text-sm font-semibold`); the button row below adds one `size="sm"` (28px tall) line. No browser extension was connected this session to capture the actual rendered height.
- (b) Buttons fully visible, not covered by the FAB at scroll top: **PASS by reasoning** — row height drops from the reported ~330px to roughly a fifth of that, well clear of the FAB's usual position; not confirmed with a screenshot.
- (c) 1280 unchanged: **PASS.** `sm:` (640px) is far below 1280, so the button group's classes at that width are `w-auto basis-auto shrink-0 items-center gap-2` — the same classes as before this change, byte-for-byte.
- Lint, build, full test suite (756 + redesign checks): PASS.

## Backlog
- Screenshot step 2 at 390 (and steps 1/3 alongside it, to confirm "similar height") once a browser session is available — this ticket's layout claims are reasoned from the Tailwind box model, not measured pixels.
