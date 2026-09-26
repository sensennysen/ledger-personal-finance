# Safari desktop check (by hand)

For the items the Chrome sweeps could not check (LED-64, LED-05/128, LED-124 to LED-127 "not checkable"), when `safaridriver` cannot be driven from the agent. About 15 minutes. Report PASS, FAIL or what you saw for each row; a FAIL becomes a ticket in epic 14.

## Setup (once)
1. `pnpm dev:all` running; open `http://localhost:5173` in Safari.
2. Safari > Settings > Advanced: tick **Press Tab to highlight each item on a webpage** (without it Safari's Tab skips links and buttons, and rows 6 and 7 mean nothing).
3. Sign in with a local test user (Google sign-in is not used). In Terminal, from the repo:
   ```
   eval "$(supabase status -o env)"
   curl -s -X POST "$API_URL/auth/v1/admin/users" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'content-type: application/json' -d '{"email":"sweep-safari@example.test","password":"sweep-Passw0rd!","email_confirm":true}'
   curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H 'content-type: application/json' -d '{"email":"sweep-safari@example.test","password":"sweep-Passw0rd!"}'
   ```
   Copy the second command's whole JSON output. In Safari (Develop > Show JavaScript Console) on `/login`: `localStorage.setItem('sb-127-auth-token', '<paste the JSON>')`, then reload.
4. In the app: add one account, then three expenses (any amounts) so Activity and search have rows.
5. When done: delete the user (`sweep-safari@example.test`) through the admin API, and never use the real account.

## Checks
| # | Where | Do | Expect | Result |
|---|---|---|---|---|
| 1 | Any page | Cmd+K, then Cmd+K again | The search palette opens and closes; Safari does not react | |
| 2 | Palette | Type a description you added, press Cmd+Enter | Lands on Activity filtered to that text with a matching count | |
| 3 | An account's page (`/accounts/<id>`) | Cmd+K, type text, press Cmd+F | The palette narrows to "Only in <account>" and Safari's find bar does **not** open | |
| 4 | Home or Activity (not an account page) | Press Cmd+F | Safari's own find bar opens (the app must not claim it) | |
| 5 | Palette | Press Esc | Closes; focus returns to the header Search button | |
| 6 | Shell, 1280 wide | Press Tab from the top of the page | Order: Skip to content, tab group, Search, theme, Settings, account menu; each shows a visible ring | |
| 7 | Add Transaction, then Esc | Press Tab afterwards | Focus returns to the Add Transaction button | |
| 8 | Queue review sheet | In the console: `localStorage.setItem('ledger_offline_queue', JSON.stringify([{id:'q1',table:'transactions',operation:'insert',payload:{description:'Old entry',amount:5},userId:'<your user id>',timestamp:Date.now()-31*864e5}]))`, reload, click Review | Banner says 1 change needs review; the sheet lists "Old entry" with Keep theirs / Keep mine, nothing clipped. Do **not** press Sync now. Then `localStorage.removeItem('ledger_offline_queue')` | |
| 9 | Reports > Export > CSV | Save the file | Name ends with the range, e.g. `ledger-report_YYYY-MM-DD_to_YYYY-MM-DD.csv` | |
| 10 | Add Transaction | Open the date field | A date picker opens and the chosen date is kept after saving | |
| 11 | Reports > Analytics | Look at the Income vs. Expenses chart | Known FAIL in Chrome (LED-168); note whether Safari also shows it empty | |
| 12 | Settings | Switch Light, Dark, System | Every screen follows; no dark flash on reload for a light choice | |

## Report back
Paste the Result column (or "row N: what happened"), your Safari version and macOS version. The results go into `knowledge/retros/2026-MM-DD-live-sweep-devices.md` (LED-178) with a ticket for each FAIL.
