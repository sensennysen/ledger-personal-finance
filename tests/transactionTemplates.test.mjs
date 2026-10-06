import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  legacyTemplateRows,
  normalizeTemplateName,
  parseTemplateFields,
  parseTemplateRows,
  serializeTemplateFields,
  shouldUploadLegacy,
  LEGACY_TEMPLATES_KEY,
} from '../src/lib/transactionTemplates.ts'

const lunch = {
  type: 'expense',
  account_id: 'acc-1',
  to_account_id: null,
  category_id: 'cat-1',
  amount: 250,
  currency: 'PHP',
  description: 'Lunch',
  tags: ['work'],
}
const uuid = '6f1c1d6e-3b8a-4c1f-9d2e-0a1b2c3d4e5f'

test('fields round-trip through the stored JSON, without a date', () => {
  const stored = serializeTemplateFields({ ...lunch, date: '2026-10-05' })
  assert.equal(stored.v, 1)
  assert.equal('date' in stored, false)
  assert.deepEqual(parseTemplateFields(stored), lunch)
})

test('unknown versions and missing core fields are skipped and counted', () => {
  const rows = [
    { id: 'a', name: 'Lunch', fields: serializeTemplateFields(lunch), created_at: '2026-10-05T00:00:00Z' },
    { id: 'b', name: 'Future', fields: { ...serializeTemplateFields(lunch), v: 2 }, created_at: '2026-10-05T00:00:00Z' },
    { id: 'c', name: 'No amount', fields: { v: 1, type: 'expense', account_id: 'acc-1', currency: 'PHP' }, created_at: '2026-10-05T00:00:00Z' },
    { id: 'd', name: 'Bad type', fields: { ...serializeTemplateFields(lunch), type: 'gift' }, created_at: '2026-10-05T00:00:00Z' },
    { id: 'e', name: 'Array', fields: [], created_at: '2026-10-05T00:00:00Z' },
  ]
  const { templates, skipped } = parseTemplateRows(rows)
  assert.deepEqual(templates.map((t) => t.id), ['a'])
  assert.equal(skipped, 4)
  assert.equal(templates[0].createdAt, '2026-10-05T00:00:00Z')
})

test('the old browser key becomes rows for the signed-in user, keeping ids and dates', () => {
  const raw = JSON.stringify([
    { id: uuid, name: '  Daily   lunch ', values: lunch, createdAt: '2026-09-01T08:00:00.000Z' },
    { id: 'not-a-uuid', name: 'Commute', values: { ...lunch, description: 'Bus' }, createdAt: 'garbage' },
  ])
  const rows = legacyTemplateRows(raw, 'user-1')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { id: uuid, user_id: 'user-1', name: 'Daily lunch', fields: serializeTemplateFields(lunch), created_at: '2026-09-01T08:00:00.000Z' })
  assert.equal('id' in rows[1], false)
  assert.equal('created_at' in rows[1], false)
  assert.equal(rows[1].user_id, 'user-1')
})

test('unreadable old keys and entries upload nothing', () => {
  assert.deepEqual(legacyTemplateRows(null, 'u'), [])
  assert.deepEqual(legacyTemplateRows('{not json', 'u'), [])
  assert.deepEqual(legacyTemplateRows('{"a":1}', 'u'), [])
  assert.deepEqual(legacyTemplateRows(JSON.stringify([null, { name: '', values: lunch }, { name: 'x', values: { type: 'expense' } }]), 'u'), [])
})

test('the old templates upload once: only into an account that has none', () => {
  assert.equal(shouldUploadLegacy(2, 0), true)
  // A second load, a second tab, or another device that uploaded first.
  assert.equal(shouldUploadLegacy(2, 2), false)
  assert.equal(shouldUploadLegacy(0, 0), false)
})

test('names are collapsed, trimmed and kept to the database limit', () => {
  assert.equal(normalizeTemplateName('  a   b  '), 'a b')
  assert.equal(normalizeTemplateName('x'.repeat(80)).length, 60)
})

test('the old key name is unchanged, so existing browsers are found', () => {
  assert.equal(LEGACY_TEMPLATES_KEY, 'ledger_transaction_templates')
})
