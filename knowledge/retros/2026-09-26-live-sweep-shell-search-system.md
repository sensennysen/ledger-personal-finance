# Live sweep · shell, navigation, search and system states (LED-124) — retro (2026-09-26)

Tree tested: branch `epics-8-13-phase-12` at `4ab1888` (the tip of phase 11). Lint, build and all 666 tests passed on that tree before the sweep (`pnpm lint`, `pnpm build`, `pnpm test`), and no source file was edited during it.

## Method
Followed `knowledge/patterns/browser-check-with-local-user.md`. Local Supabase only (`127.0.0.1:54321/54322`); the Vite dev server on 5173; a throwaway user `sweep-a@example.test` created through the admin API and seeded over `psql` (7 accounts incl. a PHP one, 2 loan accounts with 4 purchases, a credit card, about 97 transactions over 3 months, 5 budgets, 2 goals). Fresh users `sweep-fresh` and `sweep-empty` covered first run and the no-records states. Headless Chrome over CDP at 1920x1080, 1024x768, 768x1024, 1280x900 and 390x844 (touch emulation). Light was the default; dark was viewed for the shell rows, the tab-link focus ring and the mobile row 1 only. The palette, dialogs, queue sheet and system states were viewed in light. Requests were held or blocked with `Fetch` and `Network.setBlockedURLs`; offline was `Network.emulateNetworkConditions`. The linked remote, the real account (`73576618+sensennysen@users.noreply.github.com`) and the two older validation users in the local database were not touched. The sweep users were deleted when the phase finished. Screenshots and the driver scripts stay in the session scratchpad and are not committed; the measured values are in the tables below.

Checked at 1920, 1024, 768 and 390 for layout items. A few checks (Tab order, palette, dialogs) ran at 1280 only, where the layout is the same as 1920.

## Results
**40 PASS · 10 FAIL · 5 not checkable** (1 notes)

### FAIL (each has a new ticket in `epic-14-live-sweep-findings-tasks.csv`)

