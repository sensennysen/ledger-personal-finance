# Retro — generating docs/dev-tasks CSVs from a pre-written design handoff

**Context:** `/epav create task documents for the epics on design_handoff_ledger_ui_audit/`
produced `docs/dev-tasks/ledger-ui-redesign/epic-{0..7}-*-tasks.csv` (65 LED tickets +
1 no-op note across 8 files) from `design_handoff_ledger_ui_audit/specs/tickets.md`.

## Non-obvious constraint discovered

`/dev-tasks-planner`'s two mandatory prerequisites (ARCH doc under
`docs/arch-docs/<module>/`, and a scaffolded module) don't apply cleanly when the
source is a **pre-written, fully-specified design handoff** rather than a
from-scratch module plan:

- The "ARCH doc" role is already filled by `specs/tickets.md` +
  `specs/ui-audit-spec.md` — both contain file-level evidence, acceptance criteria
  and sizes per ticket already, so there was nothing left to "reconcile against
  real repo state" the way `/dev-tasks-planner` does for a module being built from
  an abstract spec.
- STATUS was uniformly `To Do` for all 65 rows because the redesign target is a
  different branch (`redesign-v1`) than the one being worked in (`main`) — the
  "verify real repo state component-by-component" step still applies, but the
  answer collapses to one value instead of a per-component judgment call.

**When this applies again:** any future `/epav`/`/dev-tasks-planner`-style request
against a `design_handoff_*` or similarly pre-specified handoff directory — check
whether the module already has an equivalent-to-ARCH-doc source before insisting on
`docs/arch-docs/<module>/` existing.

## Schema deviations from `/dev-tasks-planner`'s baseline (intentional, not errors)

- `TASK_ID` used the ticket's own id (`LED-01`, `LED-21a`, `LED-100`) instead of a
  fresh `TASK-XXX` sequence, to stay 1:1 addressable against `specs/tickets.md` and
  `AGENTS.md` (both already reference ids like `LED-30` throughout their prose).
  `DEPENDENCIES` cites those same ids directly instead of `TASK-XXX`.
- One row (`LED-66`, "Not affected — no ticket") isn't actionable work — it exists
  in the source only to document a screen that needs no change at the current
  density ceilings. Gave it `ISSUE_TYPE=Note` and `STATUS=N/A` rather than forcing
  it into `Done`/`To Do`/`Blocked`/`In Progress`, and flagged the deviation
  explicitly in the APPLY report rather than silently picking one.

See also [[dev-tasks-planner-schema]] (not yet written — worth a dedicated pattern
file if a second CSV-generation task confirms these deviations recur).
