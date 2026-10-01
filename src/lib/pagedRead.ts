export interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

/**
 * PostgREST caps a response at 1,000 rows and truncates silently, so read
 * page by page until one comes back short. `fetchPage` must apply a total
 * order (e.g. date, then id) and `.range(from, to)`. `isCancelled` is checked after
 * each page; once it is true the read stops and returns what it has, which the caller
 * (who asked to cancel) must discard.
 */
export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
  isCancelled: () => boolean = () => false,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (isCancelled()) return { rows, error: null }
    if (error) return { rows, error: error.message }
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return { rows, error: null }
  }
}
