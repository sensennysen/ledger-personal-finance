/**
 * True for a failed import of a code-split chunk (LED-317): offline before the chunk was ever
 * cached, or a deploy removed the file an open tab still points at. The browsers word it
 * differently; none sets a code.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk/i.test(error.message)
}
