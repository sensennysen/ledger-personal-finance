import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNearScrollEnd } from '../src/lib/scrollEnd.ts'

test('a page that does not scroll never hides the FAB', () => {
  assert.equal(isNearScrollEnd({ scrollTop: 0, scrollHeight: 600, clientHeight: 600 }), false)
  assert.equal(isNearScrollEnd({ scrollTop: 0, scrollHeight: 650, clientHeight: 600 }), false)
})

test('the FAB stays visible mid-scroll', () => {
  assert.equal(isNearScrollEnd({ scrollTop: 100, scrollHeight: 2000, clientHeight: 700 }), false)
})

test('the FAB hides within its clearance of the end and returns on scroll up', () => {
  assert.equal(isNearScrollEnd({ scrollTop: 1300, scrollHeight: 2000, clientHeight: 700 }), true)
  assert.equal(isNearScrollEnd({ scrollTop: 1200, scrollHeight: 2000, clientHeight: 700 }), false)
})
