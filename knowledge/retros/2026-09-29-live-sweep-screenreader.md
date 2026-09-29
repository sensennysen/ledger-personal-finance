# Live sweep · screen reader: notification surface, palette, sheets (LED-179) — retro (2026-09-29)

**Status: not yet run.** This retro is a skeleton for the phase 6 screen-reader pass. It needs
VoiceOver (macOS or iOS) or NVDA, which no tool available to this session can drive — there is no
screen-reader automation in this environment, so every item below is genuinely unheard, not
just unchecked.

## Method

Follow `knowledge/patterns/live-sweep-method.md`: a seeded throwaway user against a local
Supabase, never the linked remote or the real account. For each item, run it with the screen
reader on and record exactly what was announced (quoted), not an impression. A FAIL becomes its
own LED ticket in the next open epic CSV.

## Items to check

| Item | From | Result | Ticket | What was announced |
|---|---|---|---|---|
| Live regions: polite and assertive announcements | LED-148 | — | — | — |
| The cmdk palette's "N more" path | LED-148 | — | — | — |
| The notification surface | LED-93 | — | — | — |
| The queue review sheet | LED-91 | — | — | — |
| Entry detail focus | LED-91 | — | — | — |
| The tab group and skip link | LED-90 | — | — | — |

## The AlertDialog default-focus question (LED-91, LED-181 item 7, OD-8)

`AlertDialog` currently opens with focus on Cancel (base-ui's default, the WAI alertdialog
pattern) rather than the heading. The 2026-09-26 sweep left this an open design question because
it hadn't been checked with an actual screen reader. This pass should get a real answer from
someone who uses one daily: does Cancel-first read naturally, or should focus land on the heading
first? Record the answer here and in `epic-14-build-order.md`'s OD-8 register.

## Backlog

- Nothing run yet. Fill this retro after running the pass with VoiceOver or NVDA, then open a LED
  ticket for every FAIL and answer the AlertDialog question above.
