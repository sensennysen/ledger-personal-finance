import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filteredEmptyMessage } from '../src/lib/filteredEmpty.ts'

const RANGE = 'Oct 2 – Nov 1'

test('a no-match search names the search, not an empty cycle (QA-004 / F-016b)', () => {
  const { title, description } = filteredEmptyMessage({ type: 'all', search: 'nothing-matches-qa', tag: null }, RANGE)
  assert.equal(title, 'No transactions match your filters')
  assert.doesNotMatch(title, /No transactions in/)
  assert.equal(description, 'Nothing in Oct 2 – Nov 1 matches “nothing-matches-qa”.')
})

test('type and tag filters are named alongside the search', () => {
  const { description } = filteredEmptyMessage({ type: 'income', search: ' rent ', tag: 'trip' }, RANGE)
  assert.equal(description, 'Nothing in Oct 2 – Nov 1 matches “rent”, type income, tag #trip.')
  assert.equal(filteredEmptyMessage({ type: 'expense', search: '', tag: null }, RANGE).description, 'Nothing in Oct 2 – Nov 1 matches type expense.')
})
