import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accentTokens, readableOn, MIN_ACCENT_CONTRAST } from '../src/lib/accentTheme.ts'
import { contrastRatio } from '../src/lib/contrast.ts'
import { SWATCHES, DEFAULT_ACCENT } from '../src/lib/swatches.ts'

// Saturated hues at both ends of the range, greys and extremes: where M3's on-primary is weakest.
const HUES = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#808080', '#767676', '#000000', '#ffffff', '#ffb300']
// Inks a generator might hand back: the wrong way round, mid grey, and the surface itself.
const BAD_INKS = ['#808080', '#777777', '#ffb300']

for (const bg of [...HUES, DEFAULT_ACCENT, ...SWATCHES]) {
  test(`text on ${bg} holds 4.5:1 whatever ink was preferred`, () => {
    for (const ink of [...BAD_INKS, bg, '#000000', '#ffffff']) {
      assert.ok(contrastRatio(readableOn(ink, bg), bg) >= MIN_ACCENT_CONTRAST, `${ink} on ${bg}`)
    }
  })
}

test('a preferred ink that already reads is kept, not replaced by black or white', () => {
  assert.equal(readableOn('#1b2247', '#a8b4de'), '#1b2247')
})

test('accentTokens repairs on-primary and on-container and leaves the tones alone', () => {
  const t = accentTokens({ primary: '#ffff00', onPrimary: '#ffffff', container: '#333300', onContainer: '#444400' })
  assert.equal(t.primary, '#ffff00')
  assert.equal(t.container, '#333300')
  assert.ok(contrastRatio(t.onPrimary, t.primary) >= MIN_ACCENT_CONTRAST)
  assert.ok(contrastRatio(t.onContainer, t.container) >= MIN_ACCENT_CONTRAST)
})
