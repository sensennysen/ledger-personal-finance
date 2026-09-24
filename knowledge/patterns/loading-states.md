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
