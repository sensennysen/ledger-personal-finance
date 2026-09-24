# Theme colors: tokens, a contrast test and a rendered scan

Colors live in the `index.css` `:root` / `.dark` token blocks and nowhere else (LED-100).

**Why:** the design's own token pairs failed 4.5:1 twice: light transfer on its container at 4.43:1, and light muted ink on the page at 3.96:1. The second looked like an edge case until the rendered scan showed it on search, date headers, nav pills and page subtitles on every screen.

**How:**
1. `tests/themeContrast.test.mjs` parses both token blocks, resolves `var()` aliases and asserts 4.5:1 for each text/surface pair. When text appears on a new surface, add the pair.
2. `tests/hardcodedColors.test.mjs` fails on Tailwind palette literals (`text-yellow-600`, `bg-white/4`) and on hex/rgba/oklch in `.tsx` color props. Exceptions are `[file, line pattern]` entries with a reason. Warnings use `bg-warning-container text-warning border-warning/40`.
3. Stored user hues (categories, accounts, goals) go through `useCategoryInk()` where they are rendered. Dark steps each one a tint lighter. The data layer stays theme-agnostic, and nothing needs a migration.
4. Before calling a theme change done, run the rendered scan (with [[browser-check-with-local-user]]). Walk every visible text node, blend the backgrounds of its ancestors, and compute the WCAG ratio at 1280 and 390 in both themes. In dark, also flag large opaque backgrounds with luminance > 0.3. Expect primary buttons and meter fills to show up there by design.
5. A design value that fails gets the nearest design ink that passes, plus a comment in `index.css` naming the original value. Don't invent a new hue.
