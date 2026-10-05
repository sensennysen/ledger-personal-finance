import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visualViewportVars } from '../src/lib/visualViewport.ts'

const sample = (over) => ({ height: 844, offsetTop: 0, scale: 1, layoutHeight: 844, ...over })

test('no keyboard: no variables, so CSS keeps its dvh fallbacks', () => {
  assert.equal(visualViewportVars(sample()), null)
})

test('sub-pixel rounding is not a keyboard', () => {
  assert.equal(visualViewportVars(sample({ height: 843.5 })), null)
})

test('keyboard open: height, centre and bottom follow the visible area', () => {
  assert.deepEqual(visualViewportVars(sample({ height: 500 })), {
    '--vv-height': '500px',
    '--vv-center': '250px',
    '--vv-bottom': '344px',
  })
})

test('iOS scrolls the visual viewport down: the centre moves with it', () => {
  assert.deepEqual(visualViewportVars(sample({ height: 500, offsetTop: 120 })), {
    '--vv-height': '500px',
    '--vv-center': '370px',
    '--vv-bottom': '224px',
  })
})

test('pinch zoom is not a keyboard', () => {
  assert.equal(visualViewportVars(sample({ height: 400, scale: 2 })), null)
})

test('bottom never goes negative', () => {
  assert.equal(visualViewportVars(sample({ height: 500, offsetTop: 400 }))['--vv-bottom'], '0px')
})
