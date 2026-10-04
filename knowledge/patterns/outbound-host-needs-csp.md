# A new outbound host has to be added to the CSP in two files

The app's Content-Security-Policy allows `connect-src` only for itself, Supabase and Google. LED-136 fetched rates from `api.frankfurter.dev`; the browser refused it with "Failed to fetch", the app showed "Couldn't reach the rate feed", and lint, build and 725 tests were green. Only a live check with the real feed showed it.

**Why:** the policy sits in `index.html` (a `<meta>`, with `%VITE_SUPABASE_URL%` for the dev server) and in `vercel.json` (the header). They are separate strings, and nothing compares them.

**How:**
1. Add the host to `connect-src` in both files in the same commit.
2. A "Failed to fetch" for a host that answers in `curl` is a CSP block until proven otherwise; check `Runtime` and `Log` events for "Refused to connect".
3. Say the host in the Privacy Policy's third-party list. That is legal text, so it waits for the product owner (LED-136 retro).
