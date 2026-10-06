# cmdk drops work scheduled during its own flush (patched)

cmdk 1.1.1 batches work in a `useScheduleLayoutEffect` map: it runs every queued callback, *then* replaces the map. Work queued by one of those callbacks lands in the old map and is thrown away. When cmdk auto-highlights the first option (item registration → `selectFirstItem` → `setState('value')`), the step that computes `selectedItemId` is queued that way. The option looks highlighted (`aria-selected`), but `aria-activedescendant` on the input and list stays empty until an arrow press, so a screen reader hears nothing on open.

**Why:** LED-273. Making `value` uncontrolled does not help; the loss happens in both modes.

**How to apply:**
- `patches/cmdk@1.1.1.patch` (registered in `pnpm-workspace.yaml`) swaps the map before running it. On a cmdk upgrade, check whether upstream fixed the scheduler; drop the patch if so, or regenerate it with `pnpm patch cmdk@<new>`.
- Vite pre-bundles dependencies: after a patch, delete `node_modules/.vite` and restart the dev server, or the browser still runs the old code.
- To check, open the surface and read `[cmdk-input]`'s `aria-activedescendant` before any key press; it must name the `[cmdk-item][aria-selected=true]`.
- **Second path (LED-287).** When the root and its items mount in the same commit (`AccountCombobox` in a popover), the items' store subscriptions are not live yet when the first value is set. The `selectedItemId` step queries `[aria-selected="true"]` before the items re-render, finds nothing, and never runs again. The patch makes `getSelectedItem` fall back to the item whose `data-value` equals the store value. Keep both hunks when regenerating the patch.
