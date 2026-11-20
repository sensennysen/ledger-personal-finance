# AI receipt capture

**Add → Capture Receipt** accepts a camera photo or image upload and an optional account. GPT-6 Luna reads the final amount, transaction type, merchant, date, category, and payment method when visible. Ledger uses the selected account, a clear match to an active account, or the saved default for an expense or income. Posted entries stay in **Needs review** until reviewed. Receipts with unresolved posting details, transfers, and debt payments stay as drafts and leave balances alone. Posted entries and drafts carry the photo in private receipt storage.

## Verification

- Verified the upload and save flow in a 390-pixel browser viewport against the local Supabase stack and the live OpenAI model. Ledger saved the synthetic Harbor Cafe receipt as a ₱249.50 expense and identified cash as the payment method. The selected Everyday Wallet took priority. Selecting a USD account produced a draft with a currency mismatch reason and left the account balance unchanged. Both photos were retrievable from private storage.
- Verified the default expense account fallback against a live extraction with no matching active account. The app tests also cover a unique cash account, a named wallet provider, the default income account, and unresolved posting details.
- Passed lint, the production build, all 1,254 app tests, and the redesign checks.
- Passed database lint, 93 pgTAP assertions, and the existing concurrency checks. Replayed all migrations and seed in an isolated local Supabase project. Generated types matched the repository using CI’s pinned CLI.

## Backlog

- Verify camera capture and image selection in installed PWAs on physical iOS and Android devices. Broader testing includes long receipts, glare, and HEIC decoded by the browser.
- Detect receipts uploaded more than once. Retrying a single in-progress save already reuses its transaction and attachment identifiers.
- Apply the migration and redeploy `quick-log-extract` to hosted Supabase alongside the frontend release.
