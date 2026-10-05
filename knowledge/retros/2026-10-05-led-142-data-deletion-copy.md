# Epic 13 · LED-142 — data-deletion copy and reading time — retro (2026-10-05)

Branch `main`. OD-5 (a): the owner approved the wording in the session on 2026-10-05 before it was committed.

## What was done
- Most of the 24a rewrite had already shipped under LED-189 (owner-approved 2026-10-03). The step wording was checked against the current app; only step 02 had drifted: on a phone the account sheet's button reads "All settings", not "Settings".
- Step 02 now reads: "On a computer or tablet, click the gear icon at the top right. On a phone, tap your initials at the top and choose “All settings”, or open More and choose Settings. You can also press ⌘K (Ctrl+K on Windows) and search for Settings." (the ⌘K route is from 24a).
- "N minute read" beside the date, computed from the rendered title, intro and body at 200 words a minute, rounded up (`src/lib/readingTime.ts`, 2 tests). `LegalPage` shows it only when a page opts in (`readingTime`); only Data deletion does, so the other approved pages are unchanged. "Last updated" moves to October 5, 2026.

## Acceptance
- (a) Owner approval before commit: PASS (this session).
- (b) Each step names a control that exists: PASS, checked in the browser pane: the header "Settings" gear link (desktop), the account sheet's "All settings" and More → Settings (phone), ⌘K and Ctrl+K open the palette with "Settings" under Jump to (`metaKey || ctrlKey`), "Delete My Account" in the Account card, which is last in Settings, and "Delete Forever" enabled by typing DELETE (`SettingsPage.tsx`).
- (c) Reading time computed, not typed: PASS. The page renders "Last updated October 5, 2026 · 2 minute read"; the Privacy page still shows only its date.
- (d) Red only on step 04 and the warning: PASS, unchanged.
- (e) `pnpm lint`, `pnpm build`, `pnpm test`: PASS (1030).

## Backlog
- None.
