# A failed chunk import is fixed by a reload, not a retry

Since LED-317, pages, the signed-in shell, the PDF export and the CSV import are separate chunks (`React.lazy` or `import()`). A chunk can fail to load: offline before it was ever cached, or after a deploy removed the file an open tab still asks for.

**Why:** in Chrome, a second `import()` of a URL that failed rejects at once, with no request. The browser keeps the failure in the page's module map. A retry helper that recreated `React.lazy` after a failure still failed with the server back up. The network log showed no new request for the chunk.

**How to apply:**
- Recovery is `window.location.reload()`. The service worker precaches the shell and every page, so a reload works offline too, then fetches the chunk when the network is back.
- `isChunkLoadError` (`src/lib/chunkLoad.ts`) recognises the Chrome, Safari, Firefox and Vite preload messages. `ErrorBoundary` uses it to say why ("offline and not saved on this device yet" or "Ledger may have just been updated") and offers Reload.
- A feature loaded by `import()` in a handler (PDF in `ReportsPage`, import dialog in `TransactionsPage`) catches the failure and notifies with a Reload action. It never fails silently.
- `main.tsx` reloads once per session on `vite:preloadError` when online. After that, the boundary explains.
- **Test it in the preview build** (`ledger-preview` in `.claude/launch.json`, `pnpm build` first). Delete one page's entry from the precache (`caches.open(…).delete`), stop the server, navigate in the app (`history.pushState` + `popstate`), and stub `navigator.onLine` for the offline wording. `preview_start` reloads the tab it opens, so run the failing case in a second tab.
- Precache rules: `deferred-*` chunks (named in `vite.config.ts` by the dynamic import they start) are left out of the precache and cached on first use (`ledger-deferred-chunks`, CacheFirst). Everything else is precached.
