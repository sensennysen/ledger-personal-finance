# Ledger — Navigation, UX & PWA Design Document

**Status:** Draft v1
**Date:** 2026-09-07
**Owner:** Design / Frontend
**Scope:** Whole application. Focus areas: information architecture, navigation, user experience, and turning Ledger into a first-class installable PWA.

---

## 1. Purpose & Goals

Ledger is a self-hostable personal-finance app (React 19 + Vite + Supabase + Tailwind v4, "Obsidian Ledger" theme). It already ships a working feature set — accounts, transactions, budgets, credit-card monitoring, reports, recurring transactions, offline queue, and a partial PWA setup. This document defines a coherent redesign of **how users move through the app** and **how the app behaves as an installed application on phone and desktop**.

### Primary goals

1. **One predictable navigation model** across desktop and mobile, with no dead ends and no duplicated/conflicting controls.
2. **Faster task completion** for the three highest-frequency jobs: *record a transaction*, *check balances*, *review spending against budget*.
3. **A real PWA**: correct manifest, full icon set, reliable offline, controlled update flow, install guidance on iOS and Android, and (optionally) real push.
4. **Performance budget** that makes the above credible on a mid-range phone on cellular.

### Non-goals

- Backend/data-model redesign (Supabase schema stays as-is).
- New financial features (multi-user, sync with banks, etc.).
- Visual rebrand — the parchment/obsidian palette, Playfair/Outfit/DM Mono type system, and gold accent stay. We refine, not replace.

### Success metrics

| Metric | Today (est.) | Target |
|---|---|---|
| Initial JS transferred | ~2.3 MB single chunk | < 250 KB initial route, lazy rest |
| Time to first interaction (mid phone, 4G) | unmeasured | < 3.5 s |
| Taps to log an expense from any screen | 2 (FAB) / 3+ (desktop) | 2 everywhere |
| Lighthouse PWA "installable" | partial (icon/manifest gaps) | pass, no warnings |
| Offline: open app, view last month, queue an edit | works, fragile (localStorage) | works, durable (IndexedDB) |
| iOS "Add to Home Screen" produces correct icon/splash/status bar | no | yes |

---

## 2. Current-State Audit (all elements)

### 2.1 Routing & screens

Source: `src/App.tsx`, `src/pages/*`.

| Route | Page | Notes |
|---|---|---|
| `/` | `DashboardPage` | Widget grid, month switcher, alerts |
| `/accounts` | `AccountsPage` | 793 lines |
| `/accounts/:accountId` | `AccountTransactionsPage` | 861 lines, **no in-app back affordance** |
| `/transactions` | `TransactionsPage` | 711 lines, own month switcher, own `n` shortcut |
| `/categories` | `CategoriesPage` | 857 lines |
| `/budgets` | `BudgetsPage` | 1397 lines |
| `/reports` | `ReportsPage` | 1277 lines, pulls `jspdf` + `html2canvas` + `dompurify` |
| `/settings` | `SettingsPage` | 610-line single scroll form |
| `/login` `/privacy` `/terms` `/data-deletion` | public | |
| `ThirteenthMonthPage` | **not routed** | dead code or unfinished feature |

Observations:
- **No route-based code splitting.** `dist/assets/index-*.js` is a single 2.27 MB chunk. Every page, Recharts, jspdf, html2canvas, emoji-picker, day-picker load on first paint.
- **No 404 / catch-all** inside the authenticated area — unknown paths render nothing.
- **No breadcrumbs** and nested routes (`/accounts/:id`) rely on the browser back button only; in standalone PWA mode there is no browser chrome, so this is a real dead end.
- **Meta management** (`RouteMeta` in `App.tsx`) is well done and should be preserved.

### 2.2 Navigation components

**Desktop — `Sidebar.tsx`**
- Collapsible rail (`w-55` ↔ `w-15`), 7 nav items, avatar, sign-out, theme toggle, collapse toggle.
- Collapse state is local (`useState`), not persisted → resets every reload.
- Tooltip readiness logic (`tooltipsReady`, `onTransitionEnd`) is intricate and fragile.
- Active detection: `startsWith(to)` — `/accounts` stays highlighted on `/accounts/:id` (correct) but there is no secondary indication of *which* account.

**Mobile — `BottomNav.tsx` + `AppLayout.tsx`**
- 4 tabs: Home, Accounts, **Transact**, **More** + center FAB (Add Transaction).
- "More" tab is a `NavLink` to `/settings` **but** its `onClick` calls `onMoreMenu` and it renders as active based on `moreMenuOpen`, not route — a control doing two different things.
- The "More" sheet is a **hand-rolled** `fixed` div + backdrop in `AppLayout.tsx`, not the existing `Sheet` primitive. It contains Categories / Budgets / Reports (as 3 small cards), a light-mode `Switch`, and a Settings row.
- Result: Budgets, Categories, Reports are **second-class** — two taps, behind an inconsistent control, invisible to a new user.
- `moreMenuPath` / `moreMenuVisible` gymnastics exist to auto-close the menu on navigation — a symptom of not using a real overlay primitive with route awareness.

