# Epics 8-13 phase 4 · Disabled states (LED-119, LED-120) — retro (2026-09-25)

Branch `epics-8-13-phase-4`, one commit per ticket: LED-119 `8a666e3`, LED-120 `dedc5e2`.

## What shipped
- **LED-119:** `--disabled` and `--disabled-foreground` tokens (light `#E7E5EA` / `#7A7883`, dark `#34333C` / `#96949E`) with `--color-*` mappings. Button, input, textarea, select, dropdown-menu, command, label, input-group, switch, tabs and calendar no longer use opacity for disabled. Buttons: filled variants take the muted surface, outline and ghost stay transparent with the disabled ink, link drops its underline. Added `dark:disabled:` overrides where a `dark:` background would win. Removed `pointer-events-none` from buttons, inputs and textareas so `cursor-not-allowed` shows.
- **LED-120:** Login Google button (colours moved from inline style to classes), receipt link, 13th Month off rows ("Not counted", strike-through) and partial-month box (minus glyph at full ink), Import skipped and unselected rows ("Skipped - unparseable date", "Not selected", strike-through). New `skipReason` in `csvImport.ts` with a test. New `tests/disabledStates.test.mjs` with a self-check of the regex and a stale-entry check on the allow-list.
- `knowledge/patterns/disabled-is-a-token-not-opacity.md`.

## Deviations from the ticket
- `calendar.tsx:131` is the disabled-day modifier, not out-of-month text (`outside` at `:127` has no opacity). It now uses the token, so the allow-list is empty.
- The design's `#8A8892` is 2.79:1 on `#E7E5EA` and 2.59:1 on the page, so the light ink is `#7A7883` (3.47 / 3.21). Commented in `index.css`.
- `refreshing-region.tsx:37` (`opacity-60` while refreshing) is a loading dim with no `disabled` variant. Left alone.

## Acceptance
LED-119
- (a) No `disabled:`/`has-disabled:` opacity in `src/components/ui`: PASS (grep returns 0; guard test).
- (b) Solid tokens in both themes, at least 3:1 against their surface, tested: PASS (`themeContrast.test.mjs`, 10 new cases on 5 surfaces).
- (c) Buttons, inputs, selects, switches, tabs, textareas, labels and command items visibly distinct: PARTIAL. Rendered and measured live: buttons, inputs, textarea, select trigger, tabs (3.21:1 light, 6.23:1 dark, opacity 1). Not rendered live: switch, label, command item, dropdown and select items. Their class strings are edited and compile, and the tokens are the same.
- (d) Home, Accounts, Budgets, add-transaction dialog and Login at 1280 and 390 in both themes: PARTIAL. All were loaded and scanned in both themes at both widths, but disabled states were forced (`disabled` and `data-disabled` set by script) because the app rarely produces them. Measured 3.47:1 (light) and 4.17:1 (dark) on the disabled fill, opacity 1, `not-allowed`.
- (e) lint, build, test: PASS (437 of 437).

LED-120
- (a) No listed site uses opacity for disabled or off: PASS (`DashboardPage.tsx:349` hover fade left as ticketed).
- (b) Skipped and unselected states stay distinguishable and state a reason in text: PASS, seen in Import (light 1280, dark 390) and 13th Month (dark 1280).
- (c) Guard fails on a new disabled opacity utility and passes on the allow-list: PASS. Reintroducing `peer-disabled:opacity-50` in `label.tsx` failed the test; reverting passed.
- (d) Checked on Login, Import and 13th Month in both themes: PARTIAL. Login disabled (forced) at 1280 and 390 in both themes. Import and 13th Month screenshots read at 1280 light and dark 390 or 1280 only; the other combinations were run and scanned but not all viewed.
- (e) lint, build, test: PASS.

## Issues found in validate
- None blocking. A first mutation test failed only because BSD `sed -i` needs a backup suffix; nothing changed, the rerun with Python proved the guard.

## Backlog
- Switch, label, command item, dropdown item and select item disabled states not seen rendered. Check a disabled Switch (checked and unchecked, its thumb classes are unchanged) in the Budgets and Settings dialogs.
- The "checked, disabled" Switch look (muted track at `--disabled-foreground`) has no design frame.
- The Accounts type chips and colour swatches are bespoke buttons with no disabled styling. They use no opacity, so they are out of scope here.
- Import dialog overflows horizontally at 390 (stats grid clips "Errors" and "Likely duplicates"). Pre-existing, not touched.
- Import: the account picker shows the raw account id, not the name. Seen in the screenshot with a seeded account; check whether this is a test-data artefact (`Import to` select value not resolving) before filing.
- The 13th Month "Not counted" label sits between the date and the category separator (`Aug 16, 2026  Not counted – Freelance`). No design frame; confirm the wording and position.
- `epic-10-disabled-states-tasks.csv` is still untracked, so LED-119 and LED-120 still read To Do. Flip them when the Epic 8 to 13 CSVs are committed, as noted in the phase 2 retro.
- Real iOS device not used; none needed for this phase.
