#!/usr/bin/env node
// Dev-only live sweep (LED-211). Signs in to a local Ledger as the seeded demo user and, for each
// route, width and theme, runs the rendered contrast scan, the dark-theme light-surface pass and a
// horizontal-overflow check, saves a screenshot, and prints PASS/FAIL lines. `--home-fold` also
// measures which Home widgets sit fully above the fold at 390x844 (LED-202).
//
// It is the committed form of knowledge/patterns/live-sweep-method.md,
// browser-check-with-local-user.md and rendered-contrast-scan.md. It never touches the linked
// remote: it only talks to --base-url, which defaults to the local dev server.
//
// Playwright is not a dependency of this repo: the script loads it from node_modules if present,
// else from the global install (`npm root -g`). CI does not run it, and nothing in src/ imports it.
//
//   pnpm sweep [--base-url http://127.0.0.1:5173] [--out sweep-out] [--routes /,/reports]
//              [--widths 390,1280] [--themes light,dark] [--home-fold] [--relay-fonts]
//              [--email demo@ledger.local --password ledger-demo-123]

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const APP_ROUTES = ['/', '/accounts', '/transactions', '/budgets', '/categories', '/reports', '/thirteenth-month', '/settings']
const PUBLIC_ROUTES = ['/login', '/privacy', '/terms', '/data-deletion', '/cookies', '/notices']

function parseArgs(argv) {
  const args = {
    baseUrl: 'http://127.0.0.1:5173',
    out: 'sweep-out',
    routes: [...APP_ROUTES, ...PUBLIC_ROUTES],
    widths: [390, 1280],
    themes: ['light', 'dark'],
    homeFold: false,
    relayFonts: false,
    email: 'demo@ledger.local',
    password: 'ledger-demo-123',
  }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) throw new Error(`${flag} needs a value`)
      return value
    }
    if (flag === '--base-url') args.baseUrl = next().replace(/\/$/, '')
    else if (flag === '--out') args.out = next()
    else if (flag === '--routes') args.routes = next().split(',').map((r) => r.trim()).filter(Boolean)
    else if (flag === '--widths') args.widths = next().split(',').map(Number).filter((n) => n > 0)
    else if (flag === '--themes') args.themes = next().split(',').map((t) => t.trim()).filter((t) => t === 'light' || t === 'dark')
    else if (flag === '--home-fold') args.homeFold = true
    else if (flag === '--relay-fonts') args.relayFonts = true
    else if (flag === '--email') args.email = next()
    else if (flag === '--password') args.password = next()
    else if (flag === '--help' || flag === '-h') {
      console.log(readUsage())
      process.exit(0)
    } else throw new Error(`Unknown flag ${flag} (see --help)`)
  }
  return args
}

function readUsage() {
  return 'Usage: pnpm sweep [--base-url URL] [--out DIR] [--routes a,b] [--widths 390,1280] [--themes light,dark] [--home-fold] [--relay-fonts] [--email E --password P]'
}

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim()
    try {
      return createRequire(path.join(globalRoot, 'noop.js'))('playwright')
    } catch {
      throw new Error('Playwright was not found locally or globally. Install it (npm i -g playwright) and its Chromium.')
    }
  }
}

// ── Checks evaluated in the page ─────────────────────────────────────────────────────────────

/**
 * Contrast of every visible text node: colours are parsed through a 1x1 canvas (oklab, color-mix),
 * ancestor backgrounds are composited until opaque, each element's opacity is applied, and text
 * of 24px (18.66px bold) needs 3:1, the rest 4.5:1. Disabled controls (LED-119) and the wordmark's
 * "." (a logotype) are listed as exempt, not failed. SVG text and focus rings are not covered
 * (rendered-contrast-scan.md, blind spots).
 */
