# A write that half-succeeded says so, and Fix reruns only what is missing
When the first write of a two-step operation saved and the second failed, report success for the first step and a `partial` notification for the second. Do not return the whole operation as failed.
**Why:** reporting total failure invites a retry that saves the first step twice (a second account update, a second payment). Seen with card payments (LED-93) and account balance adjustments (LED-129).
**How:**
- Save step one. If it fails, return the error as before; nothing changed.
- Run step two as its own function. On failure, `notify({ severity: 'partial', title, body, action: { label: 'Fix', run } })` where `run` calls that same function, so it can fail and notify again.
- Return success to the caller so its form or dialog closes; the notification carries the rest.
- Keep the split decision in a pure `src/lib` helper (`planAccountSave`) so the tests need no Supabase.
**Watch for:** a function that used to throw or return an error and now returns success changes what its caller does next. Check every caller's cleanup (LED-129: `SettingsPage` reset its `deleting` state only in `catch`, so a swallowed sign-out failure left the delete dialog stuck). Clicking Fix dismisses the notification, so a successful Fix shows nothing.
