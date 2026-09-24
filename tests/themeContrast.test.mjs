import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contrastRatio } from '../src/lib/contrast.ts'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

function tokens(selector) {
  const start = css.indexOf(`${selector} {`)
  assert.ok(start >= 0, `${selector} block missing`)
  const body = css.slice(start, css.indexOf('}', start))
  const map = {}
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) map[name] = value.trim()
  return map
}

function resolve(map, name) {
  let value = map[name]
  for (let i = 0; value?.startsWith('var('); i++) {
    assert.ok(i < 10, `${name} alias loop`)
    value = map[value.slice(4, -1).trim()]
  }
  assert.match(value ?? '', /^#[0-9A-Fa-f]{6}$/, `${name} is not a hex color`)
  return value
}

const themes = { light: tokens(':root'), dark: tokens('.dark') }

// Body-text pairs: [text, surface]. Each must hold 4.5:1 in both themes.
const pairs = [
  ['--foreground', '--background'],
  ['--foreground', '--muted'],
  ['--card-foreground', '--card'],
  ['--popover-foreground', '--popover'],
  ['--muted-foreground', '--card'],
  ['--muted-foreground', '--muted'],
  ['--muted-foreground', '--background'],
  ['--primary-foreground', '--primary'],
  ['--secondary-foreground', '--secondary'],
  ['--accent-foreground', '--accent'],
  ['--sidebar-foreground', '--sidebar'],
  ['--income', '--income-container'],
  ['--expense', '--expense-container'],
  ['--transfer', '--transfer-container'],
  ['--warning', '--warning-container'],
  ['--income', '--card'],
  ['--expense', '--card'],
]

for (const [theme, map] of Object.entries(themes)) {
  for (const [fg, bg] of pairs) {
    test(`${theme}: ${fg} on ${bg} holds 4.5:1`, () => {
      const ratio = contrastRatio(resolve(map, fg), resolve(map, bg))
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1`)
    })
  }
}

test('dark on-primary is dark ink, not white', () => {
  assert.notEqual(resolve(themes.dark, '--primary-foreground').toUpperCase(), '#FFFFFF')
})
