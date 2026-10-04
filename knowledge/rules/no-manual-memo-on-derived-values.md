# Don't hand-memoize over values derived during render
The React Compiler is on, and `react-hooks/preserve-manual-memoization` fails lint ("Existing memoization could not be preserved") when a `useMemo` depends on a value computed in the render body, such as `accounts.find(...)`, a helper's return value, or anything downstream of one.
**Why:** the compiler can't prove that such a value isn't mutated later, so it skips optimizing the whole component. It hit LED-71 and LED-75, where three memos in `ImportCSVDialog` went red once they depended on the currency rate.
**How:** compute the value inline and let the compiler memoize it. Keep `useMemo` only where every dependency is state, props or another memo, like `buildRows` over `[file, dateOrder]`. Don't reach for `eslint-disable`.
