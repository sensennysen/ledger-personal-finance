import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  notificationDefaults,
  createNotification,
  dismissNotification,
} from '../src/lib/notifications.ts'

test('success closes itself and is announced politely', () => {
  assert.deepEqual(notificationDefaults('success'), { duration: 5000, role: 'status' })
})

test('failure and partial failure stay until acted on and interrupt', () => {
  assert.deepEqual(notificationDefaults('failure'), { duration: null, role: 'alert' })
  assert.deepEqual(notificationDefaults('partial'), { duration: null, role: 'alert' })
})

test('a failure gets its severity defaults', () => {
  const second = createNotification({ severity: 'failure', title: "Couldn't delete" }, 2)
  assert.equal(second.id, 2)
  assert.equal(second.title, "Couldn't delete")
  assert.equal(second.role, 'alert')
})

test('dismissing an old notification leaves a newer one alone', () => {
  const current = createNotification({ severity: 'success', title: 'Saved' }, 2)
  assert.equal(dismissNotification(current, 1), current)
  assert.equal(dismissNotification(current, 2), null)
})
