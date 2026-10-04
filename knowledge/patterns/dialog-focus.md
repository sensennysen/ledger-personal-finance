# Dialog focus: let the primitive decide, never autoFocus inside
Dialogs and sheets open on their title and return focus to the trigger (LED-91). `DialogContent` and `SheetContent` do this by default.
**Why:** an `autoFocus` element inside a base-ui popup takes focus before the dialog records the previously focused element. The dialog then records itself, and closing drops focus on `<body>`. This happened to the search palette.
**How:**
- Don't put `autoFocus` inside dialog content. To start somewhere other than the title, pass `initialFocus` (a ref or a function) to the Content.
- If the trigger unmounts while the dialog is open (the FAB, a menu item), remember it before opening and pass `finalFocus`. See `triggerFocus` in `AppLayout.tsx`.
- For a hand-rolled panel that isn't a dialog, focus a `tabIndex={-1}` heading on open and restore focus in the effect cleanup.
