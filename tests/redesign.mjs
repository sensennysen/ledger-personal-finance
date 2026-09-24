import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
})
try {
  const { getCustomMonthRange, getCurrentCycleMonthKey } =
    await server.ssrLoadModule('/src/lib/utils.ts')
  const { getBudgetCycleRange } = await server.ssrLoadModule(
    '/src/lib/budgetCycle.ts',
  )
  const today = new Date('2026-09-08T12:00:00')
  assert.equal(
    getCurrentCycleMonthKey(25, new Date('2026-01-10T12:00:00')),
    '2025-12',
  )
  assert.deepEqual(getBudgetCycleRange('weekly', '2026-09', 1, today), {
    start: '2026-09-07',
    end: '2026-09-13',
  })
  assert.deepEqual(getBudgetCycleRange('quarterly', '2026-04', 1, today), {
    start: '2026-04-01',
    end: '2026-06-30',
  })
  assert.deepEqual(getBudgetCycleRange('yearly', '2025-12', 25, today), {
    start: '2025-01-01',
    end: '2025-12-31',
  })
  const { transactionSchema } = await server.ssrLoadModule(
    '/src/components/transactions/transactionFormSchema.ts',
  )
  assert.deepEqual(getCustomMonthRange('2026-12', 25), {
    start: '2026-12-25',
    end: '2027-01-24',
  })
  assert.deepEqual(getCustomMonthRange('2024-02', 1), {
    start: '2024-02-01',
    end: '2024-02-29',
  })
  assert.deepEqual(getCustomMonthRange('2026-02', 28), {
    start: '2026-02-28',
    end: '2026-03-27',
  })
  const expense = {
    type: 'expense',
    account_id: 'test-account',
    to_account_id: null,
    category_id: null,
    subcategory_id: null,
    amount: 10.25,
    currency: 'PHP',
    exchange_rate: 1,
    description: 'Food',
    notes: null,
    date: '2026-09-08',
    transfer_fee: null,
    is_recurring: false,
    recurrence_interval: null,
    recurrence_end_date: null,
    receipt_url: null,
    tags: [],
    goal_id: null,
  }
  assert.equal(transactionSchema.safeParse(expense).success, true)
  assert.equal(
    transactionSchema.safeParse({ ...expense, amount: 0 }).success,
    false,
  )
  assert.equal(
    transactionSchema.safeParse({ ...expense, account_id: '' }).success,
    false,
  )
  assert.equal(
    transactionSchema.safeParse({ ...expense, type: 'transfer' }).success,
    false,
  )
  assert.equal(
    transactionSchema.safeParse({
      ...expense,
      type: 'transfer',
      to_account_id: 'destination',
    }).success,
    true,
  )
  console.log(
    'Redesign checks passed: cycle boundaries and transaction validation.',
  )
} finally {
  await server.close()
}
