// Saved transaction templates (LED-257). Pure: the hook stores these in `transaction_templates`,
// Activity's Quick add strip reads them.

/** What a template keeps: the transaction form's values without a date. Checked loosely on read. */
export type TemplateFields = Record<string, unknown> & {
  type: 'income' | 'expense' | 'transfer'
  account_id: string
  amount: number
  currency: string
}

export interface TransactionTemplate<F = TemplateFields> {
  id: string
  name: string
  values: F
  createdAt: string
}

/** A row as the database returns it, before its `fields` JSON is trusted. */
export interface TransactionTemplateRow {
  id: string
  name: string
  fields: unknown
  created_at: string
}

export const TEMPLATE_VERSION = 1
export const TEMPLATE_NAME_MAX = 60

/** Where templates lived before LED-257: one key for the whole browser, whoever signed in. */
export const LEGACY_TEMPLATES_KEY = 'ledger_transaction_templates'

const TYPES = ['income', 'expense', 'transfer']

/** Removes the old browser-wide key: after an upload, and on sign-out so the next person sees none. */
export function forgetLegacyTemplates(): void {
  try {
    localStorage.removeItem(LEGACY_TEMPLATES_KEY)
  } catch {
    /* storage unavailable: nothing to remove */
  }
}

export function normalizeTemplateName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, TEMPLATE_NAME_MAX)
}

/** The JSON stored in `transaction_templates.fields`. A date is never kept: using a template dates it today. */
export function serializeTemplateFields(values: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { date: _date, v: _v, ...rest } = values
  return { v: TEMPLATE_VERSION, ...rest }
}

/** Reads stored JSON back. Anything that is not a version 1 template with its core fields is null. */
export function parseTemplateFields(raw: unknown): TemplateFields | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (value.v !== TEMPLATE_VERSION) return null
  return readCoreFields(value)
}

function readCoreFields(value: Record<string, unknown>): TemplateFields | null {
  if (typeof value.type !== 'string' || !TYPES.includes(value.type)) return null
  if (typeof value.account_id !== 'string' || value.account_id === '') return null
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount)) return null
  if (typeof value.currency !== 'string' || value.currency === '') return null
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { v: _v, date: _date, ...rest } = value
  return rest as TemplateFields
}

/** Rows whose fields cannot be read are left out; `skipped` says how many. */
export function parseTemplateRows(rows: TransactionTemplateRow[]): { templates: TransactionTemplate[]; skipped: number } {
  const templates: TransactionTemplate[] = []
  let skipped = 0
  for (const row of rows) {
    const values = parseTemplateFields(row.fields)
    if (values) templates.push({ id: row.id, name: row.name, values, createdAt: row.created_at })
    else skipped += 1
  }
  return { templates, skipped }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The templates in the browser's old key, as rows to insert for `userId`. Each keeps its own id
 * (when it has a valid one) and date, so uploading the same key twice inserts nothing new.
 * Unreadable JSON or entries are dropped: there is nothing to recover from them.
 */
export function legacyTemplateRows(raw: string | null, userId: string): { id?: string; user_id: string; name: string; fields: Record<string, unknown>; created_at?: string }[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const rows = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const { id, name, values, createdAt } = entry as Record<string, unknown>
    const clean = typeof name === 'string' ? normalizeTemplateName(name) : ''
    if (!clean || typeof values !== 'object' || values === null || Array.isArray(values)) continue
    const fields = readCoreFields(values as Record<string, unknown>)
    if (!fields) continue
    rows.push({
      ...(typeof id === 'string' && UUID.test(id) ? { id } : {}),
      user_id: userId,
      name: clean,
      fields: serializeTemplateFields(fields),
      ...(typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)) ? { created_at: createdAt } : {}),
    })
  }
  return rows
}

/**
 * Whether this load uploads the browser's old templates: only when the account has none yet, so a
 * second load, a second tab or another device that already uploaded never adds them again.
 */
export function shouldUploadLegacy(legacyCount: number, accountCount: number): boolean {
  return legacyCount > 0 && accountCount === 0
}

/**
 * The Activity banner's sentence for a templates failure. A failed read says which read failed; a
 * failed upload of this browser's old templates is a save, and says so on its own (LED-285).
 */
export function templatesErrorMessage(kind: 'load' | 'save', stale: boolean, error: string): string {
  if (kind === 'save') return error
  return stale ? `Couldn't refresh your templates. ${error}` : `Couldn't load your templates. ${error}`
}
