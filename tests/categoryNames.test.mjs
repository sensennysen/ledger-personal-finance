import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clashSentence, findNameClash, normaliseCategoryName } from '../src/lib/categoryNames.ts'

const cats = [
  { id: 'a', name: 'Groceries' },
  { id: 'b', name: ' Dining ' },
  { id: 'c', name: 'Food' },
  { id: 'd', name: 'food' }, // an existing duplicate, kept
]

test('names compare case-insensitively with surrounding spaces ignored', () => {
  assert.equal(normaliseCategoryName('  GroCeries '), 'groceries')
  assert.equal(findNameClash('groceries', cats)?.id, 'a')
  assert.equal(findNameClash('  DINING', cats)?.id, 'b')
})

test('inner spaces and other names are not a clash', () => {
  assert.equal(findNameClash('Groc eries', cats), null)
  assert.equal(findNameClash('Transport', cats), null)
  assert.equal(findNameClash('   ', cats), null)
})

test('a rename to its own name, or a case change of it, is not a clash', () => {
  assert.equal(findNameClash('Groceries', cats, cats[0]), null)
  assert.equal(findNameClash('GROCERIES ', cats, cats[0]), null)
  // An existing duplicate can be tidied in case, and renamed away.
  assert.equal(findNameClash('FOOD', cats, cats[3]), null)
  assert.equal(findNameClash('Snacks', cats, cats[3]), null)
})

test('a rename onto a sibling clashes and names it', () => {
  assert.equal(findNameClash('dining', cats, cats[0])?.id, 'b')
})

test('siblings are per parent: the same subcategory name under another category is allowed', () => {
  const groceriesSubs = [{ id: 's1', name: 'Market' }]
  const diningSubs = [{ id: 's2', name: 'Takeaway' }]
  assert.equal(findNameClash('market', groceriesSubs)?.id, 's1')
  assert.equal(findNameClash('market', diningSubs), null)
})

test('the sentences match the database trigger', () => {
  assert.equal(clashSentence('category', ' Groceries '), 'A category named "Groceries" already exists.')
  assert.equal(clashSentence('subcategory', 'Market', 'Groceries'), 'A subcategory named "Market" already exists in Groceries.')
  assert.equal(clashSentence('subcategory', 'Market'), 'A subcategory named "Market" already exists in this category.')
})
