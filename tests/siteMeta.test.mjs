import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeSiteUrl, headTags, sitemapXml, robotsTxt, PUBLIC_ROUTES } from '../src/lib/siteMeta.ts'

test('the site URL is normalised to an origin without a trailing slash', () => {
  assert.equal(normalizeSiteUrl('https://ledger.example.com/'), 'https://ledger.example.com')
  assert.equal(normalizeSiteUrl('  https://ledger.example.com  '), 'https://ledger.example.com')
  assert.equal(normalizeSiteUrl('https://example.com/ledger/'), 'https://example.com/ledger')
})

test('an unset or unusable site URL is null, never a placeholder', () => {
  assert.equal(normalizeSiteUrl(undefined), null)
  assert.equal(normalizeSiteUrl(''), null)
  assert.equal(normalizeSiteUrl('ledger.example.com'), null)
  assert.equal(normalizeSiteUrl('ftp://ledger.example.com'), null)
})

test('head tags are absolute, and absent without a site URL', () => {
  assert.equal(headTags(null), '')
  const tags = headTags('https://ledger.example.com')
  assert.match(tags, /<link rel="canonical" href="https:\/\/ledger\.example\.com\/" \/>/)
  assert.match(tags, /<meta property="og:url" content="https:\/\/ledger\.example\.com\/" \/>/)
})

test('the sitemap lists every public route, including the legal pages', () => {
  const xml = sitemapXml('https://ledger.example.com')
  for (const route of PUBLIC_ROUTES) assert.ok(xml.includes(`<loc>https://ledger.example.com${route}</loc>`), route)
  assert.ok(PUBLIC_ROUTES.includes('/privacy') && PUBLIC_ROUTES.includes('/terms'))
})

test('robots.txt names an absolute sitemap only when there is one', () => {
  assert.doesNotMatch(robotsTxt(null), /Sitemap/)
  assert.match(robotsTxt('https://ledger.example.com'), /^Sitemap: https:\/\/ledger\.example\.com\/sitemap\.xml$/m)
})

test('every public route is a route in App.tsx', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  for (const route of PUBLIC_ROUTES.filter((r) => r !== '/')) assert.ok(app.includes(`path="${route}"`), route)
})

test('no placeholder domain ships', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.doesNotMatch(html, /your-domain\.example/)
})
