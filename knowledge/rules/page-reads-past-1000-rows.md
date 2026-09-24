# Page any read that can pass 1,000 rows
PostgREST returns at most `max_rows` (1,000, `supabase/config.toml`) per request and doesn't error, so a larger read truncates silently.
**Why:** a truncated read looks complete. For the import duplicate check (LED-73) that means duplicates past row 1,000 import unflagged.
**How:** wrap the query in `readAllPages` (`src/lib/pagedRead.ts`), with a total order (`date`, then `id`) and `.range(from, to)`; it loops until a page comes back short. Used by `useBudgets` and `useSavingsGoals`; `useOverspending` and `useImportDuplicates` inline the same loop.
