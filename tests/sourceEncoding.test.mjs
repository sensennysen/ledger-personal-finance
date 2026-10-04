import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// UTF-8 text decoded as Windows-1252 and saved again (LED-247): "—" became "â€”", "…" became "â€¦".
// â€ starts every mangled curly quote, dash and ellipsis; Ã and Â followed by a high Latin-1 byte
// are the mangled accented letters and non-breaking space.
const MOJIBAKE = /â€|Ã[\u0080-¿]|Â[ -¿]/

const src = fileURLToPath(new URL('../src/', import.meta.url))

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    // graphify-out is generated and git-ignored, but can sit on disk under src/.
    if (entry.isDirectory()) return entry.name === 'graphify-out' ? [] : sourceFiles(path)
    return /\.(tsx?|css|html)$/.test(entry.name) ? [path] : []
  })
}

test('no source file under src/ carries mojibake', () => {
  const hits = []
  for (const file of sourceFiles(src)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (MOJIBAKE.test(line)) hits.push(`${file.slice(src.length)}:${i + 1}: ${line.trim()}`)
    })
  }
  assert.deepEqual(hits, [])
})
