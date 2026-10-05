import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// A screen reader announces a tab list by its name ("Category type, tab list"); without one it is
// just "tab list" (LED-179). Every <TabsList> outside the primitive carries an aria-label.
function tsxFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'graphify-out' || name === 'ui') return []
    return statSync(path).isDirectory() ? tsxFiles(path) : path.endsWith('.tsx') ? [path] : []
  })
}

test('every tab list has an accessible name', () => {
  const unnamed = []
  for (const file of tsxFiles('src')) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/<TabsList\b[^>]*>/g)) {
      if (!/aria-label(ledby)?=/.test(m[0])) unnamed.push(`${file}: ${m[0]}`)
    }
  }
  assert.deepEqual(unnamed, [])
})
