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

type RawError = { code?: string | null; message?: string | null } | Error | string | null | undefined

export type DataErrorKind = 'connection' | 'unique' | 'permission' | 'unknown'

function parts(err: RawError): { code: string | null; message: string } {
  if (typeof err === 'string') return { code: null, message: err }
  if (!err) return { code: null, message: '' }
  const code = 'code' in err && typeof err.code === 'string' ? err.code : null
  return { code, message: err.message ?? '' }
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
    case 'unique':
      return entity ? `A ${entity} with that name already exists.` : 'That already exists.'
    case 'permission':
      return "You don't have access to that. Sign in again and retry."
    default:
      return `Couldn't ${action} ${entity ? `this ${entity}` : 'that'}. Try again.`
  }
}

/** Plain-language message plus the raw text; null when there was no error. */
export function describeDataError(err: RawError, context: DataErrorContext): DescribedError | null {
  if (!err) return null
  const { code, message } = parts(err)
  const raw = [code, message].filter(Boolean).join(' — ')
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
