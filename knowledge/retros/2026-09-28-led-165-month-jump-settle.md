# LED-165 · Oldest-month jump lands short — retro (2026-09-28)

## What shipped
- `AccountTransactionsPage.tsx`'s scroll-settle effect no longer clears `scrollTargetRef.current` on the first render where the target day exists. It now re-scrolls on every further `rendered` change and only gives up once none arrives for `SETTLE_DEBOUNCE_MS` (500 ms) — a debounce timer reset on each re-run, not a frame-count comparison.
- **The first implementation (an `isWindowSettled(previous, current)` frame-polling loop via `requestAnimationFrame`, comparing two consecutive rAF samples) was live-tested and found not to fix the bug** — see below. It was replaced before this ticket's commit; nothing from it shipped.

## What the live check found
Headless Chrome, seeded 2,000-row account (2024-01-01 to 2026-09-27), 1920×1080, production build. Jumping to the oldest month (Jan 2024, whose target day needs a window grow after `ensure()` lands):
- **rAF-polling version**: landed 632 px short of the result bar (`nodeTop - barBottom`), effectively unchanged from the reported bug. Instrumenting the effect showed why: the settle loop's two-consecutive-frame check (~16 ms apart) declared "settled" *before* the window's own `IntersectionObserver`-triggered growth had fired — that observer's callback, at ~1,940 mounted rows, takes longer than one or two animation frames to run. The loop gave up and cleared the scroll target before the real growth (and the resulting ~6,000 px `scrollHeight` change the original ticket described) ever happened.
- **Debounce version** (shipped): same scenario, 0 px gap. A jump to a month already inside the initial window (Aug 2026) was 0 px either way, confirming (b) is unaffected.

**Lesson for `knowledge/patterns/`:** don't infer "no more async work is coming" from a fixed, small number of animation frames when the async trigger is a browser callback (`IntersectionObserver`, `ResizeObserver`) whose timing scales with how much is already mounted — a wall-clock debounce that resets on every real signal is the robust version of "wait for it to settle." Worth a pattern entry if another ticket hits the same shape.

## Acceptance
- (a) oldest-month jump leaves the target's day header within 60 px of the result bar on a 2,000-row account: **PASS, live** — 0 px, per above.
- (b) jumps to other months unchanged: **PASS, live** — Aug 2026 jump, 0 px gap, footer confirms no unwanted extra growth.
- (c) unit test on the settle logic where possible: **not shipped.** The rAF/frame-comparison version had one (`isWindowSettled`, three cases in `tests/monthJump.test.mjs`); it was removed along with that version, since the debounce timer that replaced it has no pure decision left to test in isolation (it's "schedule a timeout, cancel on the next render" — an effect, not a function of two numbers). Recorded here rather than forcing an artificial unit test.

## Backlog
- None outstanding for this ticket — both acceptance criteria with a live signal passed after the fix.
