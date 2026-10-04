// Runs before first paint (LED-201): sets the `dark` class and the theme-color meta, so a stored
// or system theme does not flash the other one while React starts. A first-party file, so the
// CSP's `script-src 'self'` allows it; an inline script would need 'unsafe-inline'.
// Keep in step with src/lib/themePreference.ts and ThemeContext.tsx (tests/themeInit.test.mjs
// runs this file against both).
(function () {
  try {
    var stored = null
    try {
      stored = localStorage.getItem('ledger-theme')
    } catch (e) {
      // Storage blocked: fall through to the default.
    }
    var preference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
    var systemDark = true
    if (typeof window.matchMedia === 'function') {
      systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    var dark = preference === 'system' ? systemDark : preference === 'dark'
    var root = document.documentElement
    if (dark) root.classList.add('dark')
    else root.classList.remove('dark')
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#131218' : '#DEDDE3')
  } catch (e) {
    // Never block the page: ThemeContext applies the theme once React mounts.
  }
})()
