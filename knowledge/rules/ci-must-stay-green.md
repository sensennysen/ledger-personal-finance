# CI must stay green
`npm run lint`, `npm run build` and `npm test` must pass before merge; CI runs them on every PR.
**Why:** they are cheap and catch type, lint and logic regressions before they reach Vercel.
**How:** run all three locally before `/validate`. Report failures; never skip or weaken a check to get green. New tests must be picked up by `tests/*.test.mjs`.
