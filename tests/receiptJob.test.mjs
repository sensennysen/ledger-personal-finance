import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitPendingReceipt } from '../src/lib/receiptJob.ts'

// LED-300: a pending marker is split off an online save, never written as the row's receipt.
test('a pending marker is split off; the row values come back without receipt_url', () => {
  const { values, marker } = splitPendingReceipt({ amount: 5, receipt_url: 'pending-receipt:t1' })
  assert.equal(marker, 'pending-receipt:t1')
  assert.deepEqual(values, { amount: 5 })
  assert.ok(!('receipt_url' in values), 'an edit leaves the current receipt alone')
})

test('an uploaded path, a cleared receipt or no receipt pass through unchanged', () => {
  for (const input of [{ receipt_url: 'u/r.jpg' }, { receipt_url: null }, { amount: 1 }]) {
    const { values, marker } = splitPendingReceipt(input)
    assert.equal(values, input)
    assert.equal(marker, null)
  }
})