**Cross-cutting**
- **Theme toggle exists in 3 places** (sidebar, mobile "More" sheet, Settings) with 3 slightly different affordances.
- **`cmdk` is a dependency and `components/ui/command.tsx` exists, but there is no command palette.** Only one keyboard shortcut in the whole app (`n` on Transactions).
- **`OrientationLock`** force-locks portrait for everyone; on tablet/desktop-installed this is user-hostile.
- Month navigation is re-implemented independently on Dashboard and Transactions; the selected month does **not** carry between them.
- Add-Transaction modal always `navigate('/transactions')` on success — jarring when invoked from the Dashboard.

### 2.3 PWA state

Source: `vite.config.ts` (`VitePWA`), `public/manifest.json`, `index.html`, `src/lib/offlineQueue.ts`, `src/lib/dataCache.ts`, `src/lib/receiptStore.ts`, `src/hooks/useNetworkStatus.ts`, `src/components/layout/{PWAInstallBanner,OfflineBanner}.tsx`, `src/hooks/useCreditCardNotifications.ts`.

**What works**
- `vite-plugin-pwa` with `registerType: 'autoUpdate'`, Workbox precache of app-shell globs, `navigateFallback: index.html`, runtime cache for Google Fonts. Build emits `sw.js` + `registerSW.js`.
- Offline mutation queue (`offlineQueue.ts`): insert/update/delete replay against Supabase, 30-day TTL, basic `updated_at` conflict check, pending-receipt resolution via IndexedDB.
- Warm-start data cache (`dataCache.ts`) and profile cache seed pages offline.
- `OfflineBanner` communicates offline / syncing / queued states clearly.
- CSP in `index.html` is thoughtfully scoped.

**Gaps / defects**

| Area | Problem |
|---|---|
| **Manifest** | Single icon `l-black.png`, `sizes:"any"`, `purpose:"any maskable"` — the same non-padded black logo used as maskable → will be clipped in the Android mask; unreadable on dark launchers. No `id`, no `screenshots`, no `shortcuts`, no `categories`, no `lang`/`dir`. `theme_color`/`background_color` are the **light** parchment (`#f0ece5`) while the app **defaults to dark** → white flash on launch for the default user. |
| **Icons** | `public/icons/` **does not exist**. `useCreditCardNotifications` references `/icons/icon-192.png` for notification icon+badge → broken image. No 192/512, no maskable, no monochrome badge, no `apple-touch-icon`. |
| **iOS** | No `apple-touch-icon`, no `apple-mobile-web-app-capable` / `-status-bar-style` / `-title`, no launch/splash images. iOS `beforeinstallprompt` never fires, so `PWAInstallBanner` shows *nothing* on iOS — no install guidance at all. |
| **Update flow** | `autoUpdate` silently activates a new SW and reloads on next navigation. No "new version available" affordance; an in-progress form can be lost. No `registerSW` hook in app code to surface `needRefresh` / `offlineReady`. |
| **Offline durability** | Queue + cache live in **`localStorage`** (synchronous, ~5 MB, string-only, evicted under pressure). A month of transactions + receipts metadata can approach the ceiling. Should be IndexedDB. |
| **Push** | "Notifications" are **local only** — `registration.showNotification` fired from a foreground `setInterval`/`focus` handler. Nothing fires when the app is closed. No VAPID keys, no `pushManager.subscribe`, no server. Marketed in README as reminders. |
| **`theme_color` vs scheme** | Single `<meta name="theme-color">`; no `media="(prefers-color-scheme: dark)"` variant → status bar / task-switcher chrome wrong in one mode. |
| **`start_url`** | No `?source=pwa` (or similar) → can't distinguish installed launches in analytics; no `id` → update identity relies on `start_url`. |
| **Display** | `display: standalone` only, no `display_override` (`window-controls-overlay` / `minimal-ui` fallback). No `launch_handler`. |
| **Safe areas** | BottomNav uses `pb-2`; no `env(safe-area-inset-bottom)` → FAB/labels collide with the iOS home indicator when installed. `viewport` has no `viewport-fit=cover`. |
| **Share / files** | No `share_target` (can't send a receipt photo to Ledger) and no `file_handlers` (can't open a CSV with Ledger) despite CSV import + receipts being core. |

### 2.4 UX friction inventory

