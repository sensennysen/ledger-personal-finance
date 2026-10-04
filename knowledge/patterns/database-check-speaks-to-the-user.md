# A database check that the user can hit writes its own sentence
When a trigger or rpc refuses a write for a reason the user caused (a name clash, the wrong category type, "not found"), raise a sentence a person can read and mark it with `hint = 'user-message'`. `describeDataError` then shows that message as is, and keeps the raw text as the detail.

**Why:** `toResult` turns an unclassified error into "Couldn't save this category. Try again.", and a bare `23505` into "A category with that name already exists." Neither can say *which* name clashes or *why* a merge was refused (LED-233, LED-239). PostgREST passes `hint` through as JSON (`{code, details, hint, message}`), so the database can speak for itself.

**How:**
- `raise exception 'A category named "%" already exists.', btrim(new.name) using errcode = '23505', hint = 'user-message';`. Keep the errcode meaningful (`23505` for a clash), so a caller that ignores the hint still classifies it.
- Mirror the check in `src/lib` when the form can answer before a round trip (`categoryNames.ts`). Use the same sentence, so the user sees one wording whichever side catches it.
- Only for sentences meant for users. Internal invariants keep plain messages and get the generic copy.

**Two traps found doing it:**
- **A per-row uniqueness trigger sees earlier rows of the same statement.** `update subcategories set category_id = target where category_id = source` fails part-way if the source holds two rows with the same name, which happens when old duplicates were kept on purpose. Loop over the rows in order and fold each clash into the first (LED-239).
- **Skip the check when the normalised value is unchanged.** Otherwise a colour change, or a case fix of an existing duplicate, is refused.
