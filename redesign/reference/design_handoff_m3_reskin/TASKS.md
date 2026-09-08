# Working through this with Claude Code

Paste-ready tasks. Each is one commit and one reviewable diff. Run them in
order — later tasks assume earlier ones landed.

## Setup (once)

Put this folder at the repo root so file paths in the docs resolve:

```
cp -r design_handoff_m3_reskin /path/to/ledger-personal-finance/
cd /path/to/ledger-personal-finance
claude
```

Then prime the session once:

> Read `design_handoff_m3_reskin/README.md`, `SCREEN-MAP.md` and
> `NAV-REWORK.md`. The `.dc.html` files are design references, not code to
> copy — the job is to recreate them with this repo's own patterns (`cn()`,
> shadcn primitives, `NavLink`, existing hooks). Don't write anything yet;
> tell me what you understand the change set to be.

Read its summary back before continuing. If it thinks it should copy HTML or
add a CSS framework, correct that now rather than mid-task.

## Task 1 — token layer

> Replace the `:root`, `.dark` and `@theme inline` blocks in `src/index.css`
> with `design_handoff_m3_reskin/tokens/index.css.m3.css`, keeping the existing
> long shadcn mapping list in `@theme inline` verbatim. Then replace
> `src/constants/colors.ts` with `tokens/colors.ts` and update every import of
> `EMERALD` / `CORAL` / `GOLD`. Run the dev server and list any component that
> still has a hard-coded color.

The whole app shifts on this one commit. Expect it to look right immediately and
slightly wrong in a few places — that's Task 2.

## Task 2 — primitives

> Per README "Shape & spacing", do a radius/height pass on `src/components/ui/*`:
> `--radius: 0.75rem`, cards 20px, inputs `rounded-xl` h-12, filled buttons
> `rounded-full` h-10. Don't change any component's API.

## Task 3 — bottom nav

> Implement §1 of `NAV-REWORK.md` in `src/components/layout/BottomNav.tsx`.
> Show me the diff before touching any other file.

Smallest, most visible change — a good gate on whether the docs are being read
literally. Check the diff deletes the FAB and the `isMore` branch rather than
adding conditionals around them.

## Task 4 — sheet host, avatar menu, FAB

> Implement §2 and §3 of `NAV-REWORK.md` in
> `src/components/layout/AppLayout.tsx`. One `sheet` state replaces `createOpen`
> and `moreMenuVisible`. Keep the desktop dialog path unchanged.

The largest task. If it starts drifting, split it: sheet host first, then the
add sheet's keypad.

## Task 5 — global month cycle

> Implement §4 of `NAV-REWORK.md`: lift `useMonthCycle` and `selectedMonth`
> out of `DashboardPage` so Home, Activity and Budgets share one cycle.

## Task 6 — dashboard + settings re-skin

> Using `SCREEN-MAP.md` rows A1/B1 and A2/B2, restyle `DashboardPage` and its
> widgets, then `SettingsPage` (single column → `lg:grid-cols-2`).

## Task 7 — PWA state

> Implement §5 of `NAV-REWORK.md`: `OfflineBanner`, `PWAInstallBanner`,
> safe-area insets. Verify in Chrome DevTools with `display: standalone`.

## Task 8 — desktop detail pane

> Implement the `DashboardDetailDialogs` change in `SCREEN-MAP.md`: on `≥md`
> render `detailView` into a 340px right pane in `AppLayout`; keep the dialog
> below `md`.

## Checking the result

Open `design_handoff_m3_reskin/Ledger M3 PWA.dc.html` in a browser next to the
running app at 428px width and compare directly. The mockup is interactive, so
sheet ordering, the nav indicator and FAB visibility can be checked by clicking
rather than by reading.

If something in the built app and the mockup disagree, the mockup is right on
**visuals** and the docs are right on **behaviour** — the docs know about repo
constraints the mockup doesn't.
