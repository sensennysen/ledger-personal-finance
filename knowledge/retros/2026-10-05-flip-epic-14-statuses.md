# Epic 14 — flip CSV statuses for shipped tickets — retro (2026-10-05)

Branch `main`. Docs only. Epic 14's tickets shipped on 2026-09-27 to 09-29 but `epic-14-live-sweep-findings-tasks.csv` still said To Do. Same gate as LED-210 (LED-121): a fix commit on `main`, and a per-ticket retro with no FAIL.

## What was done
Set 17 tickets from To Do to Done. Only STATUS cells changed (checked by parsing the file before and after); CRLF kept.

| Ticket | Commit | Ticket | Commit | Ticket | Commit |
|---|---|---|---|---|---|
| LED-156 | `14814de` | LED-163 | `49f8c86` | LED-172 | `dda2f8d` |
| LED-158 | `2c8bf96` | LED-164 | `543447e` | LED-173 | `952749f` |
| LED-160 | `86115bd` | LED-165 | `3013036` | LED-174 | `6c63c5f` |
| LED-161 | `3e0bf0e` | LED-166 | `94f9502` | LED-175 | `be2183d` |
| LED-162 | `3d6efe9` | LED-167 | `4eb4a6e` | LED-176 | `eff465a` |
|  |  | LED-171 | `51b73fb` | LED-177 | `0e6d8e6` |

## Left open
- **LED-178** (real iPhone Safari and installed PWA) and **LED-179** (real screen reader). Their retros used proxies and say the ticket stays open until a real pass. The epic row stays To Do with them.

## Backlog
- Several of the flipped retros defer a live re-check (no browser that session): LED-161, 167, 174, 175, 176, 177. None reported a FAIL.
- LED-164's numeric criteria were measured with a session script, not the sweep driver; virtualisation is the fallback if a re-run misses them.
- LED-173 (c) asks for a product read: Accounts and Home count overdue installments differently (2 rows against 4).
- Epic 13's LED-142 and LED-145 stay To Do (LED-145 needs the phone-fold decision).
