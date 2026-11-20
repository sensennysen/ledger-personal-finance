# Phrase-based AI Quick Log

Implemented expense, income, same-currency transfer, and explicit cross-currency transfer logging. Ledger uses the profile's default currency for an omitted currency, validates the model's amount and account evidence, and applies the user's category rules before model suggestions. Unclear entries and liability payments use the existing confirmation form.

The extraction function checks the Supabase session and its per-user quota before calling GPT-6 Luna with `store: false`. A single transaction ID covers retries and queue recovery. For a queued transaction, Undo is ordered behind its insert so it can reverse the write even if the original acknowledgement was lost. Activity filters pending entries across all dates and supports marking them reviewed.

## Verification

- Passed lint, type-check, production build, 1,242 Node tests, and the redesign checks. Normalized the existing color test's path separators so its allowlist works on Windows.
- Passed database lint, 72 pgTAP checks, and the existing two-session concurrency checks. Replayed all migrations and the seed in an isolated local project and compared generated types byte-for-byte using CI's Supabase CLI version.
- Verified live expense, income, PHP transfer, and USD-to-PHP transfer extraction and writes with disposable local users. Repeated writes retained one row per ID, Undo restored both transfer balances, and the model selected **Food & Dining → Fast Food** when the synthetic subcategory was available.
- Verified the browser flow at a 390-pixel viewport. The expense appeared under **Needs review**, **Mark reviewed** cleared it, and a USD/PHP mismatch opened the prefilled form with the original amount and USD currency.
- Verified both first-use actions in a 390-pixel browser viewport. **Continue** opened the phrase form, and **Set default accounts** opened the focused Quick Log Settings section. The saved account defaults carried over, an edited default survived a reload, and both accounts skipped the walkthrough on subsequent opens. The follow-up passed lint, production build, 1,243 Node tests, and the redesign checks.

## Deferred review follow-up

Quick Log now saves the original phrase and recognized fields as a draft whenever it cannot post a complete transaction. **Activity → Needs review** shows drafts alongside posted AI entries awaiting review. Finishing a draft posts a reviewed transaction and removes the draft in one database write.

- Verified the live extraction flow at 390 pixels with a disposable local user. An expense with no default account saved for review and survived reload. Choosing an account later posted it. A complete income posted immediately and stayed in review, and discarding a second draft left the posted entries and balances intact.
- The expanded suite passed lint, the production build, 1,244 Node tests, the redesign checks, 85 pgTAP assertions, database lint, and the existing concurrency checks. The new database tests cover isolation, failed completion, late retry, and balance changes.
- Replayed the migrations and seed from an empty Supabase database. Generated types matched the output from the CI version of the CLI.
- Verified the Vite development override on port 5173. Both Supabase endpoints accepted preflight, but the running app had been using the hosted endpoint. With `.env.development.local` pointing to the local stack, a signed-in browser submission saved the extracted phrase and amount in local Supabase.
- Reproduced the production CORS failure using the full browser preflight. The hosted response omitted Ledger's `X-Client-ID` from its allowed headers. The local gateway echoed the requested headers, which hid the omission during browser testing. The function source now explicitly allows `X-Client-ID`.

## Account-aware matching

Quick Log sends active account names, types, and currencies together with the category tree when the submitting form discloses that data. It uses request-local references and verifies every named match against the original phrase and active accounts. An omitted expense or income account uses the corresponding saved default. An unmatched account, a missing category, or another unresolved detail saves a draft with a specific reason.

Verified against the local Edge Function and live model with a disposable user. The named Cash expense and both default-account cases posted to the expected balances. Both Jollibee entries selected Food & Dining and Fast Food. An unlisted account kept the amount in a draft and left balances alone. A legacy request omitted the account catalog.

Moved **Needs review** to the top of mobile Activity and gave pending transaction rows a separate status badge. Verified the 48-pixel control and both filter states at 390 pixels, plus the compact control at desktop width.

Updated the Quick Log field label, example placeholder, and disclosure with the requested wording. The extraction payload still includes account types and currencies.

Updated the disclosure and legal pages to describe account metadata, OpenAI processing and retention, posted transactions, drafts, browser caching, and account deletion. The deletion page distinguishes posted transaction CSV exports from unfinished drafts.

## Backlog

- Verify on installed iOS and Android PWAs, including a real offline-to-online handoff.
- Apply the Quick Log migrations and deploy the extraction function to hosted Supabase when deploying the frontend. The OpenAI key is configured as a hosted Edge Function secret.
- Deploy the CORS fix to the hosted extraction function and repeat the production-origin preflight with all browser headers.
- Implement receipt capture and daily review reminders in their follow-on milestones.
