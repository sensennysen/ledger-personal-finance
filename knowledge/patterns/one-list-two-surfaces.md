# One list, two surfaces: build the items as data, render them twice

The kind menu is a dropdown above `md` and a bottom sheet below (LED-108, LED-109). Both map over `kindMenuItems` in `src/lib/kindMenu.ts`.

**Why:** two hand-written menus drift. Labels, order and live strings diverge, and only a rendered comparison would notice.

**How:**
1. Put ids, labels, descriptions, groups and shortcuts in a pure `src/lib` function that takes its inputs as arguments (accounts, base currency, a `formatMoney` callback), so `node --test` covers it.
2. Keep icons and colours in the component, keyed by id. The list stays free of `lucide-react` and `@/` imports.
3. Call the list function once in the component and pass the same arrays to both surfaces. Choose the surface with `useMediaQuery`, not a second component tree.
4. `node --test` cannot render React, so guard the rest by source: one call to the list function, and each surface maps each group. Confirm rendered parity in the browser.

**Watch:** base-ui's `DropdownMenuItem` has `focus:**:text-accent-foreground`, so a highlighted row recolours its icon. Measure a token colour on an un-highlighted row, or a gold icon reads as the accent.