function contrastScan() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const parse = (color) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const over = (top, bottom, alpha) => top.map((c, i) => c * alpha + bottom[i] * (1 - alpha))
  const lum = ([r, g, b]) => {
    const f = (c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const pageBase = () => {
    const html = parse(getComputedStyle(document.documentElement).backgroundColor)
    const body = parse(getComputedStyle(document.body).backgroundColor)
    let base = [255, 255, 255]
    if (html[3] > 0) base = over(html.slice(0, 3), base, html[3])
    if (body[3] > 0) base = over(body.slice(0, 3), base, body[3])
    return base
  }
  const backgroundBehind = (el) => {
    const layers = []
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node)
      const [r, g, b, a] = parse(style.backgroundColor)
      const alpha = a * Number(style.opacity)
      if (alpha > 0) layers.push({ rgb: [r, g, b], alpha })
      if (alpha >= 0.999) break
    }
    let rgb = pageBase()
    for (const layer of layers.reverse()) rgb = over(layer.rgb, rgb, layer.alpha)
    return rgb
  }
  const opacityOf = (el) => {
    let value = 1
    for (let node = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity)
    return value
  }

  const failures = []
  const exempt = []
  let checked = 0
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const value = text.textContent.replace(/\s+/g, ' ').trim()
    if (!value) continue
    const el = text.parentElement
    if (!el || el.closest('.sr-only, svg, [aria-hidden="true"]')) continue
    const style = getComputedStyle(el)
    if (style.visibility === 'hidden' || style.display === 'none') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const opacity = opacityOf(el)
    if (opacity === 0) continue
    checked++
    const bg = backgroundBehind(el)
    const [r, g, b, a] = parse(style.color)
    const fg = over([r, g, b], bg, a * opacity)
    const size = parseFloat(style.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
    const value2 = ratio(fg, bg)
    const needed = large ? 3 : 4.5
    if (value2 + 1e-6 >= needed) continue
    const entry = { text: value.slice(0, 60), ratio: Math.round(value2 * 100) / 100, needed }
    // The "." of the "Ledger." wordmark is part of a logotype, which WCAG 1.4.3 exempts (LED-207).
    const logotype = value === '.' && el.parentElement?.textContent?.trim() === 'Ledger.'
    if (logotype || el.closest(':disabled, [aria-disabled="true"], [data-disabled]')) exempt.push(entry)
    else failures.push(entry)
  }

  // Dark theme only: a light panel (24x16 or more, luminance above 0.5) is likely a missed token.
  const lightSurfaces = []
  if (document.documentElement.classList.contains('dark')) {
    for (const el of document.body.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect()
      if (rect.width < 24 || rect.height < 16) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const [r, g, b, a] = parse(style.backgroundColor)
      const alpha = a * opacityOf(el)
      if (alpha < 0.5) continue
      if (lum([r, g, b]) > 0.5) lightSurfaces.push({ tag: el.tagName.toLowerCase(), text: el.innerText?.trim().slice(0, 40) ?? '', alpha: Math.round(alpha * 100) / 100 })
    }
  }

  const main = document.querySelector('main')
  return {
    checked,
    failures,
    exempt,
    lightSurfaces,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    main: main ? { scrollHeight: main.scrollHeight, clientHeight: main.clientHeight } : null,
  }
}

/** Home widgets (grid children ordered 10+ by DashboardPage) against the bottom nav's top edge. */
function homeFold() {
  // The phone bottom nav: the visible "Main navigation" in the lower half (the top bar's is hidden).
  const navTops = [...document.querySelectorAll('nav[aria-label="Main navigation"]')]
    .map((nav) => nav.getBoundingClientRect())
    .filter((rect) => rect.height > 0 && rect.top > window.innerHeight / 2)
    .map((rect) => rect.top)
  const fold = navTops.length ? Math.min(...navTops) : window.innerHeight
  const widgets = []
  for (const el of document.querySelectorAll('main [style*="order"]')) {
    const order = Number(getComputedStyle(el).order)
    if (!(order >= 10)) continue
    const rect = el.getBoundingClientRect()
    if (rect.height === 0) continue
    const heading = el.querySelector('h2, h3, [data-slot="card-title"]')?.textContent?.trim() || el.innerText.trim().split('\n')[0]
    widgets.push({
      order,
      label: heading.slice(0, 40),
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      aboveFold: rect.bottom <= fold + 0.5,
    })
  }
  widgets.sort((a, b) => a.top - b.top)
  return { fold: Math.round(fold), widgets }
}

// ── Driver ───────────────────────────────────────────────────────────────────────────────────

