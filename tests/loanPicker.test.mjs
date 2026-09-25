import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveInitialLoanId } from '../src/lib/loanPicker.ts'

const loan = (id) => ({ id })

test('no loans: nothing is picked', () => {
  assert.equal(resolveInitialLoanId([], null, 'none'), null)
})

test('exactly one loan is picked', () => {
  assert.equal(resolveInitialLoanId([loan('a')], null, 'none'), 'a')
})

test('two or more loans: nothing is picked', () => {
  assert.equal(resolveInitialLoanId([loan('a'), loan('b')], null, 'none'), null)
  assert.equal(resolveInitialLoanId([loan('a'), loan('b'), loan('c')], undefined, 'none'), null)
})

test('a locked loan wins regardless of how many loans exist', () => {
  assert.equal(resolveInitialLoanId([loan('a'), loan('b')], 'b', 'none'), 'b')
  assert.equal(resolveInitialLoanId([loan('a')], 'a', 'none'), 'a')
  assert.equal(resolveInitialLoanId([], 'a', 'none'), 'a')
})

test('editing a saved repayment never auto-picks; the form keeps its own loan', () => {
  assert.equal(resolveInitialLoanId([loan('a')], null, 'loan'), null)
  assert.equal(resolveInitialLoanId([loan('a'), loan('b')], null, 'loan'), null)
})
