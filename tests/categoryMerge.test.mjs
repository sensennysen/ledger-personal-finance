import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetNote, mergedSentence, mergeSentence, mergeTargets, parseMergeResult, planSubcategoryMerge } from '../src/lib/categoryMerge.ts'

const cats = [
  { id: 'src', name: 'Src cat', type: 'expense' },
  { id: 'tgt', name: 'Tgt cat', type: 'expense' },
  { id: 'inc', name: 'Inc only', type: 'income' },
  { id: 'gift', name: 'Gift', type: 'both' },
]

test('targets exclude the source and categories that cannot take its rows', () => {
  assert.deepEqual(mergeTargets(cats, cats[0]).map((c) => c.id), ['tgt', 'gift'])
  assert.deepEqual(mergeTargets(cats, cats[2]).map((c) => c.id), ['gift'])
  // A category for both can only merge into another for both.
  assert.deepEqual(mergeTargets(cats, cats[3]).map((c) => c.id), [])
})

// The fixture run through public.merge_category in psql (LED-239 retro): source subcategories
// Market, Bulk, "bulk " (an old duplicate); target subcategory market. The function returned
// subcategories_moved 1, subcategories_folded 2.
const sub = (id, name, sort_order) => ({ id, name, sort_order, created_at: '2026-10-04T00:00:00Z' })
test('subcategories fold by name, including duplicates the source kept, as the function does', () => {
  const source = [sub('a1', 'Market', 0), sub('a2', 'Bulk', 1), sub('a3', 'bulk ', 2)]
  const target = [sub('b1', 'market', 0)]
  assert.deepEqual(planSubcategoryMerge(source, target), { moved: 1, folded: 2 })
  assert.deepEqual(planSubcategoryMerge(source, []), { moved: 2, folded: 1 })
  assert.deepEqual(planSubcategoryMerge([], target), { moved: 0, folded: 0 })
})

test('the function result is read in client names', () => {
  const result = parseMergeResult({
    rules: 1, budgets: 1, transactions: 4, loan_purchases: 0,
    subcategories_moved: 1, subcategories_folded: 2, target_active_budgets: 2,
  })
  assert.deepEqual(result, {
    transactions: 4, subcategoriesMoved: 1, subcategoriesFolded: 2, budgets: 1, rules: 1, loanPurchases: 0, targetActiveBudgets: 2,
  })
  assert.equal(parseMergeResult(null).transactions, 0)
})

test('the confirmation lists what moves, leaving out what is zero', () => {
  const counts = { transactions: 4, subcategoriesMoved: 1, subcategoriesFolded: 2, budgets: 1, rules: 1, loanPurchases: 0 }
  assert.equal(
    mergeSentence(counts, 'Src cat', 'Tgt cat'),
    'Moves 4 transactions, 3 subcategories (2 join one of the same name), 1 budget and 1 auto-categorization rule to Tgt cat, then deletes Src cat.',
  )
  assert.equal(
    mergeSentence({ ...counts, transactions: 1, subcategoriesMoved: 0, subcategoriesFolded: 0, budgets: 0, rules: 0 }, 'A', 'B'),
    'Moves 1 transaction to B, then deletes A.',
  )
  assert.equal(
    mergeSentence({ ...counts, subcategoriesMoved: 0, subcategoriesFolded: 1, transactions: 0, budgets: 0, rules: 0, loanPurchases: 2 }, 'A', 'B'),
    'Moves 1 subcategory (1 joins one of the same name) and 2 financed purchases to B, then deletes A.',
  )
})

test('a category nothing uses says so', () => {
  const zero = { transactions: 0, subcategoriesMoved: 0, subcategoriesFolded: 0, budgets: 0, rules: 0, loanPurchases: 0 }
  assert.equal(mergeSentence(zero, 'Gifts', 'Gift'), 'Nothing uses Gifts yet. Merging deletes it.')
})

test('two budgets on the target are pointed out', () => {
  assert.equal(budgetNote(1, 2, 'Tgt cat'), 'Tgt cat will have 2 budgets. Review them in Budgets.')
  assert.equal(budgetNote(1, 1, 'Tgt cat'), null)
  assert.equal(budgetNote(0, 3, 'Tgt cat'), null)
})

test('the notice after a merge is in the past tense', () => {
  const counts = { transactions: 2, subcategoriesMoved: 1, subcategoriesFolded: 1, budgets: 1, rules: 0, loanPurchases: 0 }
  assert.equal(
    mergedSentence(counts, 'Merge src', 'Merge tgt'),
    'Moved 2 transactions, 2 subcategories (1 joins one of the same name) and 1 budget to Merge tgt and deleted Merge src.',
  )
  const zero = { transactions: 0, subcategoriesMoved: 0, subcategoriesFolded: 0, budgets: 0, rules: 0, loanPurchases: 0 }
  assert.equal(mergedSentence(zero, 'Merge src 2', 'Merge tgt'), 'Nothing used Merge src 2, so it was deleted.')
})
