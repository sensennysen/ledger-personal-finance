import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveReportTab } from '../src/lib/reportTabs.ts'

test('live tabs are kept', () => {
  assert.equal(resolveReportTab('overview'), 'overview')
  assert.equal(resolveReportTab('analytics'), 'analytics')
})

test('a preset saved with the removed 13th Month tab falls back to overview', () => {
  assert.equal(resolveReportTab('thirteenth'), 'overview')
})

test('missing or unknown values fall back to overview', () => {
  assert.equal(resolveReportTab(undefined), 'overview')
  assert.equal(resolveReportTab(null), 'overview')
  assert.equal(resolveReportTab(''), 'overview')
  assert.equal(resolveReportTab('nope'), 'overview')
})
