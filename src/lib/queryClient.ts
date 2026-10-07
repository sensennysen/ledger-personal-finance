import { QueryClient } from '@tanstack/react-query'

/**
 * The one store entity reads share (LED-321): hooks mounting the same key in the same tick read
 * once, and every instance sees the same rows, loading and error.
 *
 * - `retry: false`: readWithPolicy is the only retry policy (first loads fail fast, LED-242).
 * - No refetch on focus, as before; a reconnect refetches what is on screen.
 * - `networkMode: 'online'`: offline, a read waits instead of failing, and resumes on reconnect.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: 'online',
        staleTime: 30_000,
      },
    },
  })
}

export const queryClient = createQueryClient()

/**
 * Sign-out or a switch to another account: reads still in flight are cancelled, so none writes
 * its copy back, and every stored result goes (LED-295).
 */
export function forgetQueries(): void {
  void queryClient.cancelQueries()
  queryClient.clear()
}
