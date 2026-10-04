import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compareAccountsForPicker,
  orderAccountsForPicker,
  pickerGroupOrder,
  pickOfflineDefaultAccount,
} from '../src/lib/accountDefault.ts'

const DEFAULTS = ['checking', 'savings', 'credit_card', 'loan']
const acct = (id, type, name, sort_order = 0, currency = 'USD') => ({ id, type, name, sort_order, currency })

test('the group order starts with the user preference and appends any type it leaves out', () => {
  assert.deepEqual(pickerGroupOrder(['savings', 'loan'], DEFAULTS), ['savings', 'loan', 'checking', 'credit_card'])
  assert.deepEqual(pickerGroupOrder(null, DEFAULTS), DEFAULTS)
  assert.deepEqual(pickerGroupOrder(undefined, DEFAULTS), DEFAULTS)
})

test('inside a group accounts sort by sort_order, then by name', () => {
  assert.ok(compareAccountsForPicker(acct('a', 'checking', 'Zed', 0), acct('b', 'checking', 'Amy', 1)) < 0)
  assert.ok(compareAccountsForPicker(acct('a', 'checking', 'Amy', 1), acct('b', 'checking', 'Zed', 1)) < 0)
})

test('the picker order is group by group, not the order the list arrived in', () => {
  const accounts = [acct('c', 'credit_card', 'Visa'), acct('s', 'savings', 'Rainy'), acct('k', 'checking', 'Main')]
  assert.deepEqual(orderAccountsForPicker(accounts, DEFAULTS).map((a) => a.id), ['k', 's', 'c'])
  assert.deepEqual(orderAccountsForPicker(accounts, pickerGroupOrder(['credit_card'], DEFAULTS)).map((a) => a.id), ['c', 'k', 's'])
})

test('offline default is the first account the picker shows, with its currency (LED-197)', () => {
  const accounts = [acct('s', 'savings', 'Rainy', 0, 'EUR'), acct('k', 'checking', 'Main', 0, 'GBP')]
  const picked = pickOfflineDefaultAccount(accounts, DEFAULTS)
  assert.equal(picked?.id, 'k')
  assert.equal(picked?.currency, 'GBP')
  assert.equal(pickOfflineDefaultAccount(accounts, pickerGroupOrder(['savings'], DEFAULTS))?.id, 's')
})

test('a single account is the default; no cache or an empty one gives none, so the empty state stays', () => {
  assert.equal(pickOfflineDefaultAccount([acct('only', 'loan', 'Car')], DEFAULTS)?.id, 'only')
  assert.equal(pickOfflineDefaultAccount([], DEFAULTS), null)
  assert.equal(pickOfflineDefaultAccount(null, DEFAULTS), null)
  assert.equal(pickOfflineDefaultAccount(undefined, DEFAULTS), null)
})

test('the input list is not reordered in place', () => {
  const accounts = [acct('b', 'checking', 'B', 2), acct('a', 'checking', 'A', 1)]
  orderAccountsForPicker(accounts, DEFAULTS)
  assert.deepEqual(accounts.map((a) => a.id), ['b', 'a'])
})
