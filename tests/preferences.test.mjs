import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PREFERENCES,
  LEGACY_PREFERENCES_KEY,
  legacyPreferencesUpload,
  parsePreferences,
  preferencesNeverWritten,
  validPreferences,
} from '../src/lib/preferences.ts'

test('an account that stored nothing reads the defaults', () => {
  assert.deepEqual(parsePreferences({}), DEFAULT_PREFERENCES)
  assert.deepEqual(parsePreferences(null), DEFAULT_PREFERENCES)
  assert.deepEqual(parsePreferences(undefined), DEFAULT_PREFERENCES)
  assert.deepEqual(parsePreferences([]), DEFAULT_PREFERENCES)
})

test('stored values replace only their own default', () => {
  const prefs = parsePreferences({ dateFormat: 'DMY', txDensity: 'compact' })
  assert.equal(prefs.dateFormat, 'DMY')
  assert.equal(prefs.txDensity, 'compact')
  assert.equal(prefs.numberLocale, 'en-US')
})

test('an unknown or broken value falls back to its default, never reaching the formatters', () => {
  const prefs = parsePreferences({
    numberLocale: 'xx-XX',
    dateFormat: 7,
    largeTransactionThreshold: -5,
    creditCardNotificationsEnabled: 'yes',
    txView: 'tiles',
    somethingElse: true,
  })
  assert.deepEqual(prefs, DEFAULT_PREFERENCES)
  assert.equal('somethingElse' in validPreferences({ somethingElse: true }), false)
  assert.equal(parsePreferences({ largeTransactionThreshold: Number.NaN }).largeTransactionThreshold, 0)
})

test('the old browser key uploads only what differs from the defaults, and drops the account order', () => {
  const raw = JSON.stringify({
    numberLocale: 'de-DE',
    dateFormat: 'MDY',
    largeTransactionThreshold: 5000,
    accGroupOrder: ['loan', 'cash'],
    txView: 'nonsense',
  })
  assert.deepEqual(legacyPreferencesUpload(raw), { numberLocale: 'de-DE', largeTransactionThreshold: 5000 })
})

test('an old key with nothing worth keeping uploads nothing', () => {
  assert.equal(legacyPreferencesUpload(null), null)
  assert.equal(legacyPreferencesUpload(''), null)
  assert.equal(legacyPreferencesUpload('{not json'), null)
  assert.equal(legacyPreferencesUpload('[]'), null)
  assert.equal(legacyPreferencesUpload(JSON.stringify(DEFAULT_PREFERENCES)), null)
  assert.equal(legacyPreferencesUpload(JSON.stringify({ accGroupOrder: ['loan'] })), null)
})

test('the upload goes only into an account that never stored a preference', () => {
  assert.equal(preferencesNeverWritten({}), true)
  assert.equal(preferencesNeverWritten(null), true)
  assert.equal(preferencesNeverWritten(undefined), true)
  assert.equal(preferencesNeverWritten({ txView: 'flat' }), false)
})

test('the old key is the one the storage notice lists', () => {
  assert.equal(LEGACY_PREFERENCES_KEY, 'ledger-preferences')
})
