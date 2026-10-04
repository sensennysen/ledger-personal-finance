// Saved Activity filters (LED-138). Pure: the hook stores these, the palette and Activity read them.

import { ACTIVITY_SORTS, type ActivitySort } from './transactionWindow.ts'

export type FilterType = 'all' | 'income' | 'expense' | 'transfer'

/** What Activity filters on. The cycle is not part of it: a filter applies to the cycle on screen. */
export interface ActivityFilter {
  type: FilterType
  search: string
  tag: string | null
  /** Kept with the filter (LED-241). Version 1 rows saved before it read as newest first. */
  sort: ActivitySort
}

export interface SavedFilter {
  id: string
  name: string
  filter: ActivityFilter
}

/** A row as the database returns it, before its `filter` JSON is trusted. */
export interface SavedFilterRow {
  id: string
  name: string
  filter: unknown
}

export const SAVED_FILTER_VERSION = 1
export const SAVED_FILTER_NAME_MAX = 60

const TYPES: readonly FilterType[] = ['all', 'income', 'expense', 'transfer']
const TYPE_LABELS: Record<Exclude<FilterType, 'all'>, string> = {
  income: 'Income',
  expense: 'Expenses',
  transfer: 'Transfers',
}
const SORT_LABELS: Record<Exclude<ActivitySort, 'newest'>, string> = {
  oldest: 'Oldest first',
  largest: 'Largest first',
  smallest: 'Smallest first',
}

function readSort(value: unknown): ActivitySort | null {
  return typeof value === 'string' && ACTIVITY_SORTS.includes(value as ActivitySort) ? (value as ActivitySort) : null
}

export const EMPTY_FILTER: ActivityFilter = { type: 'all', search: '', tag: null, sort: 'newest' }

export function isFilterActive(filter: ActivityFilter): boolean {
  return filter.type !== 'all' || filter.search.trim() !== '' || filter.tag !== null || filter.sort !== 'newest'
}

/** The JSON stored in `saved_filters.filter`. */
export function serializeFilter(filter: ActivityFilter): Record<string, unknown> {
  return { v: SAVED_FILTER_VERSION, type: filter.type, search: filter.search.trim(), tag: filter.tag, sort: filter.sort }
}

/**
 * Reads stored JSON back. Anything that is not a version 1 filter is null, never a guess. A row
 * saved before sorts were kept has no `sort` and reads as newest first; an unknown sort is null.
 */
export function parseFilter(raw: unknown): ActivityFilter | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (value.v !== SAVED_FILTER_VERSION) return null
  if (typeof value.type !== 'string' || !TYPES.includes(value.type as FilterType)) return null
  if (typeof value.search !== 'string') return null
  if (value.tag !== null && typeof value.tag !== 'string') return null
  const sort = value.sort === undefined ? 'newest' : readSort(value.sort)
  if (sort === null) return null
  return { type: value.type as FilterType, search: value.search, tag: value.tag, sort }
}

/** Rows whose filter cannot be read are left out; `skipped` says how many, so it can be shown. */
export function parseSavedFilters(rows: SavedFilterRow[]): { filters: SavedFilter[]; skipped: number } {
  const filters: SavedFilter[] = []
  let skipped = 0
  for (const row of rows) {
    const filter = parseFilter(row.filter)
    if (filter) filters.push({ id: row.id, name: row.name, filter })
    else skipped += 1
  }
  return { filters, skipped }
}

/** The row to insert to bring a deleted filter back. The same `id` keeps its place in the name-then-id order. */
export function restoreSavedFilterRow(saved: SavedFilter): { id: string; name: string; filter: Record<string, unknown> } {
  return { id: saved.id, name: saved.name, filter: serializeFilter(saved.filter) }
}

export function normalizeFilterName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

/** A message for a name that cannot be saved, or null. Same-name check ignores case, as the database does. */
export function validateFilterName(name: string, existing: SavedFilter[], exceptId?: string): string | null {
  const clean = normalizeFilterName(name)
  if (!clean) return 'Give the filter a name.'
  if (clean.length > SAVED_FILTER_NAME_MAX) return `Keep the name to ${SAVED_FILTER_NAME_MAX} characters.`
  const taken = existing.some((saved) => saved.id !== exceptId && saved.name.toLowerCase() === clean.toLowerCase())
  return taken ? 'A saved filter with that name already exists.' : null
}

/** "Expenses · “grab” · #travel": what a saved filter does, for a list row. */
export function describeFilter(filter: ActivityFilter): string {
  const parts: string[] = []
  if (filter.type !== 'all') parts.push(TYPE_LABELS[filter.type])
  if (filter.search.trim()) parts.push(`“${filter.search.trim()}”`)
  if (filter.tag) parts.push(`#${filter.tag}`)
  if (filter.sort !== 'newest') parts.push(SORT_LABELS[filter.sort])
  return parts.length > 0 ? parts.join(' · ') : 'All transactions'
}

/** Saved filters whose name or description contains the query; an empty query lists them all. */
export function matchSavedFilters(filters: SavedFilter[], query: string): SavedFilter[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return filters
  return filters.filter(
    (saved) => saved.name.toLowerCase().includes(needle) || describeFilter(saved.filter).toLowerCase().includes(needle),
  )
}

/**
 * The Activity link that applies a filter. It carries the filter itself rather than an id, so it
 * works before saved filters have loaded and does not depend on a second read.
 */
export function activityFilterPath(filter: ActivityFilter): string {
  const params = new URLSearchParams()
  params.set('q', filter.search.trim())
  if (filter.type !== 'all') params.set('type', filter.type)
  if (filter.tag) params.set('tag', filter.tag)
  if (filter.sort !== 'newest') params.set('sort', filter.sort)
  return `/transactions?${params.toString()}`
}

/**
 * The filter a link asks for, or null when it asks for none. `q` alone is the palette's
 * "See all" handoff; `type`, `tag` and `sort` come from a saved filter. Anything missing resets, so an
 * old filter never lingers under a new one.
 */
export function filterFromParams(params: URLSearchParams): ActivityFilter | null {
  const q = params.get('q')
  const type = params.get('type')
  const tag = params.get('tag')
  const sort = params.get('sort')
  if (q === null && type === null && tag === null && sort === null) return null
  return {
    type: type !== null && TYPES.includes(type as FilterType) ? (type as FilterType) : 'all',
    search: q ?? '',
    tag: tag || null,
    sort: readSort(sort) ?? 'newest',
  }
}
