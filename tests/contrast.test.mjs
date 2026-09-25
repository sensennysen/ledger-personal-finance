import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contrastRatio, readableInk } from '../src/lib/contrast.ts'

test('a light cell takes dark ink and a dark cell takes white ink', () => {
  assert.equal(readableInk('#EAB308'), '#000000')
  assert.equal(readableInk('#1E3A5F'), '#FFFFFF')
})

test('the chosen ink holds 4.5:1 on every palette hue and its dark tint', () => {
  const hues = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
    '#06b6d4', '#a855f7', '#f43f5e', '#84cc16', '#f59e0b', '#10b981', '#6b7280', '#94a3b8',
    '#818CF8', '#A78BFA', '#F472B6', '#F87171', '#FB923C', '#FACC15', '#4ADE80', '#2DD4BF', '#60A5FA',
    '#FB7185', '#A3E635', '#FBBF24', '#34D399', '#9CA3AF', '#CBD5E1', '#22D3EE', '#C084FC']
  for (const hue of hues) {
    const ratio = contrastRatio(readableInk(hue), hue)
    assert.ok(ratio >= 4.5, `${hue} ${ratio.toFixed(2)}:1`)
  }
})

test('a colour that is not #RRGGBB has no computed ink', () => {
  assert.equal(readableInk('var(--muted-foreground)'), null)
  assert.equal(readableInk('#888'), null)
})
