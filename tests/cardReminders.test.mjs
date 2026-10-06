import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REMINDER_KEEP_DAYS, dueCardReminders, legacyReminderRows, legacyRemindersKey, pruneCutoff } from '../src/lib/cardReminders.ts'

const today = '2026-10-06'
const card = { id: 'acc-1', name: 'Visa', currency: 'PHP', statementDays: 5, dueDays: 10, remainingToPay: 0, reminderDays: 3 }

test('statement day and a payment coming due each call for a reminder with its own key', () => {
  const reminders = dueCardReminders([{ ...card, statementDays: 0, dueDays: 2, remainingToPay: 1500 }], today)
  assert.deepEqual(reminders.map((r) => r.key), ['acc-1:statement:2026-10-06', 'acc-1:due:2026-10-06:2'])
  assert.match(reminders[1].title, /Due Soon/)
  assert.match(reminders[1].body, /1500\.00 PHP/)
})

test('nothing is due: no statement today, nothing owed, or the due day is further than the reminder window', () => {
  assert.deepEqual(dueCardReminders([card], today), [])
  assert.deepEqual(dueCardReminders([{ ...card, dueDays: 1 }], today), [])
  assert.deepEqual(dueCardReminders([{ ...card, dueDays: 4, remainingToPay: 10 }], today), [])
  assert.deepEqual(dueCardReminders([{ ...card, dueDays: null, statementDays: null, remainingToPay: 10 }], today), [])
})

test('due today says so', () => {
  const [reminder] = dueCardReminders([{ ...card, dueDays: 0, remainingToPay: 10 }], today)
  assert.equal(reminder.key, 'acc-1:due:2026-10-06:0')
  assert.match(reminder.title, /Due Today/)
})

test('rows older than the keep window are pruned', () => {
  assert.equal(REMINDER_KEEP_DAYS, 60)
  assert.equal(pruneCutoff('2026-10-06'), '2026-08-07')
  assert.equal(pruneCutoff('2026-03-01'), '2025-12-31')
})

test('the old browser map uploads its reminder keys, dated by their own day, within the window', () => {
  const raw = JSON.stringify({
    'acc-1:statement:2026-10-01': true,
    'acc-1:due:2026-09-28:3': true,
    'acc-1:due:2026-05-01:0': true,
    'not-a-reminder': true,
    'acc-2:due:2026-10-02:1': false,
  })
  assert.deepEqual(legacyReminderRows(raw, 'u1', today), [
    { user_id: 'u1', reminder_key: 'acc-1:statement:2026-10-01', sent_on: '2026-10-01' },
    { user_id: 'u1', reminder_key: 'acc-1:due:2026-09-28:3', sent_on: '2026-09-28' },
  ])
})

test('an unreadable old map uploads nothing', () => {
  assert.deepEqual(legacyReminderRows(null, 'u1', today), [])
  assert.deepEqual(legacyReminderRows('{', 'u1', today), [])
  assert.deepEqual(legacyReminderRows('[]', 'u1', today), [])
})

test('the old key is the per-user one the storage notice lists', () => {
  assert.equal(legacyRemindersKey('u1'), 'u1:cc-notifs-sent')
})
