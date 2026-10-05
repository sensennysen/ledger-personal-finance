import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readingMinutes, wordCount } from '../src/lib/readingTime.ts'

const words = (n) => Array.from({ length: n }, () => 'word').join(' ')

test('words are counted across spaces and line breaks', () => {
  assert.equal(wordCount('  Type DELETE\nto   confirm  '), 4)
  assert.equal(wordCount(''), 0)
})

test('minutes round up at 200 words a minute, at least one', () => {
  assert.equal(readingMinutes(''), 1)
  assert.equal(readingMinutes(words(200)), 1)
  assert.equal(readingMinutes(words(201)), 2)
  assert.equal(readingMinutes(words(400)), 2)
})