async function signIn(page, args) {
  await page.goto(`${args.baseUrl}/login`)
  const form = page.locator('form[aria-label="Development sign-in"]')
  if (!(await form.count())) throw new Error('No development sign-in form on /login. Run the dev server (pnpm dev), not a production build.')
  await form.locator('input[type="email"]').fill(args.email)
  await form.locator('input[type="password"]').fill(args.password)
  await form.getByRole('button', { name: 'Sign in with email' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })
}

async function newContext(browser, args, theme, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: theme })
  if (args.relayFonts) {
    // A container whose egress proxy Chromium does not trust (docs/claude-cloud.md): Node fetches the fonts.
    await context.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
      try {
        await route.fulfill({ response: await context.request.fetch(route.request()) })
      } catch {
        await route.abort()
      }
    })
  }
  await context.addInitScript((value) => {
    localStorage.setItem('ledger-first-run', JSON.stringify({ cycleConfirmed: true }))
    localStorage.setItem('ledger-theme', value)
  }, theme)
  return context
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  // Park the pointer in the top-left corner: a row or card left under it (where a button was
  // clicked) is measured in its hover state otherwise.
  await page.mouse.move(0, 0)
  await page.waitForTimeout(400)
}

const slug = (route) => (route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-'))

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { chromium } = await loadPlaywright()
  const browser = await chromium.launch({ channel: 'chromium' }).catch(() => chromium.launch())
  mkdirSync(args.out, { recursive: true })
  const results = []
  const lines = []
  const record = (result, item, evidence) => {
    results.push({ result, item, evidence })
    lines.push(`${result.padEnd(4)} ${item} — ${typeof evidence === 'string' ? evidence : JSON.stringify(evidence)}`)
  }

  try {
    for (const theme of args.themes) {
      for (const width of args.widths) {
        const context = await newContext(browser, args, theme, width)
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await signIn(page, args)
        for (const route of args.routes) {
          await page.goto(`${args.baseUrl}${route}`)
          await settle(page)
          const scan = await page.evaluate(contrastScan)
          const shot = path.join(args.out, `${slug(route)}-${width}-${theme}.png`)
          await page.screenshot({ path: shot, fullPage: true })
          const item = `${route} @${width} ${theme}`
          const contrastIndex = results.length
          if (scan.failures.length) record('FAIL', `${item} contrast`, scan.failures.slice(0, 8))
          else record('PASS', `${item} contrast`, `${scan.checked} text nodes, 0 below the minimum${scan.exempt.length ? ` (+${scan.exempt.length} exempt: disabled or logotype)` : ''}`)
          if (theme === 'dark' && scan.lightSurfaces.length) record('NOTE', `${item} light surfaces`, scan.lightSurfaces.slice(0, 6))
          if (scan.overflowX) record('FAIL', `${item} overflow`, 'the page scrolls sideways')
          Object.assign(results[contrastIndex], { screenshot: shot, main: scan.main })
        }
        if (errors.length) record('NOTE', `page errors @${width} ${theme}`, errors.slice(0, 5))
        await context.close()
      }
    }

    if (args.homeFold) {
      const theme = args.themes[0] ?? 'light'
      const context = await newContext(browser, args, theme, 390)
      const page = await context.newPage()
      await signIn(page, args)
      await page.goto(`${args.baseUrl}/`)
      await settle(page)
      const fold = await page.evaluate(homeFold)
      const firstFour = fold.widgets.slice(0, 4)
      const allAbove = firstFour.length === 4 && firstFour.every((widget) => widget.aboveFold)
      record(allAbove ? 'PASS' : 'FAIL', 'Home first four widgets above the fold @390x844', fold)
      await page.screenshot({ path: path.join(args.out, 'home-fold-390.png') })
      await context.close()
    }
  } finally {
    await browser.close()
  }

  writeFileSync(path.join(args.out, 'results.json'), JSON.stringify({ baseUrl: args.baseUrl, at: new Date().toISOString(), results }, null, 2))
  console.log(lines.join('\n'))
  const failed = results.filter((r) => r.result === 'FAIL').length
  console.log(`\n${results.filter((r) => r.result === 'PASS').length} PASS · ${failed} FAIL · results in ${path.join(args.out, 'results.json')}`)
  process.exitCode = failed ? 1 : 0
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(2)
})
