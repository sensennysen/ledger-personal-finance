# VoiceOver pass (LED-179, step 2) — about 15 minutes

Run this on a Mac in **Safari** (VoiceOver is tuned for it), against the local app (`pnpm dev`, demo login) or production. Step 1 already checked the accessibility tree (`knowledge/retros/2026-10-05-led-179-a11y-tree-pass.md`); this is about what is actually **spoken**.

**Setup.** Turn VoiceOver on with **Cmd+F5**. Turn on the caption panel (VoiceOver Utility → Visuals → Caption panel) so the spoken text is on screen and can be screenshotted. "VO" below means **Control+Option**. Turn VoiceOver off again with Cmd+F5.

For each row, write ✓ if you heard roughly what is expected, or note what you heard instead.

| # | Do | Expect to hear (roughly) | Result |
|---|---|---|---|
| 1 | Load any page, press **Tab** once | "Skip to content, link" | |
| 2 | Press **Enter** | "main" (focus moves past the nav) | |
| 3 | Shift+Tab back to the top nav, then **Tab** into it | "Categories, selected, tab, 5 of 6" or similar. **Does this sound natural for page links, or confusing?** | |
| 4 | In the nav, press **Right arrow** | The next section's name, "tab, 6 of 6" | |
| 5 | Go to **Categories**, Tab to the Expenses tab | "Expenses 11, selected, tab, 1 of 3, Category type" | |
| 6 | Press **Right arrow**, then **Space** | "Income 5, tab…", then it becomes selected | |
| 7 | Press **Cmd+K** | "Search, dialog" then "Search, combo box" (or "search text field") | |
| 8 | Press **Down arrow** twice | Each option's name, e.g. "New income", with no stray letter after it | |
| 9 | Type **a** and arrow down to the last transaction row | A row like "1 more transaction" (singular when one) | |
| 10 | Press **Escape** | Back on the "Search, button" | |
| 11 | On **Activity**, click a transaction (or VO+Space on it) | "Entry detail, heading" and the detail dialog | |
| 12 | Press **Escape** | Back on the same transaction row | |
| 13 | On **Categories**, turn on Reorder and press a **Move down** arrow | "… moved to position 2 of 11." | |
| 14 | Turn Wi-Fi off, add any expense, turn Wi-Fi back on | The banner: "Offline — 1 entry will sync when you reconnect", then "Syncing…" or "Back online — 1 change still queued, Sync now" — **does the notice repeat or double up?** | |
| 15 | *(Optional, needs a failed sync — skip if you can't produce one)* Open **Review** | "Waiting to sync, heading", then each item's "Discard <name>" / "Retry <name>" buttons | |

## The question only a person can answer (AC c)
Open a confirm dialog, for example **Settings → Delete account** (do not confirm) or deleting a category you then cancel.

Today focus opens on **Cancel**: you hear "Cancel, button" first and the dialog's title only if you move back. The alternative opens on the **heading**: you hear the title ("Delete account?"), then Tab reaches Cancel.

**Which do you prefer as a screen-reader user, and why?** ___

## When you're done
Paste the Result column (and your answer above) to Claude. Anything that isn't ✓ becomes a ticket; LED-179 closes when this table is filled in.
