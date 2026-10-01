# LED-148 · Accessibility leftovers — retro (2026-09-26)

## What shipped (`fb0044a`)
- **Tab focus ring.** The desktop tab links and the phone tab strip (`TopBar`) and the `BottomNav` links get `focus-visible:ring-3 ring-ring`. The avatar and settings links already had one.
- **Logo stop.** The logo link is `tabIndex -1` (Home is the next stop; the tab group is the way in) and got `aria-label="Ledger home"`, because below `lg` it had no text and no name.
- **Home detail pane.** `DetailContent` no longer autofocuses its close button. `DetailTitle` is a `tabIndex -1` heading held in `PaneContext`; on open it takes focus and on close focus returns to the card that opened it. Same treatment as the Entry detail pane in `AppLayout`.
- **AlertDialog.** No code change. base-ui's default (first tabbable, Cancel) follows the WAI alertdialog pattern. Recorded, not confirmed with design.
- **Live regions.** `NotificationAnnouncer` keeps two regions mounted for the page's life: polite `role="status"` and assertive `role="alert"`, both `sr-only`. The text goes in 50 ms after the notification exists, and a failure or partial failure uses the assertive one. The visible toast lost its `role`, so nothing is read twice; Undo and Dismiss stay reachable. `announcementFor` (title, then body) is in `lib/notifications.ts`.
- **Treemap.** A caption under it says Ranked lists every category, and the `role="img"` label says it too.
- **cmdk heading link.** No change. "N more" and Cmd+Enter stay the accessible paths.

## Acceptance
- (a) Tab links show a ring-3 focus ring in both themes: PASS live. Keyboard focus gave `0 0 0 3px` in `--ring` (dark `rgb(168 180 222)`, light `rgb(85 101 154)`).
- (b) The logo stop decision is recorded and implemented: PASS live (`tabIndex -1`; the first six Tab stops were Skip link, Home tab, Search, theme, Settings, account menu).
- (c) The Home detail pane focuses its heading and returns focus on close: PASS live at 1280 (net worth card: heading `H2` inside `#dashboard-detail-pane`; Escape returned focus to "View net worth details").
- (d) The AlertDialog focus decision is recorded: PASS (above).
- (e) A persistent live region announces success, failure and partial notifications, checked with VoiceOver or NVDA: PARTIAL. Success is PASS by DOM: deleting a row put `"Row 0" deleted` in the polite region and the toast had no role. The failure and partial paths use the same code and were not triggered. No screen reader was run.
- (f) The treemap states its accessible equivalent: PASS (caption and label).
- (g) Lint, build, test: PASS (666).

## Backlog
- Run VoiceOver or NVDA over the polite and assertive regions and the cmdk "N more" path. Nothing here could.
- Trigger a failure notification live and confirm it lands in the assertive region.
- The `NotificationAnnouncer` clears itself only when the notification changes; a failure that stays up keeps its text in the region. Readers announce on change, so this is fine, but it was not tested with a reader.
- The AlertDialog default still needs a design answer.
