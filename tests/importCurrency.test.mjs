import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convertAmount, currencyState, effectiveRate } from '../src/lib/importCurrency.ts'

test('the same currency needs no rate', () => {
  assert.deepEqual(currencyState('PHP', 'PHP', ''), { kind: 'same' })
  assert.deepEqual(currencyState('', 'USD', ''), { kind: 'same' })
  assert.equal(effectiveRate(currencyState('PHP', 'PHP', '')), 1)
})

test('a different currency blocks until the rate is a positive number', () => {
  for (const input of ['', '  ', '0', '-2', 'abc']) {
    assert.deepEqual(currencyState('PHP', 'USD', input), { kind: 'needs-rate' }, input)
  }
  assert.deepEqual(currencyState('PHP', 'USD', ' 0.0175 '), { kind: 'ok', rate: 0.0175 })
  assert.deepEqual(currencyState('USD', 'PHP', '1,000'), { kind: 'ok', rate: 1000 })
})

test('converted amounts round to the cent', () => {
  assert.equal(convertAmount(86.4, 0.0175), 1.51)
  assert.equal(convertAmount(3200, 56.1234), 179594.88)
  assert.equal(convertAmount(0.1 + 0.2, 1), 0.3)
})
