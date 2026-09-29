# Live sweep · real device: iPhone Safari and installed PWA (LED-178) — retro (2026-09-29)

**Status: not yet run.** This retro is a skeleton for the phase 6 real-device pass. Every item
below needs an iPhone (Safari and the installed PWA / Add to Home Screen), which no tool
available to this session can drive — `claude-in-chrome` only automates desktop Chrome, and
none of the six items are checkable there (that's why they're on this list: LED-124–127's
headless sweeps already marked them "not checkable" for exactly this reason).

## Method

Follow `knowledge/patterns/live-sweep-method.md` and `knowledge/patterns/browser-check-with-local-user.md`:
a seeded throwaway user, created and deleted through the admin API, against a local Supabase over
the LAN (or a preview deployment with a test user) — never the linked remote or the real account
(`73576618+sensennysen@users.noreply.github.com`). Record each item as PASS / FAIL / NC with evidence (a measured
value, a screenshot, a quoted string), never "looks fine". A FAIL becomes its own LED ticket in the
next open epic CSV.

## Items to check

| Item | From | Result | Ticket | Evidence |
|---|---|---|---|---|
| iOS decimal keypad on the add-transaction amount field | LED-103 | — | — | — |
| Pinned Save button on the add sheet stays reachable above the iOS keyboard | LED-103 | — | — | — |
| Safe-area insets on the shell (notch/home indicator) | LED-30 | — | — | — |
| Safe-area insets on the mobile search view and sheets | LED-42 | — | — | — |
| The iOS keyboard pushes sheets rather than covering their footer | LED-127 | — | — | — |
| Cmd+Enter and Cmd+F in desktop Safari | LED-64 | — | — | — |
| PWA install / Add to Home Screen, and the installed app's shell | LED-144 | — | — | — |

## Backlog

- Nothing run yet. Fill this retro after running the pass on a real iPhone (Safari and the
  installed PWA), then open a LED ticket for every FAIL and update this table with the result,
  the ticket id and the evidence, per `live-sweep-method.md`.
