# LED-79 · Detail below lg — retro (2026-09-24)

## What shipped
- Detail left the Dialog it shared with Add and the account menu. That Dialog now opens only for `'add' | 'account'`, and its title no longer has a detail branch.
- Detail has its own `Sheet` at every width short of 1920: a bottom sheet on phones (max 85dvh, rounded top, safe-area padding) and a 380px side sheet on tablet and desktop. It shares that surface with the LED-99 overlay.
- Actions close the sheet first, then hand off, so Edit opens the form on a separate surface.

## Acceptance
- Transaction detail renders as its own surface (dialog/sheet) below lg, distinct from the edit form: PASS in code. `tests/layoutGeometry.test.mjs` checks that the shared Dialog no longer renders `EntryDetail`.
- Lint, build and test pass.

## Issues found in validate
- The ticket was partly stale. Below lg, tapping a row already showed `EntryDetail`, just inside the add/edit modal. So the real work was a separate surface, not stopping the jump to the edit form.

## Backlog
- Not verified live (Google OAuth sign-in). Unconfirmed: the bottom sheet at 390 (height, close button, FAB hidden while open), the side sheet at 768, and focus return to the row after close.
- The shared Dialog has a drag-to-dismiss handle on mobile; the detail bottom sheet does not.
