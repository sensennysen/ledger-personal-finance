import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStoredTheme, resolveTheme, DEFAULT_THEME_PREFERENCE } from '../src/lib/themePreference.ts'

test('a stored light, dark or system is kept', () => {
  for (const value of ['light', 'dark', 'system']) assert.equal(parseStoredTheme(value), value)
})

test('anything else falls back to dark', () => {
  assert.equal(DEFAULT_THEME_PREFERENCE, 'dark')
  for (const value of [null, undefined, '', 'auto', 'Dark']) assert.equal(parseStoredTheme(value), 'dark')
})

test('light and dark ignore the OS', () => {
  assert.equal(resolveTheme('light', true), 'light')
  assert.equal(resolveTheme('dark', false), 'dark')
})

test('system follows the OS, and follows it when it changes', () => {
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('system', false), 'light')
})