- **Dense mega-pages.** Budgets (1397), Reports (1277), Categories (857), AccountTransactions (861). Long forms, many modals, heavy first render.
- **Settings** is one uninterrupted scroll: profile, currency, month-cycle, appearance (theme/font-size/accent), number & date locale, transaction/account view defaults, notifications, danger zone. No anchors, no sections, hard to deep-link.
- **No global search.** Finding a specific transaction requires: pick month → type in the page-local search. Cross-month search is impossible from the UI.
- **No toast system.** Only `UndoToast` for deletes. Create/update/error feedback is ad hoc (`formError` strings).
- **First-run / empty states.** `EmptyState` primitive exists but there is no guided onboarding (create first account → first category → first transaction).
- **Loading.** Auth gate is a full-screen spinner; route changes animate (`animate-page-in`) but there is no skeleton for the first data fetch on most pages.
- **Accessibility.** `prefers-reduced-motion` is respected (good). But: trend/direction is communicated by **color only** (emerald/coral) in `StatCard`; tooltips are pointer-only; the mobile "More" menu is not a focus-trapped dialog; icon-only buttons in a few places lack labels.
- **Motion.** Nice entrance system in `index.css`. Page transition is enter-only (no exit), so back-navigation feels abrupt.

---

## 3. Design Principles

1. **Same mental model everywhere.** A destination is reachable the same number of ways on phone and desktop. Primary destinations are always one interaction away.
2. **The ledger is the point.** Recording and reviewing money must be the shortest paths. Everything else is configuration.
3. **Offline is a first-class state, not an error.** Every screen must render from cache and every mutation must queue silently.
4. **Installed ≠ website.** In standalone mode there is no browser back, no URL bar, no refresh. The app must provide those affordances itself.
5. **Progressive disclosure.** Mega-pages become an overview + focused sub-views. Settings becomes navigable sections.
6. **Respect the platform.** Safe areas, dynamic theme-color, iOS install reality, reduced-motion, keyboard.

---

## 4. Information Architecture (proposed)

```
Ledger
├─ Home (/)                     overview, this-cycle snapshot, alerts, quick actions
├─ Transactions (/transactions) the ledger; global search lives here
│   └─ Transaction detail       (sheet/route) view · edit · split · receipt
├─ Accounts (/accounts)
│   └─ Account (/accounts/:id)  balance history + that account's transactions
├─ Budgets (/budgets)
│   └─ Budget (/budgets/:id)    progress, history, rollover
├─ Reports (/reports)           summaries + export (lazy-loaded)
├─ Categories (/categories)     manage categories & subcategories
└─ Settings (/settings)
    ├─ Profile          (/settings/profile)
    ├─ Preferences      (/settings/preferences)   currency, month cycle, locale, view defaults
    ├─ Appearance       (/settings/appearance)    theme, accent, font size
    ├─ Notifications    (/settings/notifications)
    ├─ Data & Privacy   (/settings/data)          export, deletion, legal links
    └─ About            (/settings/about)         version, update check, install
```

**Primary nav (always visible):** Home · Transactions · Accounts · Budgets · Reports
**Secondary (one level in):** Categories, Settings, and everything under Settings.
**Global, non-nav:** Add Transaction (action), Command palette / Search (action).

Rationale: Categories is *setup you touch rarely*; it moves next to Settings. Budgets and Reports are *core review activities*; they get promoted to primary nav on all form factors — no more "More" jail.

`ThirteenthMonthPage`: decide — either route it under Reports as a tab/section, or delete it. It should not remain unrouted.

---

## 5. Navigation Redesign

### 5.1 Desktop — sidebar

- **Sections:** a `MAIN` group (Home, Transactions, Accounts, Budgets, Reports) and a `MANAGE` group (Categories, Settings), with a small uppercase label per group (matches existing `tracking-widest` treatment).
- **Persist collapse state** to `localStorage` (`ledger-sidebar-collapsed`), same pattern as theme.
- Replace the bespoke tooltip-readiness machinery with the `Tooltip` primitive gated simply on `collapsed` (render tooltips only when collapsed; no transition listener).
- Active account/budget shown as an indented, muted sub-row under its parent when on a detail route (gives "you are here" without breadcrumbs).
- Keep avatar + sign-out at the bottom. **Remove** the theme toggle from here — appearance moves to Settings and the command palette (see 5.4). Keep exactly one quick theme control: a small icon button in the top bar (see 5.3).

### 5.2 Mobile — bottom nav + FAB

- **5 destinations, no "More":** Home · Transactions · Accounts · Budgets · Reports. FAB (Add Transaction) stays centered and overlapping.
- Categories & Settings are reached from the **top bar** (avatar/menu on the left opens a proper `Sheet`) and from the **command palette**.
- Rebuild the overflow menu as the real `Sheet` component (`side="bottom"`), focus-trapped, with `env(safe-area-inset-bottom)` padding. It contains: Categories, Settings, theme toggle, install/update status, sign-out.
- **Safe areas:** add `viewport-fit=cover` to the `<meta viewport>`; pad BottomNav with `calc(0.5rem + env(safe-area-inset-bottom))`; pad top bar with `env(safe-area-inset-top)`.
- Active tab: keep the current pill treatment; add `aria-current="page"`.
- The FAB opens the Add-Transaction sheet **in place**; on success it stays on the current screen and shows a toast ("Added · View") instead of force-navigating to `/transactions`.

### 5.3 Top bar (new, both form factors)

