# LED-170 · Import "Import to" shows the account name — retro (2026-09-27)

## What shipped
- `ImportCSVDialog.tsx`: the account `SelectValue` renders `Name (CCY)` from `selectedAccount`, or the placeholder, the way the row category select already renders its label. The base-ui trigger prints the raw value otherwise.
- The currency select was checked: its value is its label, so it needed nothing.

## Acceptance (dev server, seeded user, 160-row CSV)
- (a) After choosing "Big Checking" the trigger read `Big Checking (USD)` (before: the account id `56c35c6c-…`): PASS at 375, 390, 768, 1280.
- (b) After re-opening the list: PASS. After "Change file" the dialog resets the account (existing behaviour, `reset()`), so the trigger reads "Choose an account", not an id; choosing again shows the name: PASS.
- (c) Light and dark: PASS (dark by toggling the `dark` class on the document, then choosing again).

## Backlog
- "Change file" clears the account choice. LED-75 removed the auto-pick on purpose, so this was left alone; a product call if the choice should survive.
