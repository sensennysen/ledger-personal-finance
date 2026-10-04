# LED-161 · Div inside p while Home loads — retro (2026-09-29)

## What shipped
- `SkeletonText` (`src/components/ui/skeleton.tsx`) now renders a `<span>` instead of a `<div>`, with the same classes plus the ones it used to inherit from `Skeleton` (it no longer wraps `Skeleton`, since that component is hard-coded to a `<div>`).
- Grepped every `<p>...<SkeletonText>` and `<p>...<Skeleton>` site in `src/components` and `src/pages`: ~14 sites across `DashboardCashFlowForecastCard.tsx`, `LoanPurchaseTracker.tsx`, `CategoriesPage.tsx` (×3), `ThirteenthMonthPage.tsx` (×5), `AccountsPage.tsx` (×5) — all fixed by this one change, none needed a per-site edit. Confirmed no bare `<Skeleton>` (non-Text) is ever placed directly inside a `<p>`.
- Activity, Reports and Budgets loading states don't hit this pattern at all (no `<p>` wraps a `Skeleton`/`SkeletonText` there) — nothing to fix, per AC(b).

## Acceptance
- (a) Loading Home logs no "cannot be a descendant of" / "cannot contain a nested" errors: **PASS by construction** — a `<span>` is valid inside a `<p>`, so the warning cannot fire; not re-confirmed in a live console (browser extension unavailable this session, see Backlog).
- (b) Same for Activity, Reports, Accounts, Budgets: **PASS** — Accounts' 5 sites now use the fixed component; the other three pages never had the pattern.
- (c) Optional scanner test: **skipped**, marked optional in the ticket.
- Lint, `tsc -b`, full test suite (758 tests + redesign checks): PASS.

## Backlog
- No browser extension available this session to re-run the live console check that originally found this (LED-124). Re-run `knowledge/patterns/browser-check-with-local-user.md` against Home/Accounts/Categories/Thirteenth Month and confirm zero "cannot be a descendant of" warnings before calling this Done per the epic's "re-check after each fix" rule.
