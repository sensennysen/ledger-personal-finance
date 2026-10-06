import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// A disabled control is solid ink on a solid surface (--disabled tokens), never opacity (LED-119, LED-120).
const root = fileURLToPath(new URL('../src/', import.meta.url))

// Any class token with a disabled variant (disabled:, has-disabled:, aria-disabled:, data-disabled:,
// peer-disabled:, group-data-[disabled=true]/name:, dark:disabled:) that ends in an opacity utility.
const DISABLED_OPACITY = /[^\s"'`]*disabled[^\s"'`]*:opacity-[^\s"'`]*/g

// [file, line pattern, reason] for opacity that is genuinely not a disabled state.
const ALLOWED = []

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
  )
}

function hits(lines, path) {
  const found = []
  lines.forEach((line, i) => {
    for (const m of line.matchAll(DISABLED_OPACITY)) {
      if (!ALLOWED.some(([f, re]) => f === path && re.test(line))) found.push(`${path}:${i + 1} ${m[0]}`)
    }
  })
  return found
}

test('the guard recognises every disabled opacity spelling', () => {
  for (const cls of [
    'disabled:opacity-50',
    'has-disabled:opacity-50',
    'aria-disabled:opacity-60',
    'data-disabled:opacity-50',
    'peer-disabled:opacity-50',
    'group-data-[disabled=true]:opacity-50',
    'group-data-[disabled=true]/input-group:opacity-50',
    'dark:disabled:opacity-50',
  ]) {
    assert.equal(hits([`className="x ${cls} y"`], 'x.tsx').length, 1, cls)
  }
  assert.deepEqual(hits(['className="opacity-60 hover:opacity-100 disabled:bg-disabled"'], 'x.tsx'), [])
})

test('disabled and off states do not use opacity', () => {
  const found = []
  for (const file of files(root)) found.push(...hits(readFileSync(file, 'utf8').split('\n'), relative(root, file)))
  assert.deepEqual(found, [])
})

test('every allow-list entry still matches a line', () => {
  for (const [file, re, reason] of ALLOWED) {
    assert.ok(reason, `${file} needs a reason`)
    const text = readFileSync(join(root, file), 'utf8')
    assert.ok(text.split('\n').some((line) => re.test(line) && DISABLED_OPACITY.test(line)), `${file} entry is stale`)
    DISABLED_OPACITY.lastIndex = 0
  }
})
