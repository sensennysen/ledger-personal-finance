import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MINUS, signPrefix } from '../src/lib/netSign.ts'

test('the minus is U+2212, not a hyphen', () => {
  assert.equal(MINUS, '−')
  assert.notEqual(MINUS, '-')
})

test('money in is +, money out is the minus, zero has no sign', () => {
  assert.equal(signPrefix(5), '+')
  assert.equal(signPrefix(-5), '−')
  assert.equal(signPrefix(0), '')
})
