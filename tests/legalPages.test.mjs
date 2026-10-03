import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'

// LED-189: the legal pages must say what the code does. These fail when a host is added to the
// Content Security Policy, or a browser storage key is added to the code, without the matching
// line on the Privacy Policy or the Cookies and storage page (the owner approves that wording).
const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

function walk(dir) {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`
    if (statSync(new URL(path, root)).isDirectory()) out.push(...walk(path))
    else if (/\.(ts|tsx)$/.test(name)) out.push(path)
  }
  return out
}

function cspHosts(policy) {
  const hosts = new Set()
  for (const directive of ['connect-src', 'font-src', 'img-src', 'style-src', 'script-src']) {
    const match = new RegExp(`${directive} ([^;"]+)`).exec(policy)
    if (!match) continue
    for (const token of match[1].trim().split(/\s+/)) {
      if (token.startsWith("'") || token.endsWith(':') || token.startsWith('%')) continue
      hosts.add(token.replace(/^[a-z]+:\/\//, ''))
    }
  }
  return [...hosts]
}

test('the Privacy Policy names every host the Content Security Policy lets the browser contact', () => {
  const privacy = read('src/pages/PrivacyPolicyPage.tsx')
  const hosts = new Set([...cspHosts(read('index.html')), ...cspHosts(read('vercel.json'))])
  assert.ok(hosts.size > 0, 'no hosts found in the CSP')
  for (const host of hosts) {
    // The operator's own Supabase project is named as Supabase, whatever its subdomain.
    if (/supabase\.(co|in)$/.test(host)) assert.match(privacy, /Supabase/, host)
    else assert.ok(privacy.includes(host), `${host} is in the CSP but not named in the Privacy Policy`)
  }
})

// The keys the code writes to browser storage: named constants passed to localStorage, literal keys,
// and the static part of the per-user template keys.
function storageKeys() {
  const keys = new Set()
  const files = [...walk('src'), 'public/theme-init.js']
  for (const path of files) {
    const src = read(path)
    if (!/localStorage|indexedDB/.test(src)) continue
    for (const m of src.matchAll(/const \w*(?:KEY|PREFIX|DB_NAME)\w* = ['"]([^'"]+)['"]/g)) keys.add(m[1])
    for (const m of src.matchAll(/localStorage\.(?:getItem|setItem)\(\s*['"]([^'"]+)['"]/g)) keys.add(m[1])
    for (const m of src.matchAll(/localStorage\.(?:getItem|setItem)\(\s*`\$\{\w+\}:([a-z-]+)`/g)) keys.add(m[1])
    for (const m of src.matchAll(/return `([a-z0-9-]+):\$\{/g)) keys.add(m[1])
  }
  // Not a key: the marker a queued receipt's transaction carries in receipt_url while the image waits
  // in IndexedDB (ledger_receipts, listed).
  keys.delete('pending-receipt:')
  return [...keys]
}

test('the Cookies and storage page lists every key the code keeps in the browser', () => {
  const page = read('src/pages/CookiesStoragePage.tsx')
  const keys = storageKeys()
  for (const expected of ['ledger-theme', 'ledger_offline_queue', 'ledger_cache:', 'ledger_receipts', 'cc-notifs-sent', '13th-month-selection']) {
    assert.ok(keys.includes(expected), `the key scan missed ${expected}; update storageKeys()`)
  }
  for (const key of keys) {
    const listed = page.includes(key) || page.includes(key.replace(/:$/, ':…'))
    assert.ok(listed, `${key} is kept in the browser but not listed on the Cookies and storage page`)
  }
})

test('the pages make no claim the code contradicts', () => {
  const pages = ['PrivacyPolicyPage', 'TermsOfServicePage', 'DataDeletionPage', 'CookiesStoragePage', 'LegalNoticesPage']
    .map((name) => read(`src/pages/${name}.tsx`))
    .join('\n')
  // No analytics exists, and Ledger is MIT licensed (LICENSE).
  assert.doesNotMatch(pages, /analytics(?! and no usage)/i)
  assert.doesNotMatch(pages, /reverse-engineer|decompile|intellectual property of Ledger/i)
  assert.match(read('LICENSE'), /^MIT License/)
  assert.equal(JSON.parse(read('package.json')).license, 'MIT')
})

const LEGAL = ['/privacy', '/terms', '/data-deletion', '/cookies', '/notices']

test('every legal page has a route, page metadata, a tab and a link from the login page', () => {
  const app = read('src/App.tsx')
  const layout = read('src/components/legal/LegalPage.tsx')
  const login = read('src/pages/LoginPage.tsx')
  for (const path of LEGAL) {
    assert.match(app, new RegExp(`<Route path="${path}" element=`), `${path} route`)
    assert.match(app, new RegExp(`pathname === '${path}'`), `${path} metadata`)
    assert.match(layout, new RegExp(`to: '${path}'`), `${path} tab`)
    assert.ok(login.includes(`to="${path}"`) || login.includes(`to: '${path}'`), `${path} login link`)
  }
})

test('each legal page carries a last-updated date', () => {
  for (const name of ['PrivacyPolicyPage', 'TermsOfServicePage', 'DataDeletionPage', 'CookiesStoragePage', 'LegalNoticesPage']) {
    assert.match(read(`src/pages/${name}.tsx`), /const LAST_UPDATED = '[A-Z][a-z]+ \d{1,2}, \d{4}'/, name)
  }
})
