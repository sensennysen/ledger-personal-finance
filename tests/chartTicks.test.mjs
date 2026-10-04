import { test } from 'node:test'
import assert from 'node:assert/strict'
import { abbreviateTick, thinCategoryTicks } from '../src/lib/chartTicks.ts'

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

test('distinguishes ticks across a 0 to 2,250 domain (LED-174)', () => {
  const ticks = [0, 750, 1500, 2250]
  const labels = ticks.map(abbreviateTick)
  assert.deepEqual(labels, ['0', '750', '1.5k', '2.3k'])
  assert.equal(new Set(labels).size, labels.length)
})

test('narrow charts show every other label, counted back from the newest (LED-204)', () => {
  const months = ['Oct 25', 'Nov 25', 'Dec 25', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
  assert.deepEqual(thinCategoryTicks(months, true), ['Oct 25', 'Dec 25', 'Feb', 'Apr', 'Jun', 'Aug', 'Oct'])
  assert.equal(thinCategoryTicks(months, true).at(-1), months.at(-1))
})

test('an even count still ends on the newest label and drops the oldest', () => {
  assert.deepEqual(thinCategoryTicks(['a', 'b', 'c', 'd'], true), ['b', 'd'])
})

test('with room, or too few points to thin, the chart keeps its own ticks', () => {
  assert.equal(thinCategoryTicks(['a', 'b', 'c', 'd', 'e'], false), undefined)
  assert.equal(thinCategoryTicks(['a', 'b'], true), undefined)
  assert.equal(thinCategoryTicks([], true), undefined)
})
