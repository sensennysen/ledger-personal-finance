import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eitherAccountFilter, filterValue } from '../src/lib/accountFilter.ts'

const ID = '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c'

test('a UUID goes into the filter as-is (LED-331)', () => {
  assert.equal(eitherAccountFilter(ID), `account_id.eq.${ID},to_account_id.eq.${ID}`)
})

test('anything else is one quoted value, so it cannot add conditions (LED-331)', () => {
  assert.equal(filterValue('x,user_id.neq.y'), '"x,user_id.neq.y"')
  assert.equal(filterValue('a"b\\c'), '"a\\"b\\\\c"')
  assert.equal(
    eitherAccountFilter('x),or(user_id.neq.y'),
    'account_id.eq."x),or(user_id.neq.y",to_account_id.eq."x),or(user_id.neq.y"',
  )
})
