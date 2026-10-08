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

// A bucket whose files carry an age; `ages` maps a name to how many hours ago it was stored.
function agedBucket(ages) {
  const now = Date.parse('2026-10-08T12:00:00Z')
  const removed = []
  return {
    now,
    removed,
    async list(path, { limit, offset }) {
      const files = Object.entries(ages).map(([name, hours]) => ({
        name,
        created_at: hours === null ? null : new Date(now - hours * 3600_000).toISOString(),
      }))
      return { data: files.slice(offset, offset + limit), error: null }
    },
    async remove(paths) {
      removed.push(...paths)
      return { error: null }
    },
  }
}

test('the sweep removes only old files no transaction points at (LED-324)', async () => {
  const { sweepOrphanReceipts } = await import('../src/lib/receiptCleanup.ts')
  const bucket = agedBucket({ 'kept.jpg': 100, 'shared.jpg': 100, 'orphan.jpg': 100, 'fresh.jpg': 1, 'folder': null })
  const refs = ['u1/kept.jpg', 'u1/shared.jpg', 'u1/shared.jpg', null, 'pending-receipt:abc']
  assert.equal(await sweepOrphanReceipts(bucket, 'u1', refs, bucket.now), 1)
  assert.deepEqual(bucket.removed, ['u1/orphan.jpg'])
})

test('an old https receipt URL keeps its file, and an unreadable one stops the sweep (LED-324)', async () => {
  const { sweepOrphanReceipts, receiptObjectPath } = await import('../src/lib/receiptCleanup.ts')
  assert.equal(receiptObjectPath('https://x.supabase.co/storage/v1/object/public/receipts/u1/a%20b.jpg?t=1'), 'u1/a b.jpg')
  assert.equal(receiptObjectPath('https://elsewhere.example/img.jpg'), undefined)

  const bucket = agedBucket({ 'legacy.jpg': 100, 'orphan.jpg': 100 })
  await sweepOrphanReceipts(bucket, 'u1', ['https://x.supabase.co/storage/v1/object/public/receipts/u1/legacy.jpg'], bucket.now)
  assert.deepEqual(bucket.removed, ['u1/orphan.jpg'])

  const stopped = agedBucket({ 'orphan.jpg': 100 })
  assert.equal(await sweepOrphanReceipts(stopped, 'u1', ['https://elsewhere.example/img.jpg'], stopped.now), 0)
  assert.deepEqual(stopped.removed, [])
})
