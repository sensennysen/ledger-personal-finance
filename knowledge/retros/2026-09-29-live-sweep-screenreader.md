# Live sweep · screen reader: notification surface, palette, sheets (LED-179) — retro (2026-09-29)

## Method note — this was not a real screen-reader pass

VoiceOver and NVDA are still not available to this session, so per the user's explicit call for
this ticket (phase 6 planning), every item below got a **static code check** instead of a live
run: reading the markup and the ref/focus-management code for the ARIA attributes and focus calls
a screen reader would react to. This is weaker than a live AX-tree read (no headless-Chrome CDP
session was used this pass) and much weaker than an actual announcement: it confirms the
attributes are *present and wired to the right element*, not what VoiceOver or NVDA actually say.
**LED-179 stays open** — this retro exists so the next real pass starts from code-level
confidence, not to close the ticket.

## Items checked

| Item | From | Method | Result | Ticket |
|---|---|---|---|---|
| Live regions: polite and assertive announcements | LED-148 | Read `src/components/ui/notification.tsx:97-98` | Static proxy — looks right: two `sr-only` regions, `role="status" aria-live="polite"` and `role="alert" aria-live="assertive"`, gated by an `assertive` flag so only one carries text at a time. | — |
| The cmdk palette's "N more" path | LED-148 | Read `src/components/search/SearchPalette.tsx:504-537` | Static proxy — uses `cmdk`'s `<CommandItem>`, so the option/listbox ARIA comes from the library. Cannot confirm the announced name reads naturally from source alone. | — |
| The notification surface | LED-93 | Same as live regions above | Static proxy — looks right (see above); duplicate of the LED-148 live-region check, same file. | — |
| The queue review sheet | LED-91 | Grepped `src/components/layout/QueueReviewSheet.tsx` for `useRef`, `.focus()`, ARIA role/label | **Not checked — no explicit handling found.** No signal either way in this file; presumably relies on the underlying Sheet/Dialog primitive's default focus. Flag as unverified. | — |
| Entry detail focus | LED-91 | Read `src/components/layout/AppLayout.tsx:159,162,340` | Static proxy — looks right: `detailHeading.current?.focus()` runs when the wide-layout detail pane opens, targeting an `<h2 tabIndex={-1}>`. | — |
| The tab group and skip link | LED-90 | Read `src/components/layout/AppLayout.tsx:261-269,312-313` | Static proxy — looks right: a real `<a href="#main">`, `sr-only` until focused, calls `mainRef.current?.focus()`; `<main ref={mainRef} tabIndex={-1}>` is the landing target. Matches LED-155's shipped fix (confirmed via `git log`: `5010ab5`/`49da1c7`, though the epic-14 CSV's STATUS column hadn't caught up until this session). | — |

## The AlertDialog default-focus question (LED-91, LED-181 item 7, OD-8)

Still unresolved, as expected — this needs "an answer from someone who used it" (the ticket's own
AC item c), which a static code check cannot provide. OD-8 item 7 in `epic-14-build-order.md`
already recorded the fallback (base-ui's default: focus opens on Cancel) as the shipped behavior;
this pass has nothing to add or change there.

## Backlog

- Run this ticket for real with VoiceOver (macOS is available; iOS needs a device, tying it to
  LED-178) or NVDA, confirming what's actually announced for each surface above, especially the
  cmdk "N more" rows and whether the two notification live regions ever double-fire.
- Check whether `QueueReviewSheet.tsx` needs the same explicit `.focus()` handling
  `AppLayout.tsx` gives the entry-detail heading, or whether its Sheet primitive already handles
  it — this pass could not tell from the file alone.
- AC item (c), the AlertDialog default-focus question, still needs a person who actually uses a
  screen reader.
