# Typed Supabase reads and writes

Since LED-320, `supabase` is `createClient<Database>` with `src/types/database.ts` generated from the migrations. A wrong table, column or RPC argument fails `tsc`. `src/types/databaseContract.ts` proves it with `@ts-expect-error` lines.

**Why:** the schema narrows values with CHECK constraints the generator can't see, for example `accounts.type` is `text` in the generated types but `AccountType` in the app. Before LED-320, every read was cast, which also hid misspelled columns.

**How to apply:**
- **After a migration, run `pnpm db:types` and commit `src/types/database.ts`.** CI's `db` job diffs it against the replayed schema and fails on drift.
- Entity types in `src/types/index.ts` are `Entity<'table', Loose, Narrowed>`: the generated row, with text/JSON columns narrowed and joined or computed fields added. Don't hand-write a row interface.
- A read narrows with `.overrideTypes<Account[]>()` at the end of the chain, not `data as Account[]`. With the default merge, column names are still checked. A select with joined rows (`category:categories(id,name)`) passes `{ merge: false }`, because the joins carry only the columns that view shows.
- A write takes `Partial<Columns<'table', Entity>>`, so joined or computed fields can't be sent.
- A JSON column written from a `Record<string, unknown>` helper is cast `as Json` at the call. A plain object `type` (not an `interface`) is assignable to `Json` without a cast; see `SplitRpcLine`.
- The offline queue's `DrainClient` stays a small structural interface, because a queued item's table is a stored string. `offlineQueue.ts` is the one `as unknown as DrainClient` cast.
- Type-only imports (`import type … from './database.ts'`) keep `node --test` able to load modules that use the types.
