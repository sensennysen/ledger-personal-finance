# Mirror a SQL function in TypeScript with fixtures read from the database
When the UI must show what a trigger or function will do, port it into a pure `src/lib` file and pin it with values the real function produced.
**Why:** the ticket described the split as "oldest-installment-first"; the SQL is proportional (LED-107). The description would have shipped a preview that disagreed with the saved rows. `node --test` cannot run SQL, so the only reliable spec is the function's own output.
**How:**
- Run the scenarios in one transaction with `begin; … rollback;` on the local database (insert into `auth.users` and the tables the trigger reads) and print the rows.
- Copy those figures into the test as literals. Cover the edges: exact match, spill-over, before a due date, cent rounding, a second payment.
- Give the port the same inputs the function reads (here: the transaction date). Put the SQL file name in the header comment.
- Confirm once in the browser: save a real row and compare it with what the form previewed.
