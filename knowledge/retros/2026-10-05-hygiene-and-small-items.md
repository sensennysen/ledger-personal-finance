# Hygiene and small items — retro (2026-10-05)

Branch `main`. Backlog items from the LED-189, LED-232, LED-202, LED-251 and epic 21 phase C retros, none ticketed.

## What was done
| Item | Change |
|---|---|
| Placeholder domain | `src/lib/siteMeta.ts` (pure, 7 tests) and a `ledger-site-meta` plugin in `vite.config.ts`: the canonical link, `og:url`, `sitemap.xml` (home, login and the five legal pages) and `robots.txt` come from `VITE_SITE_URL` at build time. Unset, the build ships no canonical link and no sitemap, and robots.txt has no Sitemap line. `public/sitemap.xml` and `public/robots.txt` removed; `index.html` has no `your-domain.example`. |
| Redundant browser key | The `ledger-recurring-generated` map is gone (the database records each post since LED-232). The generator removes the key an older version left behind. Its row left the Cookies and storage notice (`STORAGE_ROWS`); a removal, so no new wording to approve. |
| README | A new database applies every migration in order; `schema.sql` is only the baseline. `VITE_SITE_URL` documented in README and `.env.example`; AGENTS.md layout line updated. |
| Amount `0` | The entry form shows a zero amount empty with a `0.00` placeholder, so typing reads `12.50`, not `012.50`. An empty amount still fails with "Amount must be positive". |
| Activity Sum | The Sum stays a sum of the listed rows (LED-251's decision) and now says `incl. N scheduled` when future-dated rows are listed. Activity and the account page. |
| Midnight rollover | `useLocalDate` (with `msUntilNextLocalMidnight`, tested) updates "today" at local midnight and when the tab is shown again. `useBudgets` refetches on the new day; the budget export and both Sum notes use it. |

## Verification
- `pnpm lint`, `pnpm build`, `pnpm test`: 1024 pass.
- `vite build` without `VITE_SITE_URL`: robots.txt only, no sitemap, no canonical. With `https://ledger.example.com/`: absolute canonical and `og:url`, a sitemap of all seven routes, and an absolute Sitemap line.
- Browser pane, local Supabase: a scheduled probe row (inserted, then deleted) gave "Sum −$1,835.40 · incl. 1 scheduled"; the legacy key set by hand was gone after loading Activity; the new-expense Amount was empty with placeholder `0.00`, typing gave `12.50`, and clearing it gave "Amount must be positive".

## Not done
- **The phone add button covering content** (LED-202 backlog, seen again on the 17e). The design handoff fixes it as a floating button at `right:16px; bottom:96px` and rejected the docked one (`2c`), so changing it is a design call, not hygiene.
- The midnight timer itself was not watched across a real midnight; the date maths is unit-tested and the visibility path was read, not driven.

## Backlog
- **Production needs `VITE_SITE_URL`** in Vercel (Production environment) for the sitemap and canonical link to ship; until then the deploy has neither, which is better than the placeholder it had.
- `og:image` is still a relative `/social-preview.svg`; some crawlers want an absolute URL. It could come from `VITE_SITE_URL` the same way.
