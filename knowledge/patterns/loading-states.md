# Loading states: skeleton, spinner or refreshing region

Pick by what the user is waiting for (LED-94, LED-95):

- **Content arriving on first load → `Skeleton`.** Keep the real layout: card, header, row grid, dividers, meter tracks, rank numbers and table headers stay real; only the text runs are grey. Size each run to the line it replaces (wrap in an `h-4`/`h-5` flex box matching the text's line height) so nothing moves when data lands.
- **An action the user triggered → spinner** (`Loader2` + `animate-spin`) on the control that started it, e.g. ImportCSVDialog's import, TransactionForm's upload, the offline banner's sync.
- **A refetch with data already on screen → `RefreshingRegion`**, never skeletons (see `keep-previous-data-with-its-key.md`).
- The shell (nav, stepper, page title, row-2 actions) never loads.

Rules:
- Never hand-roll `bg-muted animate-pulse`; use `Skeleton`.
- `Skeleton`'s default `rounded-md` is for text runs. Blocks (chart areas, icon tiles, dots) pass their own radius.
- One loading table renders the real `<thead>` it will have when loaded (share it as a variable).
- **Size a text-run skeleton with `SkeletonText`, inside a parent that has the real font size** (LED-150). It is an inline-block `0.75em` tall, so the line keeps its real height and nothing moves when the text arrives. A flat `h-9` block in place of a `1.75rem` line shifts the page by the difference. Keep icon tiles, tab strips, column headers and labels real; only the values grey out.
- **Show the loaded twin's parts that do not depend on data**, e.g. the summary band's labels, a section heading, a legend. If a part appears only for some data (a sub-line, a recurring-items list), reserve it only when its presence is known; otherwise say so in the retro.
- **The auth bootstrap keeps its spinner** (`App.tsx`). It is a session check, not content arriving: the destination is either `/login` or the app, so a shell-shaped skeleton would flash the wrong one. This is the recorded exception to "content arriving gets a skeleton".
- **`Skeleton` is static under `prefers-reduced-motion`** (`motion-reduce:animate-none`).
- **A bare `SkeletonText` is 9px tall inside a flex or grid container.** A flex item has no line box, so the `0.75em` run does not carry its text line; an `li` or a footer row came out 7 to 11px short (LED-200, loan tracker and Categories rules). Put it in a `span` inside the flex item (`<span><SkeletonText /></span>`) so the line keeps its height.
- **Know what the loaded twin always renders.** A wrapper that is there with no content (the stat tile's `mt-2` note wrapper) still takes its margin; the skeleton needs it too (LED-200, 138.5 against 146.5px).
- **Reserve a card only when something known before the read says it will show.** The first-run checklist reserves while loading only when it is not dismissed and the pay cycle (a device flag) is unconfirmed, because `isSetupComplete` is false for those users whatever the reads say (`shouldReserveChecklist`, LED-199). Otherwise a reserved block that then disappears shifts the page the other way. A skeleton card still needs real parts for what is certain: titles and descriptions that are static text stay real.
- **Rows must not change height with state.** `border-2` on the unfinished row against `border` on the finished one made a 2px per row difference between the skeleton and a partly done user. Draw the second pixel as `ring-1 ring-inset` so the box does not change.

