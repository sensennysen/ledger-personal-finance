import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_PENDING,
  dropStale,
  isPendingEmpty,
  parsePendingSettings,
  pendingSettingsKey,
  pendingValues,
  recordPending,
  withoutSent,
} from '../src/lib/pendingSettings.ts'

const account = {
  id: 'u-1',
  dashboard_hidden_widgets: null,
  preferences: { dateFormat: 'MDY' },
}

test('a change records the value it replaces, and a second change keeps the first base', () => {
  let pending = recordPending(EMPTY_PENDING, 'preferences', { dateFormat: 'DMY' }, account.preferences)
  pending = recordPending(pending, 'preferences', { dateFormat: 'YMD' }, { dateFormat: 'DMY' })
  assert.deepEqual(pending.preferences, { dateFormat: { value: 'YMD', base: 'MDY' } })
  pending = recordPending(pending, 'columns', { dashboard_hidden_widgets: ['budgets'] }, account)
  assert.deepEqual(pending.columns, { dashboard_hidden_widgets: { value: ['budgets'], base: null } })
  assert.deepEqual(pendingValues(pending, 'preferences'), { dateFormat: 'YMD' })
  assert.equal(EMPTY_PENDING.preferences.dateFormat, undefined, 'the empty value is never changed')
})

test('the stored copy survives a reload round-trip, and a broken copy reads as empty', () => {
  const pending = recordPending(EMPTY_PENDING, 'preferences', { txDensity: 'compact' }, {})
  const reloaded = parsePendingSettings(JSON.parse(JSON.stringify(pending)))
  assert.deepEqual(reloaded, pending)
  assert.ok(isPendingEmpty(parsePendingSettings(null)))
  assert.ok(isPendingEmpty(parsePendingSettings('broken')))
  assert.ok(isPendingEmpty(parsePendingSettings({ preferences: { txDensity: 'compact' } })), 'an entry without a value is dropped')
  assert.equal(pendingSettingsKey('u-1'), 'u-1:pending-settings')
})

test('a value another device saved since wins over the older pending one', () => {
  const pending = recordPending(EMPTY_PENDING, 'preferences', { dateFormat: 'DMY' }, account.preferences)
  const other = dropStale(pending, { ...account, preferences: { dateFormat: 'YMD' } })
  assert.ok(isPendingEmpty(other))
})

test('a pending value the account still lacks is kept, and one it already holds goes', () => {
  const pending = recordPending(EMPTY_PENDING, 'preferences', { dateFormat: 'DMY', txView: 'flat' }, account.preferences)
  const kept = dropStale(pending, { ...account, preferences: { dateFormat: 'MDY', txView: 'flat' } })
  assert.deepEqual(pendingValues(kept, 'preferences'), { dateFormat: 'DMY' })
  const columns = recordPending(EMPTY_PENDING, 'columns', { dashboard_hidden_widgets: ['budgets'] }, account)
  assert.deepEqual(pendingValues(dropStale(columns, account), 'columns'), { dashboard_hidden_widgets: ['budgets'] })
  assert.ok(isPendingEmpty(dropStale(columns, { ...account, dashboard_hidden_widgets: ['budgets'] })))
})

test('a send removes only what it sent; a key changed during the send keeps waiting', () => {
  const sent = recordPending(EMPTY_PENDING, 'preferences', { dateFormat: 'DMY', txView: 'flat' }, account.preferences)
  const changedSince = recordPending(sent, 'preferences', { dateFormat: 'YMD' }, {})
  const after = withoutSent(changedSince, 'preferences', sent.preferences)
  assert.deepEqual(after.preferences, { dateFormat: { value: 'YMD', base: 'MDY' } })
  assert.ok(isPendingEmpty(withoutSent(sent, 'preferences', sent.preferences)))
})
