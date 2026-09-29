import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
