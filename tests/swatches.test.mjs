import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SWATCHES, DEFAULT_ACCENT } from '../src/lib/swatches.ts'
import { categoryInk } from '../src/lib/categoryTint.ts'

test('every swatch is a distinct #rrggbb', () => {
  for (const c of SWATCHES) assert.match(c, /^#[0-9a-f]{6}$/)
  assert.equal(new Set(SWATCHES).size, SWATCHES.length)
})

test('every swatch has a dark-theme tint, so none goes unreadable in dark', () => {
  for (const c of SWATCHES) assert.notEqual(categoryInk(c, 'dark'), c, `${c} has no dark tint`)
})

test('the default accent is not one of the swatches, so choosing it clears the overrides', () => {
  assert.ok(!SWATCHES.includes(DEFAULT_ACCENT))
})
