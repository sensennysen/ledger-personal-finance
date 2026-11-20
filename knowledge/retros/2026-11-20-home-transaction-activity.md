# Home transaction entries open Activity

The Home Add Transaction button, setup checklist Add entry button, and mobile Add button expose Quick Log and Capture Receipt through the shared transaction menu. Successful saves from the shared entry dialog open Activity in the cycle containing the posted date. New AI drafts open Needs review, where users can see the reason for review. Completing a draft keeps the review list open for the next item.

## Verification

- Verified Quick Log and Capture Receipt in the desktop Home and setup menus, and verified receipt capture and manual entries through the mobile Add button at 390 pixels.
- A live Quick Log save opened Activity and showed the posted expense. A receipt saved while October was selected opened Activity in November and showed the receipt. A receipt with a currency mismatch opened Needs review and showed its draft and reason.
- A manual form validation failure stayed on Home. A successful submission opened Activity and showed the row.
- Passed lint, the production build, all 1,254 app tests, and the redesign checks.

## Backlog

- Verify the navigation in installed PWAs on physical iOS and Android devices.
