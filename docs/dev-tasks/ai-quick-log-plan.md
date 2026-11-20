# AI Quick Log implementation plan

Quick Log supports ordinary expenses, income, and transfers between the user's Ledger accounts. A signed-in user can enter `Jollibee 189`, `Salary 45000`, or `Transfer 1500 from BPI Savings to GCash` in **Add → Quick Log**. Ledger saves transactions with verified posting details and keeps incomplete entries as drafts. Both appear in **Needs review**. **Add → Capture Receipt** uses the same extraction, save, and review flow for receipt photos.

## 1. Quick Log in the Add dialog

- Add a **Quick Log** option to the global Add dialog. The first-use walkthrough shows examples and explains automatic saves and **Needs review**. Record acknowledgement in the existing profile preferences. The entry form contains the phrase and default currency, and explains what Ledger sends to OpenAI.
- Let the user choose expense and income defaults independently in **Settings → Quick Log** using `quickLogAccountId` and `quickLogIncomeAccountId` in the existing profile preferences. An account explicitly and unambiguously named in the phrase takes precedence over the default for that entry. Support a credit card for ordinary purchases. Use active non-liability accounts for automatic income and transfers. Save a draft when the applicable default is missing, unavailable, or incompatible. Resolve both transfer accounts from the phrase.
- Use a single submit for both a transaction and a draft. Show extraction and save progress, suppress repeated taps, and keep the phrase in the open dialog if something fails. Close or switch modes safely while extraction is pending and discard late results for that dialog. Once the write is accepted for saving, show its status through the existing queue and notifications. For transfers, show both accounts and their respective amounts.
- Save incomplete entries with the original phrase and any recognized fields. In Activity, **Finish entry** opens the existing transaction form, prefills recognized fields, and keeps the draft available until the completed transaction posts. A currency mismatch keeps the extracted amount and currency visible while the user chooses a compatible account.
- If the device is offline before extraction, keep the phrase visible and offer manual entry. If a transaction save loses connectivity after extraction, use the existing offline queue and show **Queued**. If a draft save fails, keep the phrase and recognized details available to retry in the same dialog. Show a saved notification after the database acknowledges the write.

[Global Add dialog](../../src/components/layout/AppLayout.tsx) · [Transaction form](../../src/components/transactions/TransactionForm.tsx) · [Profile preferences](../../src/lib/preferences.ts) · [Default currency in Settings](../../src/pages/SettingsPage.tsx)

## 2. Extraction function and response contract

Add an authenticated Supabase Edge Function named `quick-log-extract`. The browser calls it through the existing Supabase client. For phrase input, the request contains the trimmed phrase and the device's local calendar date. The function reads the signed-in user's default currency, number locale, and category tree through RLS. It returns a candidate transaction for Ledger to validate and save.

| Field | Contract |
| --- | --- |
| `intent` | One of `expense`, `income`, `transfer`, `repayment`, or `unclear`. Eligible expenses, income, and transfers enter the auto-save path. Repayments and unclear results save as drafts for later review. |
| `description` | A short merchant or transaction description grounded in the phrase. Use the original phrase when a grounded description is unavailable. |
| `amount` | A normalized decimal string and the source text for the amount. Also return whether it is clear, missing, or ambiguous. |
| `currency` | An explicitly stated supported currency, or an omitted or ambiguous status. Ledger supplies the user's default when the status is omitted. |
| `date` | A date candidate and an omitted or ambiguous status. Resolve supported relative dates against the supplied local day. |
| Account mentions | Nullable account spans from the phrase and request-local references to the matching accounts. An expense uses a paying account, income uses a receiving account, and a transfer uses both. Ledger checks the original wording and the signed-in user's active accounts before using a suggestion. |
| Transfer amounts and fee | The main amount means the amount sent before a separately stated fee. Return the received amount and currency and any separate fee as nullable fields with source text. Distinguish omitted values from ambiguous ones. |
| Category and subcategory | Two nullable references to entries in the supplied category tree for expenses and income. Resolve references to Ledger IDs within the function. |

