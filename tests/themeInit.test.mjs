import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { parseStoredTheme, resolveTheme } from '../src/lib/themePreference.ts'

const script = readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8')
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))

const DARK = '#131218'
const LIGHT = '#DEDDE3'

/** Run the script against a fake page and report what it set. */
function run({ stored, systemDark, storageThrows = false, noMatchMedia = false, noMeta = false, startDark = false }) {
  const classes = new Set(startDark ? ['dark'] : [])
  const meta = { content: DARK, setAttribute(name, value) { if (name === 'content') this.content = value } }
  const window = {
    matchMedia: noMatchMedia ? undefined : (query) => ({ matches: query === '(prefers-color-scheme: dark)' && systemDark }),
  }
  const context = {
    window,
    localStorage: {
      getItem(key) {
        if (storageThrows) throw new Error('blocked')
        return key === 'ledger-theme' ? (stored ?? null) : null
      },
    },
    document: {
      documentElement: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } },
      querySelector: (selector) => (selector === 'meta[name="theme-color"]' && !noMeta ? meta : null),
    },
  }
  vm.runInNewContext(script, context)
  return { dark: classes.has('dark'), color: meta.content }
}

test('a stored light or dark theme paints that theme and its theme-color', () => {
  assert.deepEqual(run({ stored: 'light', systemDark: true }), { dark: false, color: LIGHT })
  assert.deepEqual(run({ stored: 'dark', systemDark: false }), { dark: true, color: DARK })
})

test('a System user gets the OS theme, so a light OS has no dark frame', () => {
  assert.deepEqual(run({ stored: 'system', systemDark: false }), { dark: false, color: LIGHT })
  assert.deepEqual(run({ stored: 'system', systemDark: true }), { dark: true, color: DARK })
})

test('nothing stored, an unknown value or blocked storage keeps the dark default', () => {
  assert.deepEqual(run({ stored: undefined, systemDark: false }), { dark: true, color: DARK })
  assert.deepEqual(run({ stored: 'sepia', systemDark: false }), { dark: true, color: DARK })
  assert.deepEqual(run({ stored: 'light', systemDark: false, storageThrows: true }), { dark: true, color: DARK })
})

test('no matchMedia reads as a dark system, as ThemeContext does', () => {
  assert.deepEqual(run({ stored: 'system', noMatchMedia: true }), { dark: true, color: DARK })
})

test('a page without the theme-color meta still gets its class and does not throw', () => {
  assert.equal(run({ stored: 'light', systemDark: true, noMeta: true }).dark, false)
})

test('it clears a dark class that the page already had when the theme is light', () => {
  assert.equal(run({ stored: 'light', systemDark: false, startDark: true }).dark, false)
})

test('it agrees with themePreference.ts for every stored value and OS setting', () => {
  for (const stored of ['light', 'dark', 'system', 'sepia', '', undefined]) {
    for (const systemDark of [true, false]) {
      const expected = resolveTheme(parseStoredTheme(stored ?? null), systemDark) === 'dark'
      assert.equal(run({ stored, systemDark }).dark, expected, `${stored} / systemDark=${systemDark}`)
    }
  }
})

test('index.html loads the script from the same origin, after the theme-color meta and before the app', () => {
  const metaAt = html.indexOf('<meta name="theme-color"')
  const scriptAt = html.indexOf('<script src="/theme-init.js"></script>')
  const appAt = html.indexOf('src="/src/main.tsx"')
  assert.ok(metaAt > -1 && scriptAt > metaAt && scriptAt < appAt)
})

test('the CSP allows only same-origin scripts, in the page and in the Vercel headers (no unsafe-inline)', () => {
  const metaCsp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1]
  const headerCsp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value
  for (const csp of [metaCsp, headerCsp]) {
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'))
    assert.equal(scriptSrc, "script-src 'self'")
  }
})