| Ticket | Item (from) | Evidence |
|---|---|---|
| LED-154 | Row 1 at 1024: theme toggle, Settings and avatar are clipped off-screen (LED-30) | At 1024x768 (lg) the header's scrollWidth is 1168 in a 1024 box (144px over). Theme toggle starts at x=1044, Settings and the avatar are further right, so all three are off-screen; the header has overflow visible but the page clips (docW=1024). The search field is already shrunk to 140px. Also at 1100 (avatar ends at 1138). Fine at 1280/1920 and at 900/768, where tabs are icon-only. shots/124-shell-home-1024-{light,dark}.png, probe-1024.png |
| LED-155 | Mobile Tab order from the body (390): first Tab skips the skip link, header tools and tab strip (LED-30) | Fresh load at 390: Tab -> 'Previous cycle' (y=108) -> Dismiss warning... With Element.prototype.scrollIntoView stubbed out via Page.addScriptToEvaluateOnNewDocument the order becomes Skip to content -> Customize dashboard -> Search -> theme, so the tab strip's scrollIntoView on load moves Chrome's sequential-focus starting point past the header. DOM order itself is correct (focusing the skip link and pressing Tab walks it). Desktop is unaffected because the strip is display:none there. |
| LED-156 | Loan repayment count disagrees between the palette and the kind menu (LED-41) | Palette Record row reads '4 loans, $8,050.00 owed'; the Add Transaction menu reads 'Loan repayment · 2 loans · $8,050' for the same data (2 loan accounts, 4 purchases). Before the Sofa purchase it was '3 loans, $6,850.00' vs 2 loans. The palette counts purchases and the menu counts accounts; the owed amounts agree. |
| LED-157 | Focus indicator is the browser default outline, not ring-3, on Home's recent-transaction rows, the header Search button, the Settings link and 'Dismiss warning' (LED-56) | Tabbed with a fresh load at 1280: those elements report outline 'auto 1px' (accent at 50% alpha) and no box-shadow; their class lists have no focus-visible: classes. DashboardTransactionRow passes InteractiveRow a className without a ring, and InteractiveRow adds none. The other tab stops (tab links, theme toggle, Add Transaction, cards, chips) use ring-3. shots 124-ring-search.png vs 124-ring-add.png. Needs a decision on whether the UA outline is acceptable; the ticket said one ring everywhere. |
| LED-158 | First-run checklist step 2 is crushed at 390 (LED-52) | At 390 the 'Record something, or import a statement' row puts the text and both buttons (Import, Add entry) on one line: the title wraps one word per line and the description wraps at ~7 characters in a ~75px column, so the row is about 330px tall (vs ~80px on step 1); the FAB then overlaps the buttons. shots/124-firstrun-390-0of3.png. Fine at 1280. |
| LED-159 | Queue review sheet at 390 is broken (LED-128) | Opened directly at 390 the sheet is 293px wide at x=98 (default w-3/4), the item cards keep their button column so the text wraps one word per line ('t…', 'Amoun', 'yours' on separate lines), and the footer 'Sync now' button runs to x=422, 32px past the viewport, so it is clipped. Fine at 1280. shots/124-review-sheet-390-direct.png |
| LED-160 | Queue review sheet titles items by table name (LED-128) | Edited items with no description show 'transactions' (and 't…' at 390) as the title instead of what changed; already in the LED-128 backlog, still unfixed |
| LED-161 | Console error: <div> inside <p> on Home while loading (LED-94) | Reload of Home logs 'In HTML, %s cannot be a descendant of <%s>. This will cause a hydration error': <p><SkeletonText><Skeleton><div> in DashboardCashFlowForecastCard's loading state (the p at text-[0.9375rem]) |
| LED-162 | Sign-out failure message is false: the client removes the session anyway (LED-11) | With /auth/v1/logout blocked, clicking Sign out: within 100 ms sb-127-auth-token is removed and the app is on /login, showing 'Sign-out failed. You're still signed in on this device.' AuthContext.signOut assumes a failed signOut() leaves the session (comment: 'A failed sign-out leaves the user signed in'); @supabase/supabase-js 2.116.0 clears the local session regardless, so the user is signed out locally with a server session still valid, and the copy is wrong. shots/124-auth-signout-blocked.png. Local cache and queue are left in place (the clear step is skipped). |
| LED-163 | The 'Not synced yet' marker is indigo (text-primary), not gold (LED-53) | TransactionRow.tsx:140 and DashboardRecentTransactionsCard.tsx:86 use text-primary. LED-53 chose gold for pending and LED-100 made --primary indigo; LED-116 repointed eight pending sites but not these two. The banner's pending state is --warning. |

### PASS

