// Account deletion removes the user's receipt images first (LED-189). delete_user() deletes the
// auth user and every table cascades from it, but files in the private `receipts` bucket are not
// rows of those tables, so they outlived the account. They live under `<user id>/` (receiptUrls.ts
// buildReceiptObjectPath) and are removed through the Storage API, which applies the bucket's own policies.
// Pure: the bucket is passed in, so `node --test` can drive it with a fake.

export interface ReceiptBucket {
  list(
    path: string,
    options: { limit: number; offset: number },
  ): Promise<{ data: { name: string }[] | null; error: unknown }>
  remove(paths: string[]): Promise<{ error: unknown }>
}

/** Thrown when a receipt could not be listed or removed; the account is then left as it was. */
export class ReceiptCleanupError extends Error {
  readonly cause: unknown
  constructor(cause: unknown) {
    super("Your receipt images couldn't be removed, so your account was not deleted. Try again.")
    this.name = 'ReceiptCleanupError'
    this.cause = cause
  }
}

const PAGE = 1000

/** Removes every file under `<userId>/` and returns how many there were. */
export async function removeUserReceipts(bucket: ReceiptBucket, userId: string): Promise<number> {
  const paths: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket.list(userId, { limit: PAGE, offset })
    if (error) throw new ReceiptCleanupError(error)
    const page = data ?? []
    paths.push(...page.map((file) => `${userId}/${file.name}`))
    if (page.length < PAGE) break
  }
  for (let start = 0; start < paths.length; start += PAGE) {
    const { error } = await bucket.remove(paths.slice(start, start + PAGE))
    if (error) throw new ReceiptCleanupError(error)
  }
  return paths.length
}

/**
 * Thrown when the receipts were removed but delete_user() then failed (LED-332). The images are
 * already gone, so the account is not "as it was": the message says so and asks the user to
 * finish the deletion rather than walk away from an account whose receipts no longer open.
 */
export class AccountDeletionIncompleteError extends Error {
  readonly cause: unknown
  constructor(cause: unknown) {
    super('Your receipt images were removed, but your account could not be deleted. Try again to finish deleting it.')
    this.name = 'AccountDeletionIncompleteError'
    this.cause = cause
  }
}

/**
 * Receipts first, then the account (LED-189, LED-332). Storage can only be cleared while the
 * user still exists, so the order stays; delete_user() is retried so a dropped request does not
 * leave the account behind with its receipts removed.
 */
export async function deleteAccountWithReceipts(
  bucket: ReceiptBucket,
  userId: string,
  deleteUser: () => PromiseLike<{ error: unknown }>,
  attempts = 3,
): Promise<void> {
  await removeUserReceipts(bucket, userId)
  let lastError: unknown = null
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const { error } = await deleteUser()
      if (!error) return
      lastError = error
    } catch (err) {
      lastError = err
    }
  }
  throw new AccountDeletionIncompleteError(lastError)
}
