import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/pages/ThirteenthMonthPage.tsx', import.meta.url), 'utf8')

test('page source has no replacement characters', () => {
  assert.equal(src.includes('�'), false)
})

test('subtitle, card title and meta separator use an en dash', () => {
  assert.match(src, /Computed under PD 851 – Select which income records/)
  assert.match(src, /Income Records – \{year\}/)
  assert.match(src, /<span className="text-border">–<\/span>/)
})

test('neutral Records Included count is not coloured as an expense', () => {
  assert.equal(/\bEXPENSE\b/.test(src), false)
})