| Item (from) | Evidence |
|---|---|
| Row 1 and row 2 at 1920, 768 and 390; no horizontal page overflow at any of the four widths, light and dark (LED-30) | docW==clientW at 1920/1024/768/390 in both themes; row 1 h=64 (row 2 h~56) at >=768, single 108px header on mobile |
| Keyboard focus order at 1280 from a fresh load (LED-30) | Skip to content -> tab group (single stop: Home) -> Search -> theme -> Settings -> account menu -> Previous cycle -> Add Transaction -> Customize dashboard -> page. Logo is out of the tab order (LED-148 decision). |
| Tab strip: active tab scrolled into view at 390 on /reports, /categories, /budgets, /accounts (LED-30) | active tab right edge <= 390 on all four (Reports x=296-374, Categories 197-292, Budgets 154-235, Accounts 87-174) |
| /categories reachable from the mobile tab strip at 390 (LED-31) | click 'Categories' in the strip -> /categories |
| Dashboard widget-settings trigger portals into #mobile-dashboard-tools at 390 (LED-30) | trigger is inside the host, host at x=202,y=12 40x40, sits in row 1 |
| Row 1 crowding at 390 on Home (title, tools, search, toggle, avatar) (LED-30) | no overlap; title 16-142, tools 202-374; header 108px; shots 124-mobile-row1-{light,dark}.png. Status pill only appears offline: re-checked in the system-states run. |
| Tab links show a visible focus ring; arrow keys, Home and End move within the row; Tab leaves it (LED-90) | 1280 light: 3px ring around the focused Home tab (shots/124-focus-ring-tab-link-{light,dark}.png); Right -> Accounts -> Activity, End -> Reports, Home -> Home, Tab -> Search |
| Shell interactive before data loads (LED-95) | 24 REST reads held with Fetch.requestPaused: tabs, search and Add Transaction rendered; clicking Accounts navigated in 718 ms; Cmd+K opened the palette; shots/124-shell-before-data*.png |
| Cmd/Ctrl+K toggles the palette, including with focus in a field (LED-40) | Cmd+K open/close; Ctrl+K opens; with focus in Activity's search field Cmd+K opens the palette and neither field nor palette receives a 'k' |
| Palette dialog width and position at 1920, 1024, 768 (LED-40) | 576px wide at all three, centred (x=672, 224, 96); h=461 with 4 Record + 7 Jump rows; shots 124-search-empty-*.png |
| Group layout at 3 rows, with true counts (light theme) (LED-64) | 'Groceries' -> Transactions · 4 shows 3 rows + '1 more transactions'; Categories · 1; Actions · 2; chips All 7 / Transactions 4 / Categories 1 / Actions 2; <mark> highlight legible in light (LED-137 backlog: light theme not viewed). shots 124-search-groceries-1280.png |
| Mobile search: header icon opens the full-screen view; no key hints; same groups (LED-42) | 390: dialog 0,0,390x844, keyHints false, groups Record/Due soon/Jump to; typed results match desktop; shots 124-search-mobile-*.png |
| Mobile back gesture closes the full-screen view and stays on the page (LED-42) | history.back() with the view open -> palette closed, path still /; history length unchanged (4) |
| Mobile close and clear controls (LED-42) | Close search closes; Clear search present after typing |
| Phone can scope search to an account: 'Only search <account>' toggle (LED-137) | On /accounts/:id at 390 with 'Food': 5 matches -> toggle -> 3 matches, chips 7 -> 5, hand-off changes 'See all in Activity' -> 'See all in BDO Checking'. Closes the LED-137 backlog item. |
| Focus returns to the header Search button after Esc; and after the add menu -> Esc -> search -> Esc (LED-91) | activeElement after Esc = the Search button in both flows |
| Cmd+K with no trigger: focus after close (LED-91) | With body focused, Cmd+K then Esc leaves focus on the header Search button, not on <body> |
| Cmd+K over another open dialog (LED-40) | New income dialog open, Cmd+K: palette opens on top (shots 124-search-over-dialog.png), Esc closes the palette first, second Esc closes the dialog, nothing left behind |
| E / I / T gating (LED-40) | Empty query: typing 'e' goes into the input (no action). After ArrowDown onto the Record group, 'i' opens the New income dialog |
| Due soon rows with real loans (LED-41) | Added a 12-month 'Sofa' purchase due Sep 30: Due soon [Sofa, Sep 30 · in 4 days, $100.00]. Rows for loans due later than 14 days are correctly absent. |
| Loan repayment from the palette opens the loan repayment form (LED-41) | 'Loan repayment' row -> dialog 'Record loan repayment' |
| Import CSV row opens the dialog (LED-41) | 'Import CSV' row -> /transactions with 'Import from CSV' dialog open (closes the LED-41 backlog item) |
| Hand-off to Activity, and again while Activity is already open (LED-64) | 'Shopping' -> See all in Activity -> /transactions, filter 'Shopping', '3 transactions match'; from Activity, Cmd+Enter with 'Utilities' -> filter 'Utilities', '3 transactions match'; ?q is consumed |
| Cmd+F scopes to the account on /accounts/:id; Cmd+Enter hands off to the account page when it is already open (LED-64) | 'Food': 5 -> 3 matches after Cmd+F; Cmd+Enter -> /accounts/:id filter 'Food', '4 transactions match' (whole history, label 'See all in <account>' carries no count by design) |
| Focus lands on the heading and returns to the trigger: kind menu -> New expense, Loan repayment, avatar -> Your account, Add Account, Entry detail pane, and the 390 FAB sheet (LED-91) | 1280/1920/390: on open activeElement = 'New expense' h2 / 'Record loan repayment' h2 / 'Your account' h2 / 'Add Account' h2 / 'Entry detail' h2 / 'New expense' h2 (390); on Esc: Add Transaction button / Add Transaction / Open account menu / Add Account / the row 'Groceries #0' / the FAB |
| AlertDialog default focus and restore (LED-91) | Budgets > Delete Fun: focus on Cancel (base-ui default, the WAI alertdialog pattern; LED-91 left this as a design question); Esc returns to the 'Delete Fun' button. Design has not answered the heading-vs-Cancel question. |
| prefers-reduced-motion: no animation or transition longer than 1 ms remains (Home, kind menu, Accounts, 390 sheet) (LED-56) | Emulation.setEmulatedMedia reduce -> 0 animations and 0 transitions over 1ms on all four; without the emulation Home has page-in 280ms, fade-up 420ms and 50 transitions of 100-150ms. Closes the LED-56 'not verified live' backlog item. |
| Ring-3 on the Budgets card, the template chip and the loan tracker rows (LED-54) | Budgets card and its Edit/Delete: focus-visible:ring-3, no UA outline; Quick add > 'Use Coffee template': ring-3 with the accent box-shadow; LoanPurchaseTracker row class carries focus-visible:ring-3 (class only; the row was not tabbed) |
| First run 0/3 -> 3/3 transition and lock lifting (LED-52) | Fresh user: 0 of 3 (3 steps, 6 lock glyphs: Activity/Budgets/Categories/Reports in the top bar and Activity/Budgets in the bottom nav); account added -> 1 of 3; transaction -> 2 of 3 (locks stay: lifts only when all three are done, as designed); Choose cycle -> /settings; Starts on day = 15th -> ledger-first-run.cycleConfirmed=true, checklist gone and 0 locks at 1280 and at 390. shots 124-firstrun-*.png |
| BottomNav lock glyph at 390 (never captured in LED-52) (LED-52) | Activity and Budgets show a Lock glyph, no opacity change (shots/124-firstrun-390-0of3.png); glyphs gone after step 3 |
| Forced offline: banner, three queued adds, queued marker (LED-53) | Network.emulateNetworkConditions offline: banner 'Offline — 0 entries will sync when you reconnect' (0 reads awkwardly with an empty queue), then 1/2/3 entries after three real form saves; queue in localStorage has 3 inserts; 'Not synced yet' marker shows on the Home recent list and on the Activity row and clears after reconnect. Offline banner uses the red expense container, not gold; LED-53's 'gold for pending' applies to the back-online pending state. shots 124-offline-*.png |
| Sync progress reads 'Syncing N of 3' and the drain writes every row once (LED-53) | POSTs held, then online: 'Syncing 0 of 3 changes…' -> 'Syncing 1 of 3 changes…' -> banner cleared, queue empty, 3 rows in the database (one each) |
| Queue review sheet: edited conflict, deleted conflict, expired item (LED-05) | Seeded queue (edited update, update to a missing row, 31-day-old insert). Sheet lists 'Edited on another device since you queued this · 2 days ago / Amount: yours 55 · theirs 5 / Notes: yours mine · theirs empty', 'Deleted on another device...' with Discard only, and the expired item 'Waited more than 30 days to sync' with Keep theirs / Keep mine. Keep mine wrote amount 55 and notes 'mine' to the row; Keep theirs left the row at 42.25; Discard removed the deleted item; Keep mine on the expired insert wrote the row (with a valid payload). |
| Expiry item flagged on load, not silently dropped (LED-05) | 31-day-old pending insert loads as status expired with the banner '1 change didn't sync and needs your review' |
| Forced read failure on Activity shows a retryable error, not an empty state (LED-12) | transactions read blocked with Network.setBlockedURLs (about 8-11 s to surface, as the pattern says): 'Couldn't load your transactions / Couldn't reach the server. Check your connection and try again.' with a 'Try again' button and 'Technical detail: TypeError: Failed to fetch' + Copy; no 'No transactions' empty state. shots 124-failed-read-activity.png |
| Profile read failure is surfaced with Retry (no cached profile) (LED-11) | Cleared ledger_cache:*, blocked rest/v1/profiles: 'Couldn't load your profile. Some details may be out of date. [Retry]' in the shell; after unblocking, Retry clears the banner. With a cached profile no banner shows, as coded. |
| Session check failure is surfaced on /login (LED-11) | Expired access token + /auth/v1/token blocked: the app shows 'LOADING' for about 25 s (supabase-js retries), then /login with 'Couldn't check your sign-in. Reload to try again.'; console: 'Failed to get session: Failed to fetch'. Note the 25 s wait with only a spinner. |
| 'Try again' recovers after the read failure clears (LED-12) | Blocked transactions read, error state shown, unblocked, 'Try again': rows render and the error is gone |
| FormError on three migrated sites: Add Account, New expense, Add Category (LED-55) | With the table's POST blocked each dialog shows a role=alert (a DIV) 'Couldn't reach the server. Check your connection and try again. Nothing was changed.' + Technical detail; text-destructive (rgb 143,63,51); the expense form's className override resolves to 'px-0 mt-0' with tailwind-merge (LED-55 backlog). shots 124-formerror-*.png |
| Filtered-empty and no-records states forced: Activity, Account detail, Reports, 13th Month (8 branches) (LED-51) | Activity: 'No transactions in Sep 1 – Sep 30' + 'Show all 31' for a search that excludes everything; 'Nothing recorded yet' + Import CSV + Add transaction for a user with no data. Account detail: no-records shows Import CSV / Add transaction; a search that excludes everything shows 'Show all 37'. Reports: 'Nothing recorded yet' for a user with no data; 'No transactions in Dec 1 – Dec 31' + 'Try previous period' nine cycles back. 13th Month: 'Nothing recorded yet' with no income; 'No income transactions found for 2025' + 'Try 2024'. shots 124-empty-*.png |

