import { test } from 'node:test'
import assert from 'node:assert/strict'
import { abbreviateTick } from '../src/lib/chartTicks.ts'

test('small values stay whole numbers', () => {
  assert.equal(abbreviateTick(0), '0')
  assert.equal(abbreviateTick(950), '950')
  assert.equal(abbreviateTick(12.4), '12')
})

test('thousands, millions and billions abbreviate to one decimal', () => {
  assert.equal(abbreviateTick(8000), '8k')
  assert.equal(abbreviateTick(12500), '12.5k')
  assert.equal(abbreviateTick(1_200_000), '1.2M')
  assert.equal(abbreviateTick(3_000_000_000), '3B')
})

test('values that round up cross into the next unit', () => {
  assert.equal(abbreviateTick(999.6), '1k')
  assert.equal(abbreviateTick(999_960), '1M')
})

test('negatives keep a minus sign and never show "-0"', () => {
  assert.equal(abbreviateTick(-4000), '−4k')
  assert.equal(abbreviateTick(-0.2), '0')
})
