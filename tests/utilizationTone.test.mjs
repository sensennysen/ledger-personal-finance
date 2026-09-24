import { test } from 'node:test'
import assert from 'node:assert/strict'
import { utilizationTone } from '../src/lib/utilizationTone.ts'

test('utilisation colour is a scale through gold at the target', () => {
  assert.equal(utilizationTone(0, 30), 'var(--income)')
  assert.equal(utilizationTone(15, 30), 'color-mix(in oklch, var(--primary) 50%, var(--income))')
  assert.equal(utilizationTone(30, 30), 'var(--primary)')
  assert.equal(utilizationTone(65, 30), 'color-mix(in oklch, var(--expense) 50%, var(--primary))')
  assert.equal(utilizationTone(100, 30), 'var(--expense)')
  assert.equal(utilizationTone(250, 30), 'var(--expense)')
})

test('0% and 69% no longer render the same colour', () => {
  assert.notEqual(utilizationTone(0, 70), utilizationTone(69, 70))
})

test('odd targets are clamped', () => {
  assert.equal(utilizationTone(50, 0), utilizationTone(50, 1))
  assert.equal(utilizationTone(100, 100), 'var(--expense)')
})