- Use `gpt-6-luna` with strict Structured Outputs, `store: false`, and one model call per submission. Pass active account names, types and currencies, category and subcategory names, their parent relationships, and request-local references as data. Keep database IDs, balances, and transaction history outside the model request.
- Verify the user session, validate request size and shape, and enforce a per-user request quota before calling OpenAI. Enforce the quota atomically across Edge Function instances with a server-controlled counter keyed by authenticated user. Start with configurable limits of 500 characters per phrase, 10 requests per minute per user, and a 15-second provider deadline. The counter stores request counts and timestamps.
- Return recognized fields for partial or ambiguous extraction. Map invalid input, expired sessions, throttling, timeouts, and unavailable service to distinct errors. When the model returns no extraction, save the original phrase as a draft. Preserve the phrase on failure and offer explicit **Retry** or manual entry. Log correlation IDs, durations, and error codes. Keep phrases, category names, credentials, and raw model payloads out of logs.
- Pass the development key from the git-ignored `.env` to the local function process. Set `OPENAI_API_KEY` in the hosted function's secrets. Use the user's session for profile, category, and transaction access. Keep quota-store credentials in the function environment.

[Existing smoke test](../../scripts/openai-smoke.test.mjs) · [Supabase function auth](https://supabase.com/docs/guides/functions/auth) · [Browser invocation and CORS](https://supabase.com/docs/guides/functions/cors) · [Function secrets](https://supabase.com/docs/guides/functions/secrets) · [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

## 3. Rules for auto-save

| Field | Rule |
| --- | --- |
| Amount | Verify each extracted amount against the source text using the user's number locale. Require a clear, positive, finite principal that fits the database precision. Multiple numbers are valid when their roles are clear, such as sent, received, and fee. Amounts that cannot be verified remain unset in the draft. |
| Currency | Use `profiles.default_currency` when the phrase omits the main amount's currency. Preserve an explicit currency such as `USD`. Auto-save requires the amount's currency to match the paying account for an expense, the receiving account for income, or the source account for a transfer. An ambiguous symbol or mismatch produces a draft. |
| Date | Fill today's local date when the phrase omits it. Resolve `today` and `yesterday` against the local date for that submission. Leave ambiguous, unsupported, or future dates unset in the draft. |
| Category | For expenses and income, apply a matching user rule first, using its priority order. Otherwise use the model's suggestion. Verify that the category supports the resolved type and is available to the user. A rule that indicates a different type sends the entry to review as a draft. |
| Subcategory | Accept a suggestion only when it belongs to the final category. This also applies when a rule selects the category. Leave the field blank when the match is uncertain or the reference is invalid. Save transfers with both category fields empty. |

### Expense, income, and transfer decisions

| Kind | Requirements for auto-save |
| --- | --- |
| Expense | A clear purchase with an amount, date, compatible paying account and matching category. `Jollibee 300 cash` uses the matching Cash account. `Jollibee 189` uses the saved expense default. |
| Income | A clear external inflow with a matching category, such as `Salary 45000` or `Received 2500 freelance payment into BPI Savings`. Use the named receiving account or the saved income default. Save an incomplete entry as a draft if the phrase could describe a movement between the user's own accounts. |
| Same-currency transfer | A clear direction and two distinct, active, user-owned accounts. Ledger accepts exact names or verifies a model-suggested shorthand against a unique account. `Transfer 1500 from BPI Savings to GCash` debits BPI Savings and credits GCash with the same principal when both accounts use the resolved currency. |
| Cross-currency transfer | Require both account names and explicitly stated amounts and currencies for what was sent and received. Both currencies must match the respective accounts. For example, `Sent 100 USD from Dollar Savings to GCash, received 5600 PHP`. Save the stated sent amount and `destination_amount` through Ledger's existing transfer path. Save the known fields as a draft if either side is unclear. |
| Card payment or loan repayment | Save as a draft. The matching payment form uses the existing account and statement handling when the user finishes the entry. |

Match account spans from the phrase against the signed-in user's active accounts, giving exact names priority. A model-suggested shorthand must match a unique account by name fragment or type. When a named match is missing, ambiguous, or unavailable, or the direction is unclear, save a draft with the reason and the verified fields. Use the corresponding default when an expense or income phrase omits its account.

Build expenses and income with one account and transfers with both. Run transactions through Ledger's existing transaction schema and leave recurrence unset. If an expense or income has no matching category, keep its recognized fields in a draft. A subcategory is optional. Surface failed rule and category reads with retry or manual entry.

Enable category-rule loading explicitly for Quick Log. The existing hook defaults to disabled and supplies category and type hints. Reuse its matching order and the existing subcategory-parent validation. Recheck the selected category and subcategory if the user edits the suggested category or if a saved category was deleted while the dialog was open.

[Transaction schema](../../src/components/transactions/transactionFormSchema.ts) · [Category rules](../../src/hooks/useTransactionRules.ts) · [Subcategory reads](../../src/hooks/useSubcategories.ts) · [Database parent validation](../../supabase/migrations/20261008120000_subcategory_matches_category.sql) · [Transfer amount rules](../../src/lib/transferCredit.ts) · [Card payment handling](../../src/hooks/useCardPayment.ts)

## 4. Save, retry, and review

1. **Record the entry source in the same write.** Add `entry_source`, nullable `reviewed_at`, and the expected `destination_currency` for transfers through a migration. Use `manual` for existing rows and `ai_phrase` for phrase-assisted entries. An auto-saved AI row starts with an empty `reviewed_at`. Finishing a draft posts an AI entry already marked reviewed. The completed transaction keeps the draft ID and removes the draft in the same write. Keep the existing transaction RLS policies and regenerate database types. Carry both fields through optimistic rows, queued writes, transaction detail, and the existing undo-delete restoration path. Check account eligibility and currency again at the database write. Reuse Ledger's reference ownership checks for both transfer accounts. Save one transfer row through the existing balance trigger so the debit and credit commit together. Review-only updates can still mark an entry reviewed after an account is archived.
2. **Give each submission one transaction ID.** Generate a UUID when the candidate is accepted for saving. Reuse it for every attempt at that save. Save through the existing transaction mutation and persist a retryable write in the durable queue when connectivity is lost or the server's acknowledgement is uncertain. Keep one pending insert and apply the optimistic balance changes once for that ID, including both accounts for a transfer. Retry the validated payload without asking the model to parse it again. If the database reports an ID collision, read that ID under the user's RLS and reconcile a matching prior save. Keep edits and review state on the existing row. The queue already handles the same lost-response case.
3. **Offer Undo when a save is acknowledged.** Include the amount and account in the notification. For a transfer, include both accounts and the amounts sent and received. Undo a confirmed save through the existing transaction delete path. For a queued save, order the delete behind the insert so Undo also works after a lost acknowledgement. Use the same transaction ID in either case. Update Activity and the balance when the operation succeeds and surface a failure if Undo cannot complete.
4. **Add Needs review to Activity.** Show Quick Log drafts alongside AI transactions with an empty `reviewed_at`. Drafts leave balances and reports unchanged until completed. Use **Finish entry** or **Discard draft** to resolve them. Apply the predicate before pagination. Include review mode in the query key, offline cache key, and optimistic filtering. A link such as `?review=needed` opens the complete pending list, including older entries. Use `resolveLoadState` to distinguish loading, failed reads, and an empty review list. Add **Mark reviewed** and keep the existing edit action so users can fix a category, subcategory, date, or account. Marking reviewed updates the timestamp and removes the row from the filter. Check the query plan before adding a review index.

[Transaction writes](../../src/hooks/useTransactions.ts) · [Reference ownership checks](../../supabase/migrations/20261008110000_reference_ownership.sql) · [Transfer balance trigger](../../supabase/migrations/20261008140000_transfer_credit_rounded.sql) · [Queue reconciliation](../../src/lib/queueDrain.ts) · [Undo restore](../../src/lib/undoRestore.ts) · [Activity](../../src/pages/TransactionsPage.tsx) · [URL filters](../../src/lib/savedFilters.ts) · [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 5. Acceptance tests

| Scenario | Expected outcome |
| --- | --- |
| PHP default, PHP account, `Jollibee 189` | One ₱189.00 expense on the user's local date. The balance moves once and Activity shows **Needs review**. |
| `Jollibee 300 cash` with a matching active Cash account and dining category | One ₱300.00 expense debits Cash and records Jollibee as the description. Use the available dining category and a matching subcategory. |
| USD default, USD account, same phrase | One US$189.00 expense. The merchant name has no effect on currency. |
| PHP default, USD account, or explicit `189 USD` with a PHP account | Save a draft with the resolved amount and currency intact. Completing it requires a compatible account. |
| Locale-formatted amount, local midnight, or `yesterday` | Use the stored locale and the local date for that submission. Save ambiguous amounts or dates for later review. |
| Valid category and subcategory, conflicting rule, stale category, or mismatched parent | Accept valid predictions, honor a matching category rule, and discard a subcategory whose parent is invalid or differs from the selected category. A rule that chooses a different transaction kind saves a draft. |
| No matching category, missing amount, or two plausible amounts | Save a draft and show why the entry needs review. |
| `Salary 45000` with a PHP income account selected | Record one ₱45,000 income entry, increase the receiving account once, and accept an income-compatible category and subcategory. |
| `Transfer 1500 from BPI Savings to GCash` with both accounts in PHP | Record one transfer, debit BPI Savings once, and credit GCash once. Undo restores both balances. |
| Transfer with a separate fee, missing destination, reversed direction, or duplicate account name | A clear fee affects the source account. Missing or ambiguous endpoints save a draft. Explicit direction determines which account is debited. Posting a transfer requires distinct accounts. |
| Cross-currency transfer with both amounts, or with the received amount missing | Save both exact stated amounts when both accounts and currencies match. Save a draft when the received amount is missing. |
| `Pay 2500 from BPI Savings to BPI Visa` or a loan repayment | Save a payment draft. Verify existing statement or loan handling when the user finishes the entry. |
| Duplicate tap, concurrent retry, or lost save acknowledgement | One transaction row and one balance effect for the submission ID. A successful reconciliation preserves later edits. |
| Offline before extraction or connection lost after extraction | Manual entry is available before extraction. Once validated, the queued payload syncs once when the connection returns. Undo works before and after sync. |
| Mark reviewed, edit, or open the review link | Review status persists after reload. A reviewed row leaves the pending list, and the link can find older pending entries. |
| Expired session, quota limit, provider error, category read failure, or a second user | Errors are surfaced before any unsafe save. Unauthenticated calls reach no model. A second user cannot read or update the entry or receive its taxonomy. |

Cover deterministic parsing, category precedence, and the save decision with pure unit tests. Mock OpenAI for the function and integration tests. Add database checks for RLS, metadata defaults, and duplicate IDs. Verify the complete flow with the installed PWA on iOS and Android and exercise the existing manual Add, delete/undo, and offline paths. Use `pnpm test:openai` as an opt-in live provider check.

## 6. Build order and rollout

1. Add schema and generated types, implement the extraction function, and verify authenticated and cross-user paths against local Supabase.
2. Add the Quick Log form and verify the expense path from the mobile Add dialog to Activity. Extend the same path to income and transfers. Verify both transfer balance changes and Undo with test Ledger accounts in the development environment.
3. Add the review filter, URL, and review action. Verify empty, loading, failed, offline, and older-entry cases.
4. Run lint, build, the app test suite, and database tests. Confirm migration replay and generated-type consistency. Deploy schema and function to development before exercising the PWA against them. Use a production Supabase function secret for the live project and enable the feature only after the development acceptance run.

## 7. Follow-on milestones

- **Receipt capture.** **Take photo** and **Choose photo** send a validated image to OpenAI after a processing disclosure. Ledger extracts the transaction type, final total, currency, merchant, date, category, and payment method when visible. The selected account takes priority, followed by a clear receipt match and then the saved default for the transaction type. The original photo stays attached in private receipt storage. Unclear, cross-currency, transfer, and debt-payment receipts go to **Needs review** as drafts. Follow-up testing covers blur, glare, discounts, matching duplicate uploads, and camera and picker behavior on physical iOS and Android devices. [Receipt attachment flow](../../src/hooks/useReceiptAttachment.ts) · [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision#giving-a-model-images-as-input)
- **Daily review reminder.** Add an opt-in reminder time and time zone. Use Supabase Cron and Web Push for users with pending transaction reviews or Quick Log drafts. Deduplicate by user and local date. The notification opens the Activity review link and displays generic copy. Verify closed-app delivery, permission denial, and expired subscriptions. On iOS and iPadOS, use the installed Home Screen app and request permission from an explicit user action. [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions) · [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
