import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

const RING = 'focus-visible:ring-3'

// LED-157: these elements reported the browser default outline instead of the
// app's ring, because their className never carried a focus-visible ring.
// Guards a fixed block of source around each marker rather than the whole
// file, since some of these files legitimately use other focus-visible rings
// nearby that aren't the point of this check.
const SITES = [
  {
    label: 'InteractiveRow (dashboard rows, budgets, transactions filter chips)',
    file: 'components/ui/interactive-row.tsx',
    marker: 'const FOCUS_RING =',
  },
  {
    label: 'TopBar desktop Search button',
    file: 'components/layout/TopBar.tsx',
    marker: 'aria-label="Search"',
  },
  {
    label: 'TopBar Settings link',
    file: 'components/layout/TopBar.tsx',
    marker: 'SETTINGS_DESTINATION.label}',
  },
  {
    label: 'Home "Dismiss warning" button',
    file: 'pages/DashboardPage.tsx',
    marker: 'aria-label="Dismiss warning"',
  },
]

for (const { label, file, marker } of SITES) {
  test(`${label} carries a focus-visible ring (LED-157)`, () => {
    const src = read(file)
    const at = src.indexOf(marker)
    assert.notEqual(at, -1, `marker not found in ${file}: ${marker}`)
    const block = src.slice(Math.max(0, at - 200), at + 400)
    assert.match(block, new RegExp(RING))
  })
}

// LED-229: a ring of --ring at 50% is 2.07:1 on a dialog in light. The shared controls that use it
// (input, select, tabs, switch, badge, textarea) also turn their border to --ring, which carries the
// contrast; a control with no such border needs the solid ring.
const listSources = (dir) =>
  readdirSync(new URL(`../src/${dir}`, import.meta.url), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listSources(`${dir}/${entry.name}`) : /\.tsx?$/.test(entry.name) ? [`${dir}/${entry.name}`] : [],
  )
// The ScrollArea viewport: no keyboard path reaches it (LED-207 Backlog).
const HALF_RING_ALLOWED = new Set(['components/ui/scroll-area.tsx'])

test('a half-opacity focus ring always comes with a --ring border (LED-229)', () => {
  const offenders = []
  for (const file of listSources('components').concat(listSources('pages'))) {
    if (HALF_RING_ALLOWED.has(file)) continue
    for (const [className] of read(file).matchAll(/["'`][^"'`]*focus-visible:ring-ring\/50[^"'`]*["'`]/g)) {
      if (!className.includes('focus-visible:border-ring')) offenders.push(`${file}: ${className.slice(0, 80)}`)
    }
  }
  assert.deepEqual(offenders, [])
})
