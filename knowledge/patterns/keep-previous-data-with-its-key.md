# Keep previous data on screen, tagged with its key

When a keyed read (cycle, month, filter) changes to a key with no cache, keep the old data on screen instead of clearing it (LED-95). But:

- **Tag it.** Store the key the data was read for (`dataKey`) and derive `refreshing` with `resolveRefresh` (`src/lib/loadState.ts`). Never write the old data under the new cache key.
- **Say so on screen.** Wrap it in `RefreshingRegion`: dimmed, a progress rule, and a label naming the key that is loading.
- **Fail to the new key.** If the new key's read fails (or you're offline with no cache), clear the old data, so `resolveLoadState` shows `error` instead of passing the old data off as the new.
- **Audit every consumer of the hook.** Keeping data changes what every caller sees mid-load. Home's budget card and spending alerts silently showed last cycle's figures until they learned about `refreshing`. Grep the hook's callers and give each one either a `RefreshingRegion` or an explicit "ignore while refreshing".