A slim, sticky header inside `AppLayout` (replaces the current bannerless `<main>` top):

`[ menu/avatar ]  Page title / breadcrumb        [ search ] [ theme ] [ sync status ]`

- **Breadcrumb:** on detail routes shows `Accounts / Chase Checking` with the parent clickable — this is the standalone-mode "back".
- **Back chevron:** when `history.length > 1` and route is a detail route, show a leading `‹` that calls `navigate(-1)`; fall back to the parent route if there's no history (deep link / fresh PWA launch).
- **Search button:** opens the command palette (5.4).
- **Sync status:** compact form of `OfflineBanner` (dot + count); tap → force `syncNow()`. The full-width `OfflineBanner` still appears when offline.
- Height ~48px; collapses on scroll-down, reappears on scroll-up (mobile only).

### 5.4 Command palette (new) — `cmdk`

Trigger: `⌘K` / `Ctrl-K`, the top-bar search button, and `/` when no input is focused.

Groups:
- **Actions:** Add income · Add expense · Add transfer · Import CSV · Export report · Toggle theme · Lock month cycle…
- **Go to:** every route incl. Settings sub-sections.
- **Accounts / Budgets / Categories:** fuzzy list, Enter → detail.
- **Transactions:** live search across **all months** (this is the missing global search) — debounced Supabase query on description/notes/tags/amount, falling back to the in-memory cache when offline.

This single component removes the pressure to cram everything into the nav and gives power users a fast path.

### 5.5 Shared month-cycle context

Create `MonthCycleContext` (provider in `AppLayout`) holding `selectedMonthKey` + setters, seeded from `useMonthCycle().startDay`. Dashboard, Transactions, Budgets, Reports all read/write the *same* value, so moving to "July" on the Dashboard and tapping into Transactions keeps you in July. Persist to `sessionStorage` so a reload in the same session is stable, but always snap back to the current cycle on a fresh launch.

### 5.6 Route transitions

- Add a paired exit animation (short fade/translate down) so back-navigation isn't abrupt. Gate on `prefers-reduced-motion` (already handled globally).
- Preserve scroll position per route key on back.

---

## 6. Screen-by-Screen UX

### 6.1 Home / Dashboard
- Keep the customizable widget grid. Move the widget-settings entry into the top bar overflow on mobile (currently competes with the page title).
- The month switcher becomes the shared control (5.5) and visually matches the one on Transactions.
- Add a compact **"Quick add"** row (Income / Expense / Transfer chips) above the fold for one-tap categorized entry — chips open the sheet pre-typed.
- Alerts: make each dismissal persist for the cycle (currently `useState` only → reappear on reload).
- First-run: when there are no accounts, replace the grid with a 3-step onboarding card (Add account → Add category (or accept defaults) → Log first transaction).

### 6.2 Transactions
- Promote search to the top bar / palette as **cross-month**; keep the in-page filter chips (type, tags) for the current view.
- Extract the row-heavy list into a virtualized list (`@tanstack/virtual` or manual windowing) — months with 200+ rows jank on scroll.
- Move bulk-select, import, templates, keyboard-shortcut help behind a single "⋯" menu to declutter the control strip.
- Transaction detail: make it a route (`/transactions/:id`) that renders as a right-side `Sheet` on desktop and a full-screen route on mobile, so it's linkable and back-navigable.
- Keep `n` shortcut; register it globally via the palette's shortcut map, not per-page.

### 6.3 Accounts & Account detail
- Account detail (`/accounts/:id`) gets the top-bar breadcrumb + back (fixes the current dead end).
- Add prev/next account paging in the header so you can sweep across accounts without returning to the list.
- Show the account's currency, type, and (for cards) statement/due chips inline at the top.

### 6.4 Budgets
- Split the 1397-line page: overview (list of budgets with progress bars) + `/budgets/:id` detail (history chart, rollover settings, linked transactions). Lazy-load the detail.
- The create/edit form becomes a `Sheet`, consistent with Transactions.

### 6.5 Reports
- **Lazy-load the whole route** and its deps (`jspdf`, `jspdf-autotable`, `html2canvas`, `dompurify`, heavy Recharts compositions). This alone removes ~550 KB from initial load.
- Export actions get progress + a toast on completion; disable while generating.
- Fold ThirteenthMonth here as a report type if kept.

### 6.6 Categories
- Move to the `MANAGE` nav group. Keep drag-reorder (`useFlipReorder`) and emoji/color pickers, but lazy-load `emoji-picker-react` (only mount on open).

### 6.7 Settings → sectioned
- Convert to nested routes (§4). On desktop: a two-pane layout (section list + content). On mobile: a list that pushes to each section (`/settings/appearance` etc.), each with a back affordance.
- Deep links: command palette entries point straight at sections.
- **About** section surfaces: app version (from `import.meta.env` / build), "Check for updates" (calls SW `update()`), install button / iOS instructions, storage usage (`navigator.storage.estimate()`), "Clear cache", and a "Force sync" button.

