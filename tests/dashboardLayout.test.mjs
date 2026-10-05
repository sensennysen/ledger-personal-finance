import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_WIDGET_ORDER,
  LEGACY_WIDGETS_KEY,
  LEGACY_WIDGET_ORDER_KEY,
  hiddenToWidgets,
  legacyHiddenUpload,
  normalizeOrder,
  widgetsToHidden,
} from '../src/lib/dashboardLayout.ts'

test('an account that stored nothing shows every widget', () => {
  for (const stored of [null, undefined, [], 'stats']) {
    assert.ok(Object.values(hiddenToWidgets(stored)).every(Boolean))
  }
})

test('the stored list hides exactly the widgets it names, and ignores unknown names', () => {
  const widgets = hiddenToWidgets(['stats', 'quickAdd', 'notAWidget'])
  assert.equal(widgets.stats, false)
  assert.equal(widgets.quickAdd, false)
  assert.equal(widgets.budgets, true)
  assert.deepEqual(widgetsToHidden(widgets), ['stats', 'quickAdd'])
})

test('hidden and shown round-trip', () => {
  const hidden = ['categoryPie', 'savingsGoals']
  assert.deepEqual(widgetsToHidden(hiddenToWidgets(hidden)).sort(), [...hidden].sort())
})

test('the old browser key uploads the widgets it turned off', () => {
  assert.deepEqual(legacyHiddenUpload(JSON.stringify({ stats: false, budgets: true, creditCards: false, bogus: false })), ['stats', 'creditCards'])
})

test('an old key with nothing turned off, or unreadable, uploads nothing', () => {
  assert.equal(legacyHiddenUpload(null), null)
  assert.equal(legacyHiddenUpload('{oops'), null)
  assert.equal(legacyHiddenUpload('[]'), null)
  assert.equal(legacyHiddenUpload(JSON.stringify({ stats: true })), null)
})

test('the order keeps known widgets and appends the missing ones', () => {
  assert.deepEqual(normalizeOrder(null), DEFAULT_WIDGET_ORDER)
  const order = normalizeOrder(['budgets', 'bogus', 'stats'])
  assert.deepEqual(order.slice(0, 2), ['budgets', 'stats'])
  assert.equal(order.length, DEFAULT_WIDGET_ORDER.length)
})

test('the old keys are the ones the storage notice lists', () => {
  assert.equal(LEGACY_WIDGETS_KEY, 'ledger-dashboard-widgets')
  assert.equal(LEGACY_WIDGET_ORDER_KEY, 'ledger-dashboard-widget-order')
})
