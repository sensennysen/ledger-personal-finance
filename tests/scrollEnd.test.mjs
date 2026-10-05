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

import { hiddenByScroll } from '../src/lib/scrollEnd.ts'

test('scrolling down hides the FAB, scrolling up brings it back', () => {
  assert.equal(hiddenByScroll(0, 40, false), true)
  assert.equal(hiddenByScroll(400, 300, true), false)
})

test('small moves keep the current state', () => {
  assert.equal(hiddenByScroll(100, 105, false), false)
  assert.equal(hiddenByScroll(100, 95, true), true)
})

test('at the top the FAB always shows, even after an overscroll bounce', () => {
  assert.equal(hiddenByScroll(50, 0, true), false)
  assert.equal(hiddenByScroll(0, -20, true), false)
})
