# FormControl is a wrapper div: size it, not the input
`FormControl` (`src/components/ui/form.tsx`) renders its own `div` around the control. It doesn't slot props onto the child.
**Why:** in LED-84, `className="flex-1"` on an `Input` inside a flex row did nothing. The wrapper `div` was the flex item, and the input shrank to 45px beside "of 24".
**How:** put layout classes (`flex-1`, `min-w-0`, widths) on `FormControl`. Only visual classes go on the `Input`. Check the rendered width in the browser, because lint and build can't catch this.
