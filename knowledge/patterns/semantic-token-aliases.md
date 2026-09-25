# Semantic aliases: re-check them when their target is re-seeded

`GOLD` was `var(--primary)`. That was gold when it was written. LED-100 re-seeded `--primary` to indigo and every GOLD site silently became "selected / active" (LED-115).

**Why:** an alias carries the meaning of the moment it was written, not of the token it points at. Nothing fails when the target changes, so the drift shows up only in the rendered UI.

**How:**
1. A meaning gets its own token (`--gold`, `--warning`), never an alias of an accent. Accent, links and active state are the only `--primary` uses.
2. When a token is re-seeded, grep for every alias and every `var(--token)` use that names a different meaning, and repoint them in the same change.
3. `tests/semanticTokens.test.mjs` fails if `GOLD` points at `--primary`, and if a status file uses `--primary` for a warning or pending state.
4. Fill vs text: a fill token (`--gold`, 3:1 as UI chrome) is not a text colour. Text on gold or its tint uses the `--warning` ink (4.5:1). Light `--gold` is `#917738`, one step darker than the design's `#9A7F3D`, which measured 2.84:1 on the page (see [[theme-token-contrast]]).
