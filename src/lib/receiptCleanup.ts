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
