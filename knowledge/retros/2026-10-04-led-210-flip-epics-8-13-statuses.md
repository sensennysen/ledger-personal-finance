# Epic 19 · LED-210 — flip CSV statuses for epics 8 to 13 — retro (2026-10-04)

Branch `epics-15-19`. One 2-point docs ticket in phase 6. The phase 10, 11 and 13 retros said the statuses were never flipped. No code.

## What was done
| Commit | Change |
|---|---|
| `3a0d63c` | Set 43 tickets and 5 epic rows in `epic-8` to `epic-13` from To Do to Done. Only STATUS cells changed. |

A scratchpad script made every flip, using the LED-121 gate:
- **A commit.** `git log HEAD -E --grep='LED-NN([^0-9]|$)'` finds a commit for the ticket. Anchoring the number stops LED-13 matching LED-130.
- **A retro with no FAIL.** The per-ticket retro, or the phase retro for LED-119 and 120 (phase 4) and LED-121 to 123 (phase 2). A FAIL result in the Acceptance section blocks the flip.
- **Epic rows.** An epic row is Done when every child is Done or Won't Do. LED-121 set this precedent.

The edits followed `knowledge/patterns/edit-ticket-csvs-without-noise.md`. The script read each file as bytes, kept CRLF, checked the round trip byte for byte before editing, and found exactly one match per edit.

### Evidence per ticket
| Ticket | Commit | Ticket | Commit | Ticket | Commit |
|---|---|---|---|---|---|
| LED-104 | `b572911` | LED-119 | `8a666e3` | LED-136 | `95e1a8a` |
| LED-105 | `f4ef8b1` | LED-120 | `dedc5e2` | LED-137 | `5945f5f` |
| LED-106 | `11539aa` | LED-121 | `07f8d62` | LED-138 | `2d85c56` |
| LED-107 | `9852ed8` | LED-122 | `9669e7d` | LED-139 | `6653e9d` |
| LED-108 | `c60f15b` | LED-123 | `f3e735e` | LED-140 | `9451ab5` |
| LED-109 | `e187e91` | LED-128 | `c1ba1fd` | LED-141 | `4c6a0e8` |
| LED-110 | `ae1a38b` | LED-129 | `a8e5e11` | LED-143 | `7cc6fe4` |
| LED-111 | `0faa538` | LED-130 | `d3e4c15` | LED-144 | `90165a5` |
| LED-112 | `88f5c32` | LED-131 | `aea22b9` | LED-146 | `6d263e0` |
| LED-113 | `82c07e1` | LED-132 | `5069563` | LED-147 | `04cbc98` |
| LED-114 | `ac295a5` | LED-133 | `c5356e2` | LED-148 | `fb0044a` |
| LED-115 | `e7bf6a4` | LED-134 | `b14ea58` | LED-149 | `4709dd0` |
| LED-116 | `fcc70a6` | LED-135 | `a42e1a8` | LED-150 | `cea253d` |
| LED-117 | `017c339` | | | LED-151 | `883c96c` |
| LED-118 | `a125282` | | | LED-152 | `6a4381f` |

Each retro is the ticket's own `knowledge/retros/*-led-NN-*.md`, except LED-119 and 120, which use `2026-09-25-epics-8-13-phase-4-disabled-states.md`, and LED-121 to 123, which use `2026-09-25-epics-8-13-phase-2-docs-reconcile.md`.

Epic rows set to Done: EPIC-ADD-TRANSACTION, EPIC-SEMANTIC-COLOUR, EPIC-DISABLED-STATES, EPIC-DOCS-VERIFY, EPIC-DATA-FOLLOWUPS.

### Left as they were
| Row | Status | Why |
|---|---|---|
| LED-142 | To Do | No commit. The wording is not signed off. |
| LED-145 | To Do | Its retro has a FAIL: Acceptance (b), "first four widgets fully above the fold at 390x844", measured. It needs a call on LED-134 / OD-1. |
| LED-153 | Won't Do | The ticket says it stays. |
| EPIC-DESIGN-PARITY | To Do | LED-142 and LED-145 are still open. |

## Acceptance
| Criterion | Result |
|---|---|
| (a) Every ticket with a commit and a retro without a FAIL is Done | PASS. All 43 are Done. The script stops if any row other than the three expected ones fails the gate. |
| (b) Tickets with a FAIL or no commit are left as they are and listed here | PASS. LED-142 has no commit and LED-145 has a FAIL; both are listed above. |
| (c) `git diff --stat` shows only STATUS cells | PASS. 6 files, 48 lines in and 48 out. A row-by-row comparison with `HEAD` finds 48 changes, each only STATUS from To Do to Done. |
| (d) The round trip passes on every CSV | PASS. Every CSV under `docs/dev-tasks/` round-trips byte for byte, has no BOM, and keeps its `HEAD` line ending. The six edited files have 20 columns. |

## What went well
- **The script asserts the exceptions.** It stops unless LED-142 comes out "no commit", LED-145 "FAIL" and LED-153 "Won't Do". If a retro were misread, it would stop instead of quietly flipping or skipping a row.

## What to change
- **Four retros have no Acceptance section:** LED-114, 134, 136 and 138. For these the gate scanned the whole retro, and none records a FAIL result. Their Backlog items were not unchecked criteria, so they did not block a flip. A per-ticket retro should always carry an Acceptance section so the gate has one place to read.

## Backlog
- "Merged" here means reachable from `epics-15-19` HEAD, not from `main`. Nothing is on `main` until LED-212.
- Some evidence commits name several tickets. For example, `6c8a80d` cites LED-116, 139 and 152. The table lists each ticket's own commit, and every flipped ticket has one.
- LED-145 needs a decision on what "first four widgets above the fold" means on a phone before it can be Done.
- I did not re-run the live behaviour of the flipped tickets. The flips rest on their retros, as the LED-121 rule says.
