# Scan the rendered page for contrast, in both themes

Token tests (`themeContrast`) prove the pairs. They do not prove what a page renders: a `text-foreground/60`, an opacity, or a background layered under a card can still fail.

**Why:** LED-116, LED-118 and LED-152 each found failures no token test could (inactive tab labels at 3.55:1, treemap labels). The scan takes a minute.

**How:**
1. Sign in with the local test user (`browser-check-with-local-user.md`), set the viewport, and define a function on `window` that walks the text nodes of `main`.
2. For each visible, non-`.sr-only` text node take its computed colour, composite ancestor backgrounds until an opaque one, compute the WCAG ratio, and flag below 4.5 (3 for text of 24px or 18.66px bold).
3. Switch pages with `history.pushState` and a `popstate` event so the function survives navigation; run it once per page, then once per theme.
4. Disabled controls (LED-119 tokens, 3:1) show up; they are exempt by design, so read the list, do not assert zero.

**Watch:** an emulated `prefers-color-scheme` does not change the app's own theme; use its toggle (`aria-label="Switch to light theme"`) and set it back afterwards.
