# FormControl is a wrapper div: size it, not the input
`FormControl` (`src/components/ui/form.tsx`) renders its own `div` around the control. It doesn't slot props onto the child.
**Why:** in LED-84, `className="flex-1"` on an `Input` inside a flex row did nothing. The wrapper `div` was the flex item, and the input shrank to 45px beside "of 24".
**How:** put layout classes (`flex-1`, `min-w-0`, widths) on `FormControl`. Only visual classes go on the `Input`. Check the rendered width in the browser, because lint and build can't catch this.

## A Select holding an id needs a render function for its label
base-ui's `Select.Value` shows the raw value when it has no children. A `<SelectValue placeholder="Category" />` over category ids therefore reads `b930f068-…` once something is chosen. Pass a function: `<SelectValue>{(value) => label(value) ?? 'Choose a category'}</SelectValue>`, as SettingsPage and the merge dialog do (LED-239; the rule form is LED-250).