### Not checkable

| Item (from) | Reason |
|---|---|
| Cmd+Enter and Cmd+F in Safari (LED-64) | Only Chrome is available to drive; Safari not checkable |
| iOS keyboard and safe-area insets for mobile search (LED-42) | needs a real iPhone; none available |
| Failed queue item (5 database errors) live (LED-53) | Covered live by LED-128; not re-driven here (needs five failing drains). A hand-made insert with no user_id failed with a countable error and counted attempts up as expected (attempts 3 after three drains, banner 'still queued', not flagged). |
| Real iOS Safari/PWA: safe-area insets, keyboard, back gesture (LED-30) | no iPhone available |
| Queue review sheet with flagged items in Safari (LED-05) | Only Chrome can be driven |

### Notes (no verdict)

- Two headings on Home at md+ (row-2 'Home' and page 'Dashboard' h1); the LED-30 retro left this as a design question (LED-30) — shots 124-shell-home-1920-*

## Findings worth reading first
- **LED-154** is the serious one: at 1024 the theme toggle, Settings and the account menu are off-screen, so a laptop at 1024 wide cannot reach Settings or sign out from the top bar.
- **LED-162**: with the network down, Sign out ends on `/login` with the message "You're still signed in on this device", which is false. The installed supabase-js clears the session even when the logout request fails.
- **LED-159**: the queue review sheet is unusable at 390.
- **LED-155**: a keyboard user on a narrow screen skips the header on the first Tab because the tab strip scrolls itself into view.

## Backlog (deferred or not verified)
- The dark theme of the search palette, the queue review sheet, the first-run checklist and the offline banner was not viewed.
- Nothing was run on a real iPhone or in Safari: the iOS keyboard and safe-area insets for the shell and mobile search, Cmd+Enter / Cmd+F in Safari, and PWA install.
- No screen reader was run (VoiceOver, NVDA); the LED-148 live-region and cmdk "N more" paths stay unverified.
- A failed queue item (five database errors) was not re-driven live; LED-128 covered it.
- The design answers still open: AlertDialog default focus (Cancel, per base-ui) and the two headings on Home at md+ ("Home" in row 2, "Dashboard" below).
- The offline banner reads "Offline — 0 entries will sync when you reconnect" when nothing is queued. Not a defect, but the copy could be shorter.
- The result bar reads "34 match" on Activity; worth a copy check against the design (LED-61).
- `.claude/launch.json` is still untracked.
