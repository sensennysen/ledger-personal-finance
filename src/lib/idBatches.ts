// Reads filtered by a list of ids, in batches (LED-308). PostgREST puts `.in(...)` in the URL, and a
// few thousand UUIDs make a request too long for the server to accept. Pure, so node --test can load it.

/** At 36 characters a UUID, 200 ids keep a filter near 7.5 KB of URL. */
export const ID_BATCH_SIZE = 200

/** `ids` in order, split into lists of at most `size`. */
export function chunkIds<T>(ids: readonly T[], size = ID_BATCH_SIZE): T[][] {
  if (size < 1) throw new Error('Batch size must be at least 1')
  const batches: T[][] = []
  for (let i = 0; i < ids.length; i += size) batches.push(ids.slice(i, i + size))
  return batches
}

/**
 * Runs `read` for each batch of `ids` in turn and joins the rows in batch order. Stops at the first
 * error and returns it, so a partial list is never mistaken for a complete one. Duplicate ids are
 * read once.
 */
export async function readInBatches<Id, Row>(
  ids: readonly Id[],
  read: (batch: Id[]) => PromiseLike<{ rows: Row[]; error: string | null }>,
  size = ID_BATCH_SIZE,
): Promise<{ rows: Row[]; error: string | null }> {
  const rows: Row[] = []
  for (const batch of chunkIds([...new Set(ids)], size)) {
    const result = await read(batch)
    if (result.error) return { rows, error: result.error }
    rows.push(...result.rows)
  }
  return { rows, error: null }
}
