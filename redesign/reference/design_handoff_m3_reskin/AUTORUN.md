# Unattended run — one prompt, whole change set

Use this instead of `TASKS.md` when you want to start it and walk away.
`TASKS.md` is the same work with you reviewing between steps; this trades that
review for speed. Everything lands on a branch with one commit per phase, so a
bad phase is one `git revert`, not a lost afternoon.

## Before you start

```
cp -r design_handoff_m3_reskin /path/to/ledger-personal-finance/
cd /path/to/ledger-personal-finance
git status          # must be clean
claude
```

## The prompt

Paste this whole block:

---

You are implementing a Material 3 re-skin plus a mobile navigation rework in
this repo, working unattended. I will review the result later, so leave a clear
trail.

**Read first, in this order:** `design_handoff_m3_reskin/README.md`,
`design_handoff_m3_reskin/SCREEN-MAP.md`,
`design_handoff_m3_reskin/NAV-REWORK.md`,
`design_handoff_m3_reskin/COVERAGE.md`.

`COVERAGE.md` is the route index: every route maps to a frame id in one of the
three `.dc.html` files. If a route's frame exists, follow it. If an
implementation seems to need a pattern that is not in this bundle, stop and note
it in the report rather than inventing one.

9. `m3: remaining routes` — `COVERAGE.md` frames M1-M7 and D1-D4:
   mobile Settings, Categories, Reports, 13th Month, account detail, Login,
   prose pages; desktop Accounts, Transactions, Budgets, Reports.

The `.dc.html` files in that folder are design references — inline-styled HTML
prototypes showing intended look and behaviour. Do not copy their markup and do
not import them. Recreate them with this repo's own patterns: React 19 + TS,
Tailwind v4, shadcn/ui, `cn()`, `NavLink`, and the existing hooks. Colors go in
as token variables and Tailwind token classes, never as the literal hex the
mockups use.

**Work on a branch, one commit per phase:**

```
git checkout -b m3-reskin-nav
```

1. `m3: token layer` — `src/index.css` from `tokens/index.css.m3.css` (keep the
   existing shadcn `@theme inline` mapping list verbatim);
   `src/constants/colors.ts` from `tokens/colors.ts`; update every
   `EMERALD`/`CORAL`/`GOLD` import site.
2. `m3: ui primitives` — radius/height pass on `src/components/ui/*` per README
   "Shape & spacing". No API changes.
3. `m3: bottom nav` — `NAV-REWORK.md` §1.
4. `m3: sheet host + fab` — `NAV-REWORK.md` §2 and §3.
5. `m3: global month cycle` — `NAV-REWORK.md` §4.
6. `m3: dashboard` — `SCREEN-MAP.md` A1/B1, page + widgets.
7. `m3: settings` — `SCREEN-MAP.md` A2/B2.
8. `m3: pwa state` — `NAV-REWORK.md` §5.
9. `m3: desktop detail pane` — the `DashboardDetailDialogs` change in
   `SCREEN-MAP.md`.
10. `m3: remaining routes` — the frames listed above, one commit per screen
    group: mobile settings + categories, mobile reports + 13th month, mobile
    login + prose, account detail, then the four desktop screens.

After **every** phase run `npx tsc --noEmit` and the project's lint/build
script. A phase does not get committed until both pass. If a phase cannot be
made to pass, commit the phases before it, skip that one, and note it in the
report — do not leave the branch broken and do not disable type checking,
suppress lint rules, or add `any` to get past an error.

**Do not touch:** `src/hooks/*` data logic, `src/lib/*`,
`src/contexts/AuthContext.tsx`, `supabase/*`, routes in `src/App.tsx`,
`src/types/index.ts`. No new dependencies except
`@material/material-color-utilities`, and only if you implement the dynamic-color
section of the README; if you skip that, leave `accentColor` exactly as it is.

**Judgement calls:** where the docs and the mockups disagree, the docs win on
behaviour and the mockups win on visuals. Where neither settles it, pick the
option that changes fewer files, and list the call in the report. Never invent a
new screen, route, or feature that is not in the docs.

**When done, write `design_handoff_m3_reskin/RUN-REPORT.md`:** the phases you
committed with their SHAs, any phase you skipped and why, every judgement call
you made, every file you touched outside the list above, and anything you think
I should look at first. Then stop — do not open a PR, do not merge, do not push.

---

## When you come back

```
git log --oneline m3-reskin-nav
cat design_handoff_m3_reskin/RUN-REPORT.md
npm run dev
```

Read the report before the diff — it tells you where to aim. Then open
`design_handoff_m3_reskin/Ledger M3 PWA.dc.html` beside the app at 428px wide
and compare by clicking: nav indicator, FAB position, sheet ordering, month
cycle, offline and install states.

Reverting one bad phase: `git revert <sha>`. Phase 1 is the risky one — if the
token paste went wrong, everything after it looks wrong too, so check that
commit first.
