# LED-151 · Theme leftovers — retro (2026-09-26)

## What shipped (`883c96c`)
- **System theme.** `ThemeContext` stores light, dark or system (`themePreference`) and keeps exposing the painted `theme` (light or dark), so `useCategoryInk`, `TopBar` and the rest did not change. A `prefers-color-scheme` listener follows the OS live. A stored value that is not one of the three falls back to dark; a new user still gets dark. `toggleTheme` flips the painted theme to an explicit choice. Settings has Light, Dark and System buttons (`aria-pressed`, wrap on a phone) and a line saying System follows the device. Pure logic in `lib/themePreference.ts`.
- **Accent contrast.** `accentTokens` (`lib/accentTheme.ts`) takes the four tones Material picked and repairs on-primary and on-container to 4.5:1 with `readableInk`. Material's ink is kept when it already reads. It stays pure because Node cannot load `@material/material-color-utilities` (extensionless imports), so `ThemeContext` reads the tones out and passes them in.
- **One swatch list.** `lib/swatches.ts` (`SWATCHES`, 15, each with a dark tint; `DEFAULT_ACCENT`). Categories, Accounts, Budgets (via `ACCOUNT_COLORS`) and the Settings accent picker use it; the last two gained five swatches. `ColorPicker` takes a `readonly string[]`.
- **`--ease-out` note** in `AGENTS.md`. No bare `ease-out` class exists in `src`, so no lint rule.

## Acceptance
- (a) Settings offers Light, Dark and System and System follows the OS live: PASS live (OS light → no `dark` class, OS dark → `dark`, OS light again → none; Settings showed System pressed, `ledger-theme` = `system`).
- (b) Custom accents keep on-primary text at 4.5:1 in both themes, tested for several hues: PASS. Unit tests cover the repair for 11 hues, all 15 swatches and the default against several bad inks. Live, on-primary was 6.4-7.8:1 and accent/on-accent 7.2-13.3:1 for six hues in both themes. The unit test cannot run Material's own tones, so the live run is the check on them.
- (c) One swatch list is used by Categories, Settings and types: PASS (`swatches.test.mjs`).
- (d) The ease-out note is added: PASS.
- (e) Lint, build, test: PASS (666).

## Backlog
- The theme is applied in an effect, so a System user on a light OS may see one dark frame on load (there is no pre-paint script; the CSP allows only `'self'` scripts). It was already true for a stored light theme.
- The `meta theme-color` follows the painted theme; not checked on a device.
- Accent contrast was checked on `--primary`/`--primary-foreground` and `--accent`/`--accent-foreground`; the sidebar and ring tokens use the same tones but were not scanned. The rendered contrast scan was not run on Settings.
- Old stored accents keep working, but a stored colour outside the 15 swatches shows as "custom", as before.
