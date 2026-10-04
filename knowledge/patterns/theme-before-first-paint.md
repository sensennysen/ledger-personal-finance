# Set the theme in a first-party script, before first paint
The theme class was applied in a React effect, so first paint used the `:root` (light) tokens whatever was stored (LED-201).
**Why:** the CSP is `script-src 'self'`. An inline script needs `'unsafe-inline'`, which we do not allow; a file served from our own origin needs nothing.
**How:**
1. `public/theme-init.js`, a classic script (not a module) loaded from `<head>` after the `theme-color` meta and before the stylesheet and the app. It sets the `dark` class and the meta colour from `ledger-theme` and `prefers-color-scheme`, defaults to dark, and wraps everything in try/catch so it can never block the page.
2. It duplicates the logic of `themePreference.ts` in ES5, so a test (`tests/themeInit.test.mjs`) runs the file in `node:vm` against a stubbed `document`, `localStorage` and `matchMedia`, and cross-checks `parseStoredTheme` and `resolveTheme` for every stored value and OS setting. Change one, and the test fails until the other follows.
3. The same test pins `script-src 'self'` in both `index.html` and `vercel.json`. The build copies the file to `dist/` and the service worker precaches it.
4. Prove it in a browser on a probe page, not by looking at the app (see `browser-check-with-local-user.md`, item 27).
