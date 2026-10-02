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
  ['--foreground', '--warning-container'],
  ['--income', '--card'],
  ['--expense', '--card'],
  ['--warning', '--card'],
]

for (const [theme, map] of Object.entries(themes)) {
  for (const [fg, bg] of pairs) {
    test(`${theme}: ${fg} on ${bg} holds 4.5:1`, () => {
      const ratio = contrastRatio(resolve(map, fg), resolve(map, bg))
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1`)
    })
  }
}

// Gold is UI chrome (borders, fills, meters), so 3:1 applies, not 4.5:1.
for (const [theme, map] of Object.entries(themes)) {
  for (const surface of ['--background', '--card']) {
    test(`${theme}: --gold on ${surface} holds 3:1`, () => {
      const ratio = contrastRatio(resolve(map, '--gold'), resolve(map, surface))
      assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1`)
    })
  }
}

// Disabled ink is UI chrome, so 3:1 applies. It can sit on the disabled fill or any surface a control lands on.
for (const [theme, map] of Object.entries(themes)) {
  for (const surface of ['--disabled', '--background', '--card', '--muted', '--popover']) {
    test(`${theme}: --disabled-foreground on ${surface} holds 3:1`, () => {
      const ratio = contrastRatio(resolve(map, '--disabled-foreground'), resolve(map, surface))
      assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1`)
    })
  }
}

test('dark on-primary is dark ink, not white', () => {
  assert.notEqual(resolve(themes.dark, '--primary-foreground').toUpperCase(), '#FFFFFF')
})

// Inactive tab labels (LED-228): an opacity on --foreground drew 3.55:1 on the page in light. The trigger
// takes the --muted-foreground token, which the pairs above hold to 4.5:1 on the page, card and muted
// surfaces a tab list sits on.
test('inactive tab labels use the muted ink token, not an opacity of the foreground', () => {
  const tabs = readFileSync(new URL('../src/components/ui/tabs.tsx', import.meta.url), 'utf8')
  const trigger = tabs.slice(tabs.indexOf('function TabsTrigger'), tabs.indexOf('function TabsContent'))
  assert.ok(trigger.length > 0, 'TabsTrigger not found')
  assert.doesNotMatch(trigger, /(?<![\w:-])text-foreground\/\d+/)
  assert.match(trigger, /(?<![\w:-])text-muted-foreground(?![\w/-])/)
})
