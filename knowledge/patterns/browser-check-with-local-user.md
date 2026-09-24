# Check UI in a real browser with a local test user
Earlier retros left layout unverified because sign-in is Google-only. It doesn't have to be.
**Why:** Phase 4 found nine layout bugs this way (truncated cells, an empty loan column, Home 166px too tall at 1920). The code-level checks all passed.
**How:**
1. `.env.local` points at local Supabase (`http://127.0.0.1:54321`). Create a user with the local service key: `POST /auth/v1/admin/users` with `email_confirm: true` and a password.
2. Seed rows for that user with `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Default categories exist on signup. Use the design's sample numbers.
3. Get a session: `POST /auth/v1/token?grant_type=password` with the anon key.
4. Drive `Google Chrome --headless=new --remote-debugging-port=…` over CDP with Node 22's built-in `WebSocket`. No installs are needed.
   - Set `localStorage['sb-127-auth-token']` to the session JSON on `/login`.
   - Set `Emulation.setDeviceMetricsOverride` for 390×844, 1280, 1920×1080.
   - Navigate, `Runtime.evaluate` measurements (`main.scrollHeight` vs `clientHeight`), then `Page.captureScreenshot`.
5. Wrap evaluated code in `(async () => { … })()`, since top-level await is rejected. For React inputs, set the value with the native setter, then dispatch `input` and `focusout`.
6. Keep the script and screenshots in the session scratchpad, not the repo. Delete the test user when done.
