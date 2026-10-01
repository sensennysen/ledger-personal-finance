# AGENTS.md — Ledger UI & navigation redesign (`redesign-v1`)

Entry point for any coding agent picking up this work. Humans: read `README.md` first; it is the orientation. This file is the operating procedure.

## 1. What this bundle is

A high-fidelity design + audit handoff for `sensennysen/ledger-personal-finance`, branch `redesign-v1`.
Target stack: React 19 · TypeScript · Vite · Tailwind 4 · shadcn/ui · Supabase.

| File | Role |
|---|---|
| `specs/tickets.md` | **The work.** Epics 0–7, ~65 tickets with size, dependencies, acceptance criteria, feature-impact label. |
| `specs/ui-audit-spec.md` | Full audit — every finding with file path and line number. |
| `specs/add-transaction-spec.md` | Add-transaction, loan picker, card-payment kind. |
| `specs/github.md` | Repo, branch, screen → source-file map. |
| `README.md` | Orientation, fidelity notes, token mapping table. |
| `designs/*.dc.html` | Visual reference. Canvas documents — open in a browser, pan/zoom. `support.js` must sit beside them. |
| `screenshots/` | Flat PNGs of the highest-traffic sections, for agents that can't render the canvas files. |

## 2. Read order — do not skip

1. `specs/tickets.md` → the **feature impact register** (what is ADDed, MODified, LIMITed, REMOVEd) and the **Decisions** table. All five product decisions are resolved; nothing is blocked.
2. The ticket you are assigned. Every ticket names its files, its section id (e.g. `[9a]`), its spec section, and its dependencies.
3. The named section in `designs/Ledger - 2B Screens.dc.html` (section ids are stable: `4a`, `6a`, `9a` … `30a`; `3a`/`3b` live in `designs/Ledger - 2B Activity.dc.html`). Each section carries its own "What changed, and why" list beside the frames.
4. The spec section the ticket cites, for the file-level reasoning.

## 3. Hard rules

- **Do not port the mockup markup.** The designs are inline-styled single files with no build step — a constraint of the design tool. Recreate the design in the codebase using `src/components/ui/*`, the tokens in `src/index.css`, the constants in `src/constants/colors.ts`, and the existing hooks in `src/hooks/`.
- **Use the token, not the hex.** The mockups resolve tokens to hex. The mapping table is in `README.md` → *Design tokens*. `#55659A` → `var(--primary)`, `#B4574A` → `EXPENSE`, and so on.
- **Desktop frame is canonical.** If a 768 or 390 frame appears to show a different field set than the 1920 frame, the desktop frame is right — flag it, don't implement the difference.
- **Never use `opacity` for a disabled state.** Fails contrast and reads as broken. Solid muted colour + an affordance (lock glyph). See README → *Known issues in the mockups themselves*.
- **Respect the LIMITs.** Several tickets deliberately constrain behaviour (deficit clamped at zero, list windowing, rate maximums, duplicates default to skip). These are decisions, not oversights — do not "improve" them into being unlimited.
- **Don't widen scope.** LED-21a carries an explicit scope boundary; if a ticket says a control must not drive the rest of the page, that is an acceptance criterion.
- **Light and dark both.** One token set renders either theme. Dark pairing is spec §6 / LED-100. The one non-obvious case: on-primary in dark is **dark ink `#1B2135`**, not white.

## 4. Sequencing

Follow `specs/tickets.md` → *Suggested build order*. The two hard gates:

- **LED-30 (two-row top bar) blocks all of Epic 6** and LED-21, LED-33, LED-40. It is XL — split it (shell / row 1 / row 2 + stepper ownership / responsive collapse) before starting.
- **LED-20 (`budget_deficit_behaviour`) blocks** LED-01, LED-23, LED-87.

Parallel-safe on day one, no design dependency: all of **Epic 0** (LED-01 … LED-12), plus LED-50 and LED-51.

Do **LED-60/61 with** the Activity rebuild (LED-99), not after — retrofitting virtualisation into a finished list costs more.

## 5. Definition of done, per ticket

- [ ] Every bullet in the ticket's **Accept** line is demonstrably true.
- [ ] Built at all three viewports the section draws: 1920×1080, 768×1024, 390×844.
- [ ] Renders correctly in light **and** dark.
- [ ] Error, empty and filtered-empty are three distinct states (LED-12 + LED-51), not one.
- [ ] Keyboard: reachable, operable (Enter/Space), `aria-current` on active nav, visible focus ring (`ring-3`), `role="alert"` on inline errors.
- [ ] Uses tokens/constants — no raw hex, no raw Tailwind palette (`amber-500`, `emerald-500`, `yellow-500` are all audit findings).
- [ ] `prefers-reduced-motion` honoured for anything you animate.
- [ ] No new duplicate of a pattern the audit is deleting (second schema, second control tree, hand-rolled skeleton, hand-rolled empty state, `text-sm text-destructive px-1 -mt-2`).

## 6. Reporting back

When you finish a ticket, state: ticket id · files touched · which Accept bullets you verified and how · anything in the design you could not implement as drawn, and why. If a design and the spec disagree, **stop and ask** — do not pick one silently.

## 7. Screenshots

Flat references in `screenshots/` (canvas sections, light theme):

| File | Section |
|---|---|
| `3a-activity-nav-shell.png` | 3a — Activity, the 2B nav-shell reference implementation |
| `18a-home.png` | 18a — Home, three-column widget grid |
| `9a-reports.png` | 9a — Reports |
| `16a-global-search.png` | 16a — Global search palette (new) |
| `29a-dense-states.png` | 29a — the five surfaces at real volume |
| `../screenshots/dark-check.png` | dark-theme render check |

These are orientation aids captured at preview width. **The `.dc.html` files are the authority** — exact dimensions, states and the per-section rationale only exist there.
