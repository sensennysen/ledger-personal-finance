import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoryInk } from '../src/lib/categoryTint.ts'

test('dark steps each palette hue one tint lighter', () => {
  assert.equal(categoryInk('#F97316', 'dark'), '#FB923C')
  assert.equal(categoryInk('#3B82F6', 'dark'), '#60A5FA')
  assert.equal(categoryInk('#6366f1', 'dark'), '#818CF8')
})

test('lookup ignores case and surrounding space', () => {
  assert.equal(categoryInk(' #f97316 ', 'dark'), '#FB923C')
})

test('every swatch offered by the pickers has a dark tint', () => {
  const pickers = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4',
    '#a855f7', '#f43f5e', '#84cc16', '#f59e0b', '#10b981',
  ]
  for (const hex of pickers) assert.notEqual(categoryInk(hex, 'dark'), hex, hex)
})

test('a custom color outside the palette passes through', () => {
  assert.equal(categoryInk('#123456', 'dark'), '#123456')
})

test('light returns the stored color unchanged', () => {
  assert.equal(categoryInk('#F97316', 'light'), '#F97316')
})
