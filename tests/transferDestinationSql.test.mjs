import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

// LED-185: the database credits a transfer's destination with coalesce(destination_amount,
// amount * exchange_rate), the figure src/lib/transferCredit.ts mirrors. These read the latest
// migration that defines each function or trigger, which is what a fresh database ends up with.
const dir = new URL('../supabase/migrations/', import.meta.url)
const migrations = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(new URL(name, dir), 'utf8') }))

const latest = (pattern) => {
  const found = migrations.filter(({ sql }) => pattern.test(sql))
  assert.ok(found.length > 0, `no migration matches ${pattern}`)
  return found[found.length - 1]
}

test('transactions has a destination_amount that is null or positive', () => {
  const { sql } = latest(/add column if not exists destination_amount/)
  assert.match(sql, /destination_amount numeric\(18, ?2\)/)
  assert.match(sql, /check \(destination_amount is null or destination_amount > 0\)/)
})

test('the balance trigger credits and reverses the destination by the same coalesce', () => {
  const { name, sql } = latest(/create or replace function public\.update_account_balance\(\)/)
  assert.equal(name, '20261003120000_transfer_destination_amount.sql')
  assert.match(sql, /balance \+ coalesce\(new\.destination_amount, new\.amount \* new\.exchange_rate\)/)
  assert.match(sql, /balance - coalesce\(old\.destination_amount, old\.amount \* old\.exchange_rate\)/)
})

test('an edit to the destination amount alone fires the balance and card-payment triggers', () => {
  const balance = latest(/create trigger trg_update_balance_update/).sql
  assert.match(balance, /after update of [^;]*\bdestination_amount\b[^;]*on public\.transactions/)
  const card = latest(/create trigger trg_sync_card_payment_update/).sql
  assert.match(card, /after update of [^;]*\bdestination_amount\b[^;]*on public\.transactions/)
})

test('the card payment and the recurring copy use the destination amount too', () => {
  const card = latest(/create or replace function public\.sync_card_payment_on_transfer_update\(\)/).sql
  const credits = [...card.matchAll(/credited := ([^;]+);/g)].map((m) => m[1])
  assert.equal(credits.length, 2)
  for (const credit of credits) assert.match(credit, /^coalesce\(new\.destination_amount, /)
  const recurring = latest(/create or replace function public\.post_recurring_transaction\(/).sql
  assert.match(recurring, /exchange_rate, destination_amount, description/)
  assert.match(recurring, /src\.exchange_rate, src\.destination_amount, src\.description/)
})
