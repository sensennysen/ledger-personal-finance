# Disabled: solid tokens, never opacity

A disabled control uses `bg-disabled text-disabled-foreground cursor-not-allowed`, not `disabled:opacity-*` (LED-119, LED-120). `tests/disabledStates.test.mjs` fails on any class token that has a `disabled` variant and ends in `:opacity-*`.

**Why:** opacity fails contrast (nav labels measured 1.98:1) and reads as broken. The design's own ink `#8A8892` was 2.79:1 on the design's own disabled fill, so the token is a darker step of the same hue, held at 3:1 on page, card, muted and the fill (`themeContrast.test.mjs`).

**How:**
1. In a class string, `dark:` rules come after `disabled:` rules in the compiled CSS. A `dark:bg-input/30` beats `disabled:bg-disabled`, so a control with a dark background also needs `dark:disabled:bg-disabled` (same for `dark:hover:` on outline, ghost and destructive buttons). Check the order in `dist/assets/*.css` if unsure.
2. Inline `style={{ background: ... }}` beats every `disabled:` class. Move the colours to classes first (the Login Google button).
3. Drop `pointer-events-none` on controls that should show `cursor-not-allowed`. A native disabled `<button>` already ignores clicks.
4. "Off" and "skipped" rows are not disabled controls, but the same rule holds: muted ink, a strike-through and a stated reason ("Skipped - unparseable date", "Not counted"). Keep the reason as a pure helper in `src/lib` so it is testable (`skipReason`).
5. Opacity that is not a disabled state (a loading dim, a hover fade) has no `disabled` variant and is not matched. If one ever does, add a `[file, pattern, reason]` entry to the guard's allow-list.
6. To see disabled states in a browser without contriving app state, set `disabled` and `data-disabled` on the dialog's controls with `Runtime.evaluate`, then read computed `opacity`, `cursor` and colour ratios. See [[browser-check-with-local-user]] and [[theme-token-contrast]].
