# LED-233 · Category names are unique within their parent — retro (2026-10-04)

Branch `epics-15-19`. Epic 21, phase B. Decision OD-13 item 1: unique among a user's categories and among one category's subcategories; case-insensitive, surrounding spaces ignored; existing duplicates kept.

## What was built
- **Migration `20261004100000_category_name_unique_within_parent.sql`.** Two `before insert or update of name` triggers (subcategories also on `category_id`), SECURITY INVOKER, comparing `lower(btrim(name))`. No unique index, so existing duplicates stay.
  - A rename that only changes case or spacing is not re-checked, so an existing duplicate can be tidied.
  - `pg_advisory_xact_lock` per user (categories) or per parent (subcategories) stops two racing inserts both passing.
  - Raises errcode `23505` with a sentence naming the clash and hint `user-message`.
- **`dataErrors.ts`.** `describeDataError` shows the server's message as is when the hint is `user-message`. Generic; the merge rpc (LED-239) uses it too.
- **`src/lib/categoryNames.ts`.** `normaliseCategoryName`, `findNameClash` and `clashSentence`: the same check against the loaded list, so the form answers before a round trip. The category schema's name is now trimmed.
- **Tests.** `categoryNames.test.mjs` (6) and one more in `dataErrors.test.mjs`.

## Acceptance
- **(a) Create or rename onto a name under the same parent is refused, naming the clash, in the form: PASS.** Browser, demo user: "  shopping " in Add Category shows `A category named "shopping" already exists.` A direct REST insert of "SHOPPING" returns 409 `{code: 23505, hint: user-message, message: 'A category named "SHOPPING" already exists.'}`, which the hint branch shows as is.
- **(b) The same subcategory name under two categories saves: PASS** (psql).
- **(c) Existing duplicates load and can be renamed: PASS** (psql: two seeded "Dup"/"dup " rows load; a case tidy, a colour change and a rename away all save).
- **(d) Enforced in the database: PASS, reworded.** Category writes are never queued offline (they are refused offline; only transactions and profiles are queued), so there is no queued insert to drain. The trigger is the guard for every write that reaches the database. Noted in the CSV row.
- **(e) Applies to an empty database:** applied with `supabase migration up --local`; the from-scratch replay runs at validation.
- **(f) Tests: PASS.**
- psql under RLS also refused moving a subcategory onto a parent that has its name, and let a second user use the same name. `supabase db lint` clean; `pnpm lint` and `tsc -b` clean.

## Found in passing
- The local database was three migrations behind (`20261003100000` to `20261003120000`). `migration up` applied them first.

## Backlog
- None.
