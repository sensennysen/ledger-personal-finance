# A sticky `bottom` is measured inside the scroller's padding
`position: sticky; bottom: N` inside a scroller with `padding-bottom: P` sticks N above the padding edge, that is `N + P` above the scroller's bottom (Chrome, measured in LED-149). A comment in `MonthJump.tsx` claimed the opposite, so the bar carried `bottom: 88px` on top of `main`'s own `pb-[88px]` and floated 88px above the bottom nav.
**Why:** it also hid a real collision. The bar sat at 612-668 at 390x844 while the FAB (676-740) did not touch it, so the overlap the retro reported only showed once the bar was on the nav (700-756).
**How:**
- When the scroller already pads for a fixed bar (`AppLayout`'s `main`), a sticky footer inside it is `bottom-0`.
- Verify by measuring `getBoundingClientRect()` at scroll top and scroll bottom, before and after; do not trust a comment.
- A floating control that must clear the bar (the add FAB) reads the bar through a data attribute and `:has()` (`[body:has([data-month-jump-bar])_&]:bottom-…`), so it needs no shared state.
