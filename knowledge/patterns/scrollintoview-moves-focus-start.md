# `scrollIntoView` moves where Tab starts, even with `block: 'nearest'`
An effect that runs on mount/route change and calls `Element.scrollIntoView()` to keep something visible can move Chrome's sequential-focus starting point to that element — a fresh page load then Tabs from there instead of from the top of the document (LED-155). This happens regardless of `block`/`inline` options; it's the scroll itself, not the alignment, that Chrome tracks.
**Why:** `TopBar.tsx`'s mobile tab strip called `scrollIntoView` on the active tab on every mount. With `Element.prototype.scrollIntoView` stubbed out, the Tab order was correct (skip link → header controls); with it enabled, the first Tab press landed inside the tab strip instead.
**How:**
- Don't use `scrollIntoView` in an effect that runs on initial mount. Compute the target's offset against the scroll container and set `scrollLeft`/`scrollTop` directly — this keeps content visible without touching focus-sequence state.
- If `scrollIntoView` is the only practical option (e.g. nested scroll containers), gate it so it never runs on the very first render — only on a later, user-caused change.
