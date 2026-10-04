export type DataAction = 'load' | 'save' | 'delete'

export interface DataErrorContext {
  action: DataAction
  /** Singular noun for the record, e.g. 'category', used where the sentence names it. */
  entity?: string
}

export interface DescribedError {
  /** Plain sentence for the user. */
  message: string
  /** Raw text, kept collapsed for a support conversation. */
  detail: string | null
}

type RawError = { code?: string | null; message?: string | null; hint?: string | null } | Error | string | null | undefined

/** Hint a database function sets when its message is already a sentence for the user. */
export const USER_MESSAGE_HINT = 'user-message'

export type DataErrorKind = 'connection' | 'unique' | 'permission' | 'unknown'

function parts(err: RawError): { code: string | null; message: string; hint: string | null } {
  if (typeof err === 'string') return { code: null, message: err, hint: null }
  if (!err) return { code: null, message: '', hint: null }
  const code = 'code' in err && typeof err.code === 'string' ? err.code : null
  const hint = 'hint' in err && typeof err.hint === 'string' ? err.hint : null
  return { code, message: err.message ?? '', hint }
}

/**
 * The failures that actually reach users: the network dropped, a name is already
 * taken, or row-level security refused. Codes first; message text as a fallback
 * because some callers (pagedRead) only keep the string.
 */
export function classifyDataError(err: RawError): DataErrorKind {
  const { code, message } = parts(err)
  const text = message.toLowerCase()
  if (code?.startsWith('08') || /failed to fetch|networkerror|fetch failed|load failed|network request failed/.test(text)) {
    return 'connection'
  }
  if (code === '23505' || text.includes('duplicate key')) return 'unique'
  if (code === '42501' || text.includes('row-level security') || text.includes('permission denied')) return 'permission'
  return 'unknown'
}

function sentence(kind: DataErrorKind, { action, entity }: DataErrorContext): string {
  switch (kind) {
    case 'connection':
      return action === 'load'
        ? "Couldn't reach the server. Check your connection and try again."
        : "Couldn't reach the server. Check your connection and try again. Nothing was changed."
    case 'unique': {
      if (!entity) return 'That already exists.'
      const article = /^[aeiou]/i.test(entity) ? 'An' : 'A'
      return `${article} ${entity} with that name already exists.`
    }
    case 'permission':
      return "You don't have access to that. Sign in again and retry."
    default:
      return `Couldn't ${action} ${entity ? `this ${entity}` : 'that'}. Try again.`
  }
}

/** Plain-language message plus the raw text; null when there was no error. */
export function describeDataError(err: RawError, context: DataErrorContext): DescribedError | null {
  if (!err) return null
  const { code, message, hint } = parts(err)
  const raw = [code, message].filter(Boolean).join(' — ')
  // A check in the database wrote the sentence itself (e.g. which name clashes); show it as is.
  if (hint === USER_MESSAGE_HINT && message) return { message, detail: raw || null }
  return { message: sentence(classifyDataError(err), context), detail: raw || null }
}

/** Hook mutation result: `error` is the sentence callers show, `errorDetail` the raw text. */
export function toResult(err: RawError, context: DataErrorContext): Required<MutationResult> {
  const described = describeDataError(err, context)
  return { error: described?.message ?? null, errorDetail: described?.detail ?? null }
}

/** What hook mutations return. `errorDetail` is absent for errors the app wrote itself. */
export interface MutationResult {
  error: string | null
  errorDetail?: string | null
}

/** A form's error: the app's own sentence, or a described failure with its raw text. */
export type FormErrorValue = string | DescribedError | null

/** Keeps a hook result's raw text alongside its sentence for <FormError>. */
export function withDetail(result: MutationResult): DescribedError | null {
  return result.error ? { message: result.error, detail: result.errorDetail ?? null } : null
}