### 6.8 Login & legal
- Add `apple-touch-icon` + theme-color so the OAuth round-trip in standalone mode doesn't flash white.
- Legal pages: give them the top bar with a back to wherever the user came from (or to `/settings/data`).

### 6.9 Global: toast system
- Introduce one toast provider (Base UI toast or a minimal custom, matching `UndoToast` styling). Standard events: created / updated / deleted (with undo) / sync complete / offline queued / update available. Positioned above the BottomNav + safe area on mobile.

---

## 7. PWA Architecture

### 7.1 Manifest (`public/manifest.json`) — target spec

```jsonc
{
  "id": "/?source=pwa",
  "name": "Ledger — Personal Finance",
  "short_name": "Ledger",
  "description": "Track spending, manage accounts, and plan budgets. Your data, your rules.",
  "lang": "en",
  "dir": "ltr",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "minimal-ui"],
  "orientation": "any",
  "background_color": "#0a0a0b",   // dark by default (app default theme)
  "theme_color": "#0a0a0b",
  "categories": ["finance", "productivity"],
  "launch_handler": { "client_mode": "navigate-existing" },
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/monochrome.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "monochrome" }
  ],
  "shortcuts": [
    { "name": "Add transaction", "short_name": "Add", "url": "/transactions?new=1",
      "icons": [{ "src": "/icons/shortcut-add.png", "sizes": "96x96" }] },
    { "name": "This month", "url": "/transactions" },
    { "name": "Reports", "url": "/reports" }
  ],
  "screenshots": [
    { "src": "/screenshots/mobile-home.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "Home dashboard" },
    { "src": "/screenshots/desktop-home.png", "sizes": "1920x1080", "type": "image/png", "form_factor": "wide", "label": "Home dashboard" }
  ],
  "share_target": {
    "action": "/transactions?shared=1",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title", "text": "text",
      "files": [{ "name": "receipt", "accept": ["image/*", "application/pdf"] }]
    }
  },
  "file_handlers": [
    { "action": "/transactions?import=1", "accept": { "text/csv": [".csv"] } }
  ]
}
```

Notes:
- `background_color`/`theme_color` default **dark** to match the app default; the SW/app updates `<meta name="theme-color">` at runtime when the user is in light mode.
- `orientation: "any"` — remove `OrientationLock`, or make it opt-in via a preference for phone users who want it.
- Keep `manifest: false` in `VitePWA` (manual manifest) — it's already the chosen approach and `index.html` links it.

### 7.2 Icons & platform assets (to produce)

| Asset | Size(s) | Purpose |
|---|---|---|
| `icon-192.png`, `icon-512.png` | 192, 512 | Android/Chrome `any` |
| `maskable-192.png`, `maskable-512.png` | 192, 512, **20% safe-zone padding** | Android adaptive mask (gold "L" on solid obsidian) |
| `monochrome.svg` | vector | notification/monochrome badge |
| `apple-touch-icon.png` | 180×180, **no transparency**, solid bg | iOS home screen |
| `favicon.svg` (+ `.ico` fallback) | — | already have `favicon.svg`; add ICO |
| iOS splash screens | per device (use a generator) | `<link rel="apple-touch-startup-image" media=...>` |
| `screenshots/*` | narrow + wide | install UI richness |
| `icons/shortcut-*.png` | 96×96 | manifest shortcuts |
| **`/icons/icon-192.png` must exist** | — | currently referenced by `useCreditCardNotifications` and 404s |

All generated from the existing "L" mark. Keep both `l-black.png` / `l-white.png` for the in-app sidebar logo swap.

### 7.3 `index.html` additions

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

<!-- dynamic theme color -->
<meta name="theme-color" media="(prefers-color-scheme: dark)"  content="#0a0a0b" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f0ece5" />

