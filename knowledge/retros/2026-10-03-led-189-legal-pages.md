# LED-189 · Legal pages: Privacy, Terms, data deletion, cookies and storage, notices — retro (2026-10-03)

Branch `epics-15-19`. Decision OD-9, widened by the owner: draft every page, and the owner approves each before it is committed (rule OD-5).

**Your answers before drafting:**
- MIT licence, copyright "2026 sensennysen and Ledger contributors";
- contact through the repository's GitHub issues;
- receipt images deleted with the account;
- governing law: the operator's jurisdiction.

All five drafts were approved as written on 2026-10-03. The committed text is the approved text, with the source notes in brackets removed.

## What was built
**Part 1 (`235ef5e`, committed before approval because it changes no wording).**
- Deleting an account removes the user's receipt images first, through the Storage API (`src/lib/receiptCleanup.ts`, from `AuthContext.deleteAccount`).
- If listing or removing fails, nothing is deleted, and Settings shows "Your receipt images couldn't be removed, so your account was not deleted. Try again." with the raw cause.

**Part 2 (this commit)**
- **Privacy Policy, rewritten.**
  - It names every host the browser contacts and what each receives: Supabase, Google sign-in, Frankfurter, Google Fonts.
  - It says Ledger has no analytics, explains the self-serve export, correction and deletion, and links to the Cookies page.
- **Terms of Service, rewritten for an MIT-licensed, self-hosted app.** The old clauses that forbade reverse-engineering and claimed the code as "intellectual property of Ledger" are gone. It adds the operator and governing-law sections.
- **Data deletion.**
  - The data list is complete: receipts, notes, tags, saved filters and settings are now included.
  - Step 02 is right on phones: tap your initials, then Settings.
  - The analytics sentence is gone.
  - The warning box names receipts and backups, and a new "On this device" section says what sign-out clears.
- **New Cookies and browser storage page** (`/cookies`): every key the code writes, with its purpose and when it's removed. **New Notices page** (`/notices`): not financial advice, operator responsibilities, the MIT licence text, third-party software and contact.
- **Wiring**
  - `LegalPage` gains the two tabs; its tab row wraps, and its intro is now optional because the approved Terms has none.
  - Routes and page metadata in `App.tsx`.
  - The login footer links Data deletion, Cookies and storage, and Notices under the Terms/Privacy sentence.
  - The Settings Legal card adds Terms, Cookies and Notices.
  - Repository: `LICENSE` (MIT), `"license": "MIT"` in `package.json`, and the two new routes added to `scripts/sweep.mjs`.
- **`tests/legalPages.test.mjs` (5 tests)**
  - Every CSP host in `index.html` and `vercel.json` is named in the Privacy Policy.
  - Every browser-storage key the code writes is listed on the Cookies page. Taking `ledger-font-size` off the page made the test fail; restoring it made it pass.
  - The pages carry no analytics or anti-reverse-engineering claim, and LICENSE and `package.json` say MIT.
  - Each of the five routes has a route, metadata, a tab and a login link.
  - Each page has a "Last updated" date.

## Acceptance
- **(a) The owner approved each page's wording before commit: PASS.**
- **(b) The Privacy Policy names every host the browser contacts and what each receives: PASS.** Checked against the CSP (`connect-src`, `font-src`, `img-src`, `style-src`), `src/lib/supabase.ts` (the `X-Client-ID` header) and `exchangeRates.ts` (the Frankfurter query: currency codes only).
- **(c) Terms, deletion instructions and the cookie and storage notice are written and linked from the legal pages and the login footer: PASS.**
  - All five pages cross-link through the tab row and footer.
  - The login page links all five (screenshot at 390, signed out).
  - Settings links all five.
- **(d) Every changed page shows a new "Last updated" date: PASS.** October 3, 2026 on all five.
- **(e) Statements match the code: PASS.**
  - The storage list was taken from a grep of `src/` and `public/theme-init.js`, and the test now enforces it.
  - **Sign-out and deletion.** What they clear matches `AuthContext.signOut`/`deleteAccount`: cache, offline queue, pending receipts.
  - **Settings path.** Matches `AppLayout` (the phone account sheet) and `TopBar` (the gear at `md` and up).
  - **Receipt deletion.** Proven on the local stack: deleted the old way, 2 files remained; with the fix, 0.
- **Checks.**
  - `pnpm sweep` over the five legal pages, `/login` and `/settings` at 390 and 1280, light and dark: 28 PASS · 0 FAIL, with no sideways scroll. The five-tab row wraps at 390.
  - `pnpm lint`, `tsc -b` and `pnpm test` (861 passing, plus `tests/redesign.mjs`) are green.

## Deviations
- **Page metadata.** The route descriptions for the five pages (`App.tsx`, the meta description) are new one-line summaries of the approved text, not approved sentences themselves.
- **Cookies page layout.** The table is a definition list, one block per item, so it reads at 390. The words match the approved table.

## Backlog
- **LED-245.** A screen to list and clear these items from inside Ledger, using this wording.
- **`ledger_transaction_templates`** is not scoped to a user, and several keys survive sign-out (theme, preferences, Home layout, templates, recurring map, card reminders, 13th month picks). The page says so. Whether sign-out should clear them is a product call.
- **`ledger-recurring-generated`.** LED-232 moved "already posted" into the database, but the helper still writes this browser map. Now redundant; remove it in a hygiene pass, then drop it from the page.
- **Operator-specific text.** A self-hosted copy that adds a host must update the Privacy Policy and the CSP together. The test makes that a CI failure in this repository; operators' forks inherit it.
- **`public/sitemap.xml` and `index.html`** still use the placeholder domain `your-domain.example` and list no legal pages.
