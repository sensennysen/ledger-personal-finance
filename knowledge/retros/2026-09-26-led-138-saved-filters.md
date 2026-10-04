# LED-138 — Saved filters — retro (2026-09-26)

- OD-4 (a). `saved_filters` (migration `20260926110000`): RLS with `using` and `with check`, a unique index on `(user_id, lower(btrim(name)))`, a name length check and a "filter is an object" check. Checked in `psql` as two users: own rows visible, another user sees none and cannot insert, update or delete, a duplicate name in another case is refused, a blank name is refused.
- The stored filter is `{ v: 1, type, search, tag }`. `parseFilter` returns null for anything else, so a row from a newer version is skipped and counted (`skipped`), and the dialog says how many were hidden instead of crashing or hiding them silently. The cycle is not saved: a filter applies to the cycle on screen.
- The palette opens Activity with `?q=&type=&tag=`, the filter itself, not an id. It works before the saved list has loaded and needs no second read. Activity's handoff now replaces all three filters (before, `?q=` alone reset the other two), which is the same behaviour for the existing "See all".
- `useSavedFilters` reads with `readAllPages`, maps errors through `describeDataError`, and each caller owns its copy (the palette's opens with it, Activity's is mounted). A failed read is shown in the dialog and the palette, never as "No saved filters".
- The palette gets a "Saved filters" chip and group between Categories and Actions (29a), and lists them all before anything is typed.
- Live at 1280 and 390 (test user, removed): saved, duplicate name refused, renamed, applied from the palette (type, tag and empty search all set, params removed), deleted; read blocked shows "Couldn't reach the server" with a Retry; a 409 answered by `Fetch.fulfillRequest` shows "A saved filter with that name already exists."; the dark theme was captured.
- React Compiler rejected `currentFilter` as a plain object next to a `useCallback` that closes over other setters (`preserve-manual-memoization`). Wrapping it in `useMemo` fixed it; the message named the wrong variable.

## Backlog
- Deleting a saved filter asks nothing and offers no Undo (it is cheap to remake).
- Export my data and the deletion page's list do not mention saved filters (LED-180).
- No screen reader pass on the dialog or the new palette group.
- Apply from the Activity dialog on a phone was not exercised (the palette path was).
