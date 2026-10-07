import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isChunkLoadError } from '../src/lib/chunkLoad.ts'

// LED-317: a page chunk that could not be fetched gets its own message, not "section didn't load".

test('recognises each browser\'s failed chunk import', () => {
  assert.equal(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/ReportsPage-abc.js')), true) // Chrome
  assert.equal(isChunkLoadError(new TypeError('Importing a module script failed.')), true) // Safari
  assert.equal(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js')), true) // Firefox
  assert.equal(isChunkLoadError(new Error('Unable to preload CSS for /assets/ReportsPage-abc.css')), true) // Vite preload
})

test('leaves every other error alone', () => {
  assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'id')")), false)
  assert.equal(isChunkLoadError(new Error('Failed to fetch')), false)
  assert.equal(isChunkLoadError('Failed to fetch dynamically imported module'), false)
  assert.equal(isChunkLoadError(null), false)
})
