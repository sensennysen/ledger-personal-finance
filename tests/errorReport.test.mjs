import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildErrorEvent,
  createReportGate,
  scrubMessage,
  scrubRoute,
  scrubStack,
  shouldReport,
  MAX_REPORTS_PER_LOAD,
} from '../src/lib/errorReport.ts'

const context = { pathname: '/accounts/6f1c1d6e-3b8a-4c1f-9d2e-0a1b2c3d4e5f', release: 'abc123def456', userAgent: 'Mozilla/5.0 Test' }

test('messages lose amounts, quoted text, key values, e-mails and ids', () => {
  assert.equal(
    scrubMessage('The split lines add up to 1,250.50 but the transaction is 1200'),
    'The split lines add up to # but the transaction is #',
  )
  assert.equal(scrubMessage('Couldn\'t save "Lunch at Jollibee"'), 'Couldn\'t save "…"')
  assert.equal(
    scrubMessage('duplicate key value violates unique constraint: Key (user_id, name)=(6f1c1d6e-3b8a-4c1f-9d2e-0a1b2c3d4e5f, rent) already exists.'),
    'duplicate key value violates unique constraint: Key (user_id, name)=(…) already exists.',
  )
  assert.equal(scrubMessage('No user me@example.com for 6f1c1d6e-3b8a-4c1f-9d2e-0a1b2c3d4e5f'), 'No user <email> for <id>')
  assert.equal(scrubMessage(''), 'Unknown error')
  assert.equal(scrubMessage('x'.repeat(900)).length, 500)
})

test('routes keep their shape without ids', () => {
  assert.equal(scrubRoute('/accounts/6f1c1d6e-3b8a-4c1f-9d2e-0a1b2c3d4e5f'), '/accounts/<id>')
  assert.equal(scrubRoute('/loans/42/edit'), '/loans/<n>/edit')
  assert.equal(scrubRoute(''), '/')
})

test('stacks keep code locations and lose queries and quoted text', () => {
  const stack = 'TypeError: x\n    at render (http://localhost:5173/src/App.tsx?t=1700:10:5)\n    at f ("Lunch")'
  assert.equal(scrubStack(stack), '    at render (http://localhost:5173/src/App.tsx:10:5)\n    at f ("…")')
  assert.equal(scrubStack('Error: amount 500 of Rent\nsecond line 12'), null, 'no frames: nothing but the message, which is sent scrubbed')
  assert.equal(scrubStack('render@http://x/app.js:1:2'), 'render@http://x/app.js:1:2')
  assert.equal(scrubStack(undefined), null)
})

test('an event carries kind, scrubbed message and route, release and browser, and nothing financial', () => {
  const event = buildErrorEvent('boundary', new TypeError('Cannot read amount 999.99 of "Groceries"'), context, '\n    at Widget')
  assert.deepEqual(Object.keys(event).sort(), ['kind', 'message', 'release', 'route', 'stack', 'user_agent'])
  assert.equal(event.kind, 'boundary')
  assert.equal(event.message, 'TypeError: Cannot read amount # of "…"')
  assert.equal(event.route, '/accounts/<id>')
  assert.equal(event.release, 'abc123def456')
  assert.equal(event.user_agent, 'Mozilla/5.0 Test')
  assert.match(event.stack, /Component stack:\n {4}at Widget/)
  assert.doesNotMatch(JSON.stringify(event), /999|Groceries/)
})

test('non-Error rejections are described without guessing', () => {
  assert.equal(buildErrorEvent('rejection', 'boom 12', context).message, 'boom #')
  assert.equal(buildErrorEvent('rejection', { message: 'PostgREST failed' }, context).message, 'PostgREST failed')
  assert.equal(buildErrorEvent('rejection', 42, context).message, 'Non-error value thrown')
  assert.equal(buildErrorEvent('error', undefined, { ...context, release: '' }).release, 'unknown')
})

test('local development does not report', () => {
  assert.equal(shouldReport({ prod: false, hostname: 'ledger-personal.vercel.app' }), false)
  for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'app.localhost', 'ledger.test']) {
    assert.equal(shouldReport({ prod: true, hostname }), false, hostname)
  }
  assert.equal(shouldReport({ prod: true, hostname: 'ledger-personal.vercel.app' }), true)
})

test('a page load reports each failure once, and at most the cap', () => {
  const gate = createReportGate()
  const event = buildErrorEvent('error', new Error('a'), context)
  assert.equal(gate(event), true)
  assert.equal(gate(event), false)
  let sent = 1
  for (let i = 0; i < 20; i++) if (gate({ ...event, message: `m${'x'.repeat(i)}` })) sent++
  assert.equal(sent, MAX_REPORTS_PER_LOAD)
})
