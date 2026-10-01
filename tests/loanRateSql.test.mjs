import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { MAX_MONTHLY_INTEREST_PCT } from '../src/lib/loanRate.ts'

const dir = new URL('../supabase/migrations/', import.meta.url)
const CONSTRAINT = 'loan_purchases_monthly_interest_rate_max'

const migrationsMentioningCap = () =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(new URL(name, dir), 'utf8') }))
    .filter(({ sql }) => sql.includes(CONSTRAINT))

test('the server cap is a named NOT VALID check', () => {
  const found = migrationsMentioningCap()
  assert.ok(found.length > 0, 'no migration adds the interest rate cap')
  const sql = found.map((m) => m.sql).join('\n')
  assert.match(sql, /add constraint loan_purchases_monthly_interest_rate_max\s+check \(monthly_interest_rate <= \d+(\.\d+)?\) not valid/)
})

test('the SQL limit equals MAX_MONTHLY_INTEREST_PCT', () => {
  const found = migrationsMentioningCap()
  const limits = found.flatMap(({ sql }) =>
    [...sql.matchAll(/monthly_interest_rate\s*<=\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])),
  )
  assert.ok(limits.length > 0, 'no limit found in the migration')
  // The latest migration that touches the constraint decides what the database enforces.
  assert.equal(limits[limits.length - 1], MAX_MONTHLY_INTEREST_PCT)
})

test('the migration adds the check without validating existing rows', () => {
  const { sql } = migrationsMentioningCap().at(-1)
  assert.doesNotMatch(sql, /validate constraint/i)
  assert.match(sql, /drop constraint if exists loan_purchases_monthly_interest_rate_max/)
})
