// "N minute read" for a legal page, computed from its words rather than typed (LED-142).
// Pure: the page passes the rendered article text.

export const WORDS_PER_MINUTE = 200

export function wordCount(text: string): number {
  return text.match(/\S+/g)?.length ?? 0
}

/** Whole minutes to read `text`, rounded up, at least one. */
export function readingMinutes(text: string, wordsPerMinute: number = WORDS_PER_MINUTE): number {
  return Math.max(1, Math.ceil(wordCount(text) / wordsPerMinute))
}
