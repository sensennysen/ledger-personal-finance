import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// Colors must come from the index.css tokens so they follow the theme (LED-100).
const root = new URL('../src/', import.meta.url).pathname

// Tailwind palette literals, e.g. text-yellow-600, bg-white/4, border-amber-300.
const PALETTE =
  /\b(?:bg|text|border|fill|stroke|ring|from|to|via|outline|divide|decoration|caret)-(?:white|black|gray|slate|zinc|neutral|stone|red|green|blue|amber|yellow|emerald|orange|rose|sky|indigo|lime|teal|cyan|violet|purple|fuchsia|pink)\b(?:-\d{2,3})?/g
// Arbitrary color values and color functions in class or prop strings.
const LITERAL = /\[(?:#|rgba?\(|oklch\(|hsla?\()|(?:stroke|fill|color|borderColor|background(?:Color)?)=?[:=]\s*["'](?:#[0-9a-fA-F]{3,8}|rgba?\(|oklch\(|white|black)/g

// [file, line pattern] pairs that are theme-independent on purpose.
const ALLOWED = [
  // Scrims stay dark in both themes.
  ['components/ui/alert-dialog.tsx', /bg-black\/\d+/],
  ['components/ui/dialog.tsx', /bg-black\/\d+/],
  ['components/ui/sheet.tsx', /bg-black\/\d+/],
  // Treemap label: white text with a dark halo reads on any cell hue.
  ['components/reports/CategoryBreakdownCard.tsx', /fill="white"|stroke="rgba\(0,0,0,0\.35\)"/],
  // Google brand mark.
  ['pages/LoginPage.tsx', /<path d=".*" fill="#[0-9A-F]{6}"/],
  // Stored default for a new goal; rendered through categoryInk.
  ['pages/BudgetsPage.tsx', /color: '#6366f1'/],
]

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith('.tsx') ? [join(dir, d.name)] : [],
  )
}

test('components use theme tokens, not hardcoded colors', () => {
  const hits = []
  for (const file of files(root)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const re of [PALETTE, LITERAL]) {
        for (const m of line.matchAll(re)) {
          const path = relative(root, file)
          if (!ALLOWED.some(([f, re]) => f === path && re.test(line))) hits.push(`${path}:${i + 1} ${m[0]}`)
        }
      }
    })
  }
  assert.deepEqual(hits, [])
})
