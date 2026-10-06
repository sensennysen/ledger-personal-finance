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

// Card hover (LED-246): a see-through hover:bg-accent/N replaced bg-card and showed the grey page through,
// so --primary drew 4.27:1 and --transfer 4.41:1 in light. The hover is a solid sRGB mix of accent and card.
function mixHex(a, b, weight) {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const [pa, pb] = [rgb(a), rgb(b)]
  return '#' + pa.map((v, i) => Math.round(v * weight + pb[i] * (1 - weight)).toString(16).padStart(2, '0')).join('')
}

const hoverDecl = /--color-surface-hover:\s*color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\);/.exec(css)

test('the card hover surface is a solid mix of two tokens', () => {
  assert.ok(hoverDecl, '--color-surface-hover is not color-mix(in srgb, var(--a) N%, var(--b))')
})

for (const [theme, map] of Object.entries(themes)) {
  for (const ink of ['--foreground', '--muted-foreground', '--primary', '--transfer', '--income', '--expense', '--warning']) {
    test(`${theme}: ${ink} on the card hover surface holds 4.5:1`, () => {
      const [, a, pct, b] = hoverDecl
      const surface = mixHex(resolve(map, a), resolve(map, b), Number(pct) / 100)
      const ratio = contrastRatio(resolve(map, ink), surface)
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 on ${surface}`)
    })
  }
}

test('cards on the page hover to the solid surface, not a see-through accent', () => {
  const sites = [
    ['../src/components/transactions/TransactionRow.tsx', 'rounded-lg bg-card border'],
    ['../src/pages/BudgetsPage.tsx', 'as={Card}'],
    ['../src/pages/TransactionsPage.tsx', 'rounded-lg border border-border/60 bg-card'],
  ]
  for (const [file, anchor] of sites) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    const at = src.indexOf(anchor)
    assert.ok(at >= 0, `${file}: ${anchor} not found`)
    const near = src.slice(at, at + 400)
    assert.match(near, /hover:bg-surface-hover/, file)
    assert.doesNotMatch(near.split('\n').slice(0, 3).join('\n'), /hover:bg-accent\/\d+/, file)
  }
})

// Completed goal (LED-249): opacity-75 on the whole card took its muted text to 3.73:1 in light. A completed
// goal is not a disabled control, so it keeps full-strength text; the check icon and income bar mark it.
test('a completed goal card is not dimmed with opacity', () => {
  const src = readFileSync(new URL('../src/pages/BudgetsPage.tsx', import.meta.url), 'utf8')
  const start = src.indexOf('function SavingsGoalCard(')
  assert.ok(start >= 0, 'SavingsGoalCard not found')
  const body = src.slice(start, src.indexOf('\nfunction ', start + 1))
  assert.doesNotMatch(body, /(?<![\w-])opacity-\d+/)
})

// Button hovers (LED-248): default hover:bg-primary/85 let the surface through and drew the white label at
// 4.15:1 (light); destructive dark:hover:bg-destructive/30 drew --expense at 4.27:1. Both are solid mixes now.
const srgbMix = /color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, (?:var\((--[\w-]+)\)|(#[0-9A-Fa-f]{6}))\)/

function mixedToken(map, decl) {
  const m = srgbMix.exec(decl ?? '')
  assert.ok(m, `not color-mix(in srgb, var(--a) N%, var(--b) | #hex): ${decl}`)
  const [, a, pct, b, hex] = m
  return mixHex(resolve(map, a), hex ?? resolve(map, b), Number(pct) / 100)
}

const destructiveHoverDecl = /--color-destructive-hover:\s*([^;]+);/.exec(css)?.[1]

for (const [theme, map] of Object.entries(themes)) {
  test(`${theme}: --primary-foreground on the primary button hover holds 4.5:1`, () => {
    const fill = mixedToken(map, map['--primary-hover'])
    const ratio = contrastRatio(resolve(map, '--primary-foreground'), fill)
    assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 on ${fill}`)
    assert.ok(ratio > contrastRatio(resolve(map, '--primary-foreground'), resolve(map, '--primary')), 'hover moves toward the ink')
  })
  test(`${theme}: --expense on the destructive button hover holds 4.5:1`, () => {
    const fill = mixedToken(map, destructiveHoverDecl)
    const ratio = contrastRatio(resolve(map, '--expense'), fill)
    assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 on ${fill}`)
  })
}

test('button variants hover to solid fills, not a see-through primary or destructive', () => {
  const variants = readFileSync(new URL('../src/components/ui/button-variants.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(variants, /hover:bg-(primary|destructive)\/\d+/)
  assert.match(variants, /hover:bg-primary-hover/)
  assert.match(variants, /(?<!dark:)hover:bg-destructive-hover[\s\S]*dark:hover:bg-destructive-hover/)
})

// Skeleton bars (LED-275): bg-muted drew 1.08:1 on the light card, so loading looked empty. They are
// decorative, not text, so 1.5:1 applies, on the card and on the frame the detail pane uses. Dark keeps --muted.
test('light: --skeleton on --card and --sidebar holds 1.5:1', () => {
  for (const surface of ['--card', '--sidebar']) {
    const ratio = contrastRatio(resolve(themes.light, '--skeleton'), resolve(themes.light, surface))
    assert.ok(ratio >= 1.5, `${surface}: ${ratio.toFixed(2)}:1`)
  }
})

test('dark: --skeleton is the muted surface, unchanged', () => {
  assert.equal(themes.dark['--skeleton'], 'var(--muted)')
})

test('skeletons draw with the skeleton token, not --muted', () => {
  const src = readFileSync(new URL('../src/components/ui/skeleton.tsx', import.meta.url), 'utf8')
  assert.equal(src.match(/(?<![\w:-])bg-skeleton(?![\w/-])/g)?.length, 2)
  assert.doesNotMatch(src, /(?<![\w:-])bg-muted(?![\w/-])/)
})
