import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legacyPicksPrefix, parseLegacyPicks, picksFromRows } from '../src/lib/thirteenthMonthPicks.ts'

const me = '11111111-1111-4111-8111-111111111111'
const a = '6f1c1d6e-3b8a-4c1f-9d2e-0a1b2c3d4e5f'
const b = '7a2d2e7f-4c9b-4d2a-8e3f-1b2c3d4e5f60'

test('an old key uploads its year and its valid ids, once each', () => {
  assert.deepEqual(parseLegacyPicks(`13th-month-selection:${me}:2026`, JSON.stringify([a, b, a, 'nope', 7]), me), { year: 2026, ids: [a, b] })
})

test('a saved Clear uploads as an empty pick, not as "never picked"', () => {
  assert.deepEqual(parseLegacyPicks(`13th-month-selection:${me}:2025`, '[]', me), { year: 2025, ids: [] })
})

test('another user\'s key, a bad year, or an unreadable value uploads nothing', () => {
  assert.equal(parseLegacyPicks(`13th-month-selection:someone-else:2026`, '[]', me), null)
  assert.equal(parseLegacyPicks(`13th-month-selection:${me}:twenty`, '[]', me), null)
  assert.equal(parseLegacyPicks(`13th-month-selection:${me}:1999`, '[]', me), null)
  assert.equal(parseLegacyPicks(`13th-month-selection:${me}:2026`, '{x', me), null)
  assert.equal(parseLegacyPicks(`13th-month-selection:${me}:2026`, '{}', me), null)
  assert.equal(parseLegacyPicks(`13th-month-selection:${me}:2026`, null, me), null)
})

test('a year never saved reads as null (every record counts); a saved one as its picks', () => {
  assert.equal(picksFromRows(false, []), null)
  assert.deepEqual([...picksFromRows(true, [])], [])
  assert.deepEqual([...picksFromRows(true, [{ transaction_id: a }])], [a])
})

test('the old key prefix is the one the storage notice lists', () => {
  assert.equal(legacyPicksPrefix(me), `13th-month-selection:${me}:`)
})
