import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ReceiptCleanupError, removeUserReceipts } from '../src/lib/receiptCleanup.ts'

// A bucket holding `files` under one user folder; it records what it was asked to remove.
function fakeBucket(files, { listError = null, removeError = null } = {}) {
  const removed = []
  return {
    removed,
    async list(path, { limit, offset }) {
      if (listError) return { data: null, error: listError }
      return { data: files.slice(offset, offset + limit).map((name) => ({ name })), error: null }
    },
    async remove(paths) {
      if (removeError) return { error: removeError }
      removed.push(...paths)
      return { error: null }
    },
  }
}

test("every file under the user's folder is removed (LED-189)", async () => {
  const bucket = fakeBucket(['a.png', 'b.jpg'])
  assert.equal(await removeUserReceipts(bucket, 'u1'), 2)
  assert.deepEqual(bucket.removed, ['u1/a.png', 'u1/b.jpg'])
})

test('no receipts: nothing to remove', async () => {
  const bucket = fakeBucket([])
  assert.equal(await removeUserReceipts(bucket, 'u1'), 0)
  assert.deepEqual(bucket.removed, [])
})

test('more than one page of files is listed and removed in pages of 1,000', async () => {
  const files = Array.from({ length: 2345 }, (_, i) => `${i}.png`)
  const bucket = fakeBucket(files)
  assert.equal(await removeUserReceipts(bucket, 'u1'), 2345)
  assert.equal(new Set(bucket.removed).size, 2345)
})

test('a failed list or remove throws, so the account is not deleted', async () => {
  await assert.rejects(removeUserReceipts(fakeBucket(['a.png'], { listError: { message: 'denied' } }), 'u1'), ReceiptCleanupError)
  await assert.rejects(removeUserReceipts(fakeBucket(['a.png'], { removeError: { message: 'denied' } }), 'u1'), (err) => {
    assert.ok(err instanceof ReceiptCleanupError)
    assert.match(err.message, /not deleted/)
    assert.deepEqual(err.cause, { message: 'denied' })
    return true
  })
})

test('deleteAccountWithReceipts retries delete_user and says when receipts are already gone (LED-332)', async () => {
  const { deleteAccountWithReceipts, AccountDeletionIncompleteError } = await import('../src/lib/receiptCleanup.ts')
  let calls = 0
  await deleteAccountWithReceipts(fakeBucket(['a.png']), 'u1', async () => (++calls < 2 ? { error: { message: 'network' } } : { error: null }))
  assert.equal(calls, 2)

  calls = 0
  await assert.rejects(
    deleteAccountWithReceipts(fakeBucket(['a.png']), 'u1', async () => { calls++; throw new Error('offline') }),
    AccountDeletionIncompleteError,
  )
  assert.equal(calls, 3)

  // A storage failure stops before the account is touched.
  calls = 0
  await assert.rejects(
    deleteAccountWithReceipts(fakeBucket(['a.png'], { listError: { message: 'denied' } }), 'u1', async () => { calls++; return { error: null } }),
    ReceiptCleanupError,
  )
  assert.equal(calls, 0)
})
