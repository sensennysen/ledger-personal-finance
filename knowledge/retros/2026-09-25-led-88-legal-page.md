# LED-88 · One <LegalPage>, three documents — retro (2026-09-25)

## What shipped (`1cd6215`)
- `src/components/legal/LegalPage.tsx`:
  - Header with a Privacy / Terms / Data deletion NavLink tab row (it sets aria-current) and "Back to Ledger".
  - 58ch article and a shared footer that links the other two documents.
  - At xl, an "On this page" rail with an `aside` slot. Below xl the rail folds into chips, and `aside` sits above the document. It uses grid-template-areas, so `aside` mounts once.
- `LegalSections` renders the numbered prose sections for Privacy and Terms.
- `src/lib/legalSections.ts` holds the section ids and ToC. The react-refresh lint rule doesn't allow a component file to export helpers.
- The atmospheric layer is deleted from all three pages, not just Data deletion; Privacy and Terms had copies too. The per-page callouts (red "Want to delete your data?", "Also see our Privacy Policy") are replaced by the tab row and footer.
- Data deletion: headings, bullets and steps 01–03 are neutral. Only step 04 and the warning box use `--expense`. The box is retitled "There is no grace period" with a warning icon; its body copy is unchanged. Legal text is unchanged elsewhere.

## Acceptance
- Single `<LegalPage>` serves all three: PASS.
- Atmospheric layer deleted: PASS. No `.absolute.inset-0.pointer-events-none` on any legal page.
- Red only for step 04 and the warning: PASS. In the browser, the only elements styled with `--expense` are "04", `#no-grace-period` and its icon, at 1920, 768 and 390.
- All three cross-link: PASS. Each page has three tabs and footer links to the other two; no overflow at any width.

## Backlog
- 24a rewrites the Data deletion copy (e.g. "press ⌘K and search for Settings", "Delete my account is the last item in the Account section"). Not done: legal text needs its own review, and the step wording should be checked against the current Settings page.
- 24a's "4 minute read" meta line.