<!-- iOS -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Ledger" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<!-- apple-touch-startup-image links per device… -->
```

CSP: add nothing for local notifications. **If** real push is adopted, add the push service origin to `connect-src` and keep `worker-src 'self'`.

### 7.4 Service worker & caching strategy

Keep `vite-plugin-pwa` + Workbox `generateSW`, but tune:

| Resource | Strategy | Why |
|---|---|---|
| App shell (JS/CSS/HTML) | precache + `autoUpdate` | instant loads; controlled refresh (see 7.5) |
| Navigations | `NetworkFirst` → `index.html` fallback | fresh HTML when online, shell when not (already set via `navigateFallback`) |
| Supabase REST `GET` (`/rest/v1/*`) | `NetworkFirst`, 5 s timeout, short `maxAge`, cache name `sb-api` | read-through offline without serving stale writes; app cache still primary |
| Supabase Storage receipts (`/storage/v1/object/*`) | `CacheFirst`, 30-day expiration, `maxEntries: 200` | receipts are immutable once uploaded |
| Google Fonts | `CacheFirst` (already configured) | |
| Supabase `POST/PATCH/DELETE` | **never cache**; app-level `offlineQueue` owns these | avoid double-writes |

Add `navigateFallbackDenylist` for `/rest/`, `/auth/`, `/storage/` (currently only `/api/`).
`maximumFileSizeToCacheInBytes` can drop from 3 MiB once the bundle is code-split.

### 7.5 Update flow (controlled)

Replace silent `autoUpdate` behavior with an explicit prompt:

- App imports the virtual register hook: `import { registerSW } from 'virtual:pwa-register'` (or the React variant) in `main.tsx`.
- On `onNeedRefresh`: show a persistent toast — **"A new version is ready. Reload."** with a Reload button → `updateSW(true)`.
- On `onOfflineReady`: one-time toast "Ready to work offline."
- Never auto-reload while a form/sheet is dirty. If the user ignores the prompt, apply on the next full app launch.
- Settings → About → "Check for updates" calls `registration.update()`.

(Keep `registerType: 'autoUpdate'` for the SW lifecycle, but drive the reload from the UI via `onRegisteredSW` + skipWaiting-on-demand. Alternatively switch to `registerType: 'prompt'`.)

### 7.6 Offline data — move off `localStorage`

- New module `src/lib/idb.ts` (thin wrapper over `idb` or raw IndexedDB) with stores:
  - `queue` — replaces `offlineQueue.ts` array (same `QueueItem` shape, same `drainQueue` logic; gains durability, size, and async access).
  - `cache` — replaces `dataCache.ts` (`{ key, data, expiresAt }`), keyed, with an index on `expiresAt` for cheap sweeping.
  - `receipts` — already IndexedDB (`receiptStore.ts`); keep.
- Migration: on first run of the new version, copy any existing `ledger_offline_queue` / `ledger_cache:*` / theme prefs are fine to leave in `localStorage` (small).
- `useNetworkStatus` becomes async (`pendingCount()` returns a promise or is fed by a `BroadcastChannel` from the SW). Consider **Background Sync** (`self.registration.sync.register('ledger-queue')`) so the queue drains even if the app isn't open — with the existing `drainQueue` running in the SW. Fallback to the current online-event drain where Background Sync is unavailable (iOS).
- Expose storage usage in Settings → About via `navigator.storage.estimate()` and offer `navigator.storage.persist()` on install.

### 7.7 Notifications: local now, push later

**Phase A (ship first) — make local reliable**
- Fix the icon paths (`/icons/icon-192.png` will exist).
- Register a **Periodic Background Sync** (`periodicSync.register('ledger-reminders', { minInterval: 12h })`) where supported so credit-card reminders can fire when the app is closed on Android; keep the foreground `setInterval`/`focus` check as the universal fallback.
- Move the reminder computation into a shared pure function used by both the hook and the SW periodic handler.
- Settings → Notifications: clear permission state machine (unsupported / default / denied / granted), test-notification button.

**Phase B (optional) — real push**
- Requires: VAPID keypair, a `push_subscriptions` table (user_id, endpoint, keys), a Supabase Edge Function (or cron) that computes due reminders server-side and calls the Web Push protocol, and `pushManager.subscribe` in the client.
- SW gains `push` + `notificationclick` handlers (deep-link to the relevant account/budget).
- Add the push endpoint origin to CSP `connect-src`.
- This is the only way reminders work with the app fully closed on desktop and the only *reliable* cross-platform path. Scope it as a follow-up; it needs backend work Ledger currently avoids.

### 7.8 Standalone-mode affordances (recap)
- Top-bar back/breadcrumb (5.3) — **required**, no browser chrome in `standalone`.
- Pull-to-refresh: implement a lightweight custom refresh on the scroll container (or rely on the sync-status tap) — `standalone` has none.
- `window-controls-overlay` (desktop installed): if adopted, make the top bar `-webkit-app-region: drag` outside interactive controls, respect `env(titlebar-area-*)`.
- Detect display mode (`window.matchMedia('(display-mode: standalone)')`) to: hide the install banner, show the in-app back affordances, and tag analytics.

### 7.9 Install prompts
- **Android/desktop:** keep `beforeinstallprompt` capture (`PWAInstallBanner`), but move it to a less intrusive spot (top-bar overflow + a one-time card on Home after 2–3 sessions), and remember "installed" via `appinstalled` + `display-mode` so it never shows again.
- **iOS:** detect iOS Safari + not standalone → show a small "Install: Share → Add to Home Screen" hint (with the share glyph) in Settings → About and once on Home. This is the *only* iOS path and today there is nothing.

---

## 8. Visual & Interaction System (refinements only)

- **Tokens:** keep the OKLCH light/dark token sets in `index.css`. Add `--safe-top`/`--safe-bottom` convenience vars mapped to `env(safe-area-inset-*)`.
- **theme-color runtime sync:** a tiny effect in `ThemeProvider` that sets `<meta name="theme-color">` to `--background` of the active theme (covers the user-chosen accent path too).
- **Type:** unchanged (Playfair display, Outfit UI, DM Mono for money). Ensure fonts are `font-display: swap` and preconnected (already are).
- **Motion:** add exit transitions; keep the `cubic-bezier(0.22,1,0.36,1)` curve and reduced-motion guard.
- **Density:** introduce a `--space` scale usage audit on the mega-pages; target a consistent 4/8px rhythm.
- **Icons:** standardize on `lucide-react` at 3 sizes (14 / 16 / 18) — currently a mix incl. `w-[18px]`.

---

## 9. Accessibility

- Replace color-only trend cues in `StatCard` with an arrow glyph + text ("▲ 12% vs last month").
- Every icon-only control gets `aria-label`; bottom-nav items get `aria-current`.
- Mobile overflow + all sheets: focus trap, `Esc` to close, return focus to trigger (use the `Sheet`/`Dialog` primitives, not hand-rolled divs).
- Command palette: full keyboard nav (cmdk handles most), `aria-activedescendant`.
- Respect `prefers-reduced-motion` for the new exit transitions and pull-to-refresh.
- Hit targets ≥ 44×44 CSS px on all nav and FAB (FAB is 56, ok; check bottom-nav labels).
- Color contrast: verify muted-foreground on card meets 4.5:1 in both themes (the obsidian `--muted-foreground` at `oklch(0.640 …)` on `--card` `oklch(0.112 …)` is borderline — measure).

---

## 10. Performance

| Action | Est. saving | How |
|---|---|---|
| Route-level `React.lazy` + `Suspense` for every page | large | split the 2.27 MB chunk |
| Lazy-load Reports deps (`jspdf`, `jspdf-autotable`, `html2canvas`, `dompurify`) | ~550 KB | dynamic `import()` inside the export handler |
| Lazy-mount `emoji-picker-react` | ~1?? KB | only on picker open |
| Lazy-load `react-day-picker` calendar | moderate | only when a date field opens |
| Virtualize long transaction lists | runtime | windowed list |
| `manualChunks` for `recharts`, `@supabase`, `react-router` | caching | Vite `build.rollupOptions.output.manualChunks` |
| Precache budget shrinks | — | lower `maximumFileSizeToCacheInBytes` after split |
| Preload the current route's data via a router loader | perceived | React Router v7 loaders |

Add a CI check (bundlesize / `rollup-plugin-visualizer` in `npm run build`) to hold the initial-route budget.

---

## 11. Component & File Change List

**New**
- `src/components/layout/TopBar.tsx` — breadcrumb, back, search, theme, sync status.
- `src/components/layout/CommandPalette.tsx` — `cmdk`, global.
- `src/components/layout/MobileNavSheet.tsx` — real `Sheet`, replaces the hand-rolled menu in `AppLayout`.
- `src/context/MonthCycleContext.tsx` — shared selected month.
- `src/context/ToastContext.tsx` (+ `ui/toast.tsx`) — app-wide toasts.
- `src/lib/idb.ts` — IndexedDB stores (queue, cache, receipts).
- `src/lib/pwa.ts` — `registerSW` wiring, update/offline events, display-mode helpers, storage estimate.
- `src/hooks/useDisplayMode.ts`, `src/hooks/useInstallPrompt.ts`.
- `src/pages/settings/*` — sectioned settings routes.
- `public/icons/*`, `public/screenshots/*`, iOS splash images.

**Modified**
- `public/manifest.json` — full spec (§7.1).
- `index.html` — viewport-fit, dynamic theme-color, iOS meta, apple-touch-icon, startup images.
- `vite.config.ts` — Workbox runtime caching for Supabase REST/Storage; `manualChunks`; denylist.
- `src/App.tsx` — `React.lazy` routes, nested settings routes, `/transactions/:id`, `/budgets/:id`, catch-all 404, wrap in `MonthCycleProvider` + `ToastProvider`; make `OrientationLock` opt-in or remove.
- `src/components/layout/Sidebar.tsx` — grouped nav, persisted collapse, simplified tooltips, remove theme toggle.
- `src/components/layout/BottomNav.tsx` — 5 real destinations, safe-area padding, `aria-current`.
- `src/components/layout/AppLayout.tsx` — mount `TopBar`, `CommandPalette`, `MobileNavSheet`; Add-Transaction success → toast, not forced navigate.
- `src/hooks/useNetworkStatus.ts` — async/IDB-backed counts; optional Background Sync.
- `src/hooks/useCreditCardNotifications.ts` — shared reminder fn, fixed icon paths, periodic-sync hook.
- `src/lib/offlineQueue.ts`, `src/lib/dataCache.ts` — back with `idb.ts` (keep public API).
- `src/contexts/ThemeContext.tsx` — sync `<meta name="theme-color">` on theme/accent change.
- `src/pages/{Budgets,Reports,Categories,Transactions,AccountTransactions}.tsx` — split overview/detail, lazy deps, virtualization, top-bar back.
- `src/pages/SettingsPage.tsx` — becomes a section shell.

**Decommission**
- Hand-rolled "More" menu markup in `AppLayout.tsx`.
- Duplicate theme toggles (keep top-bar + Settings).
- `ThirteenthMonthPage` — route it or delete it.

---

## 12. Implementation Roadmap

### Phase 0 — Foundations (no visible change)
- `idb.ts`; migrate `offlineQueue` + `dataCache` behind it.
- `pwa.ts` + update/offline toast wiring.
- Route-level code splitting + `manualChunks`; lazy Reports deps. Establish bundle budget in CI.

### Phase 1 — PWA correctness (installability)
- Full manifest, complete icon set, iOS meta + `apple-touch-icon`, dynamic theme-color, `viewport-fit=cover`, safe-area padding.
- Workbox runtime caching for Supabase REST/Storage.
- Fix broken notification icons; local reminders reliable; Notifications settings section.
- Lighthouse PWA passes clean.

### Phase 2 — Navigation model
- `TopBar` (breadcrumb/back/search/sync), display-mode awareness.
- Sidebar regroup + persisted collapse.
- BottomNav → 5 destinations; `MobileNavSheet` (real `Sheet`).
- `MonthCycleContext`; wire Dashboard + Transactions + Budgets + Reports.
- Command palette (routes + actions + account/budget lists).

### Phase 3 — UX depth
- Toast system; Add-Transaction success flow; transaction/budget detail routes + sheets.
- Sectioned Settings (nested routes, two-pane desktop).
- Cross-month transaction search in the palette.
- Virtualized transaction list; split Budgets/Reports/Categories.
- First-run onboarding; per-cycle alert dismissal; route exit transitions + scroll restoration.
- Accessibility pass (labels, focus traps, non-color cues, contrast).

### Phase 4 — Optional
- Background Sync / Periodic Background Sync for queue drain + reminders.
- `share_target` (receipt photo → new transaction) + `file_handlers` (CSV → import).
- Real Web Push (VAPID + `push_subscriptions` + Edge Function).
- `window-controls-overlay` desktop treatment.

---

## 13. Risks & Open Questions

- **iOS limitations:** no `beforeinstallprompt`, no Background Sync, flaky Periodic Sync, no real push without APNs-backed Web Push (Safari 16.4+ supports Web Push for *installed* PWAs — worth testing). Set expectations: iOS gets install *guidance* + foreground reminders in Phase 1–3; push is best-effort in Phase 4.
- **Silent-update → prompt-update** changes perceived behavior; confirm we want an explicit reload step (recommended for a data-entry app).
- **`localStorage` → IndexedDB migration:** must be lossless for a pending offline queue. Keep a one-release fallback that still reads the old `localStorage` queue on drain.
- **Promoting Budgets/Reports to the bottom nav** = 5 items + FAB on a 375px screen. Prototype the spacing; if tight, consider a 4-item bar (Home, Transactions, Accounts, Budgets) with Reports in the palette + Home shortcut. Decision needed.
- **`OrientationLock` removal:** anyone relying on forced portrait? Default to removing; add a preference if requested.
- **ThirteenthMonthPage:** keep as a Reports section or delete? Product call.
- **Real push scope:** does Ledger want to run any always-on server component (Edge Function + cron)? If strictly static-host + Supabase, push is limited to what Supabase scheduled functions can do.
- **Analytics:** is there any? `?source=pwa` and display-mode tagging are only useful if something records them.

---

## 14. Appendix — quick reference of concrete defects to fix

1. `public/icons/` missing → `useCreditCardNotifications` notification icon/badge 404.
2. `manifest.json` `theme_color`/`background_color` are light while app defaults dark → launch flash.
3. Manifest maskable icon is a non-padded black logo → clipped/invisible on Android mask.
4. No `apple-touch-icon` / iOS meta → wrong home-screen icon, white status bar.
5. Single 2.27 MB JS chunk → slow first load, weak on cellular.
6. `BottomNav` "More" is a `NavLink` to `/settings` that actually opens a menu — pick one behavior.
7. Hand-rolled mobile menu instead of the `Sheet` primitive → no focus trap, a11y gap.
8. `/accounts/:id` has no back/breadcrumb → dead end in standalone mode.
9. Theme toggle in 3 places.
10. `cmdk` + `ui/command.tsx` shipped but unused — no command palette / global search.
11. Sidebar collapse not persisted.
12. Month selection not shared between Dashboard and Transactions.
13. Add-Transaction always force-navigates to `/transactions`.
14. Offline queue + cache in `localStorage` (fragile) — move to IndexedDB.
15. `autoUpdate` SW with no "new version" UI — silent reloads can drop form input.
16. No `viewport-fit=cover` / safe-area handling → FAB collides with iOS home indicator when installed.
17. `OrientationLock` forces portrait for tablet/desktop installs.
18. Settings is one 610-line scroll with no sections or deep links.
19. No toast system beyond `UndoToast`.
20. `ThirteenthMonthPage` unrouted.
