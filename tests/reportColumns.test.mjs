import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REPORT_COLUMNS, defaultColumns, toggleColumn } from '../src/lib/reportColumns.ts'

test('the table has seven columns', () => {
  assert.equal(REPORT_COLUMNS.length, 7)
})

test('wide screens show every column', () => {
  assert.deepEqual([...defaultColumns(true)], REPORT_COLUMNS.map((c) => c.key))
})

test('narrow screens start with date, description and amount', () => {
  assert.deepEqual([...defaultColumns(false)].sort(), ['amount', 'date', 'description'])
})

test('optional columns toggle on and off without mutating the input', () => {
  const start = defaultColumns(true)
  const hidden = toggleColumn(start, 'balance')
  assert.equal(hidden.has('balance'), false)
  assert.equal(start.has('balance'), true)
  assert.equal(toggleColumn(hidden, 'balance').has('balance'), true)
})

test('required columns cannot be hidden', () => {
  const start = defaultColumns(false)
  for (const key of ['date', 'description', 'amount']) {
    assert.equal(toggleColumn(start, key).has(key), true)
  }
})
