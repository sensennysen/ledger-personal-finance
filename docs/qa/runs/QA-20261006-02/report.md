# QA-20261006-02 — Google OAuth restart and retest

Date: 2026-10-06 (Asia/Shanghai). Revision: `d687826b0da6f4aba5fa186ba2a5ad54b8695b7a`.

Scope: restart local services and repeat Google sign-in after the user supplied root `.env` variables. No application code or authentication configuration changed by the tester. Existing local database preserved; no reset or migration push performed.

## Results

| Case | Result | Evidence |
|---|---|---|
| F-001a: Google OAuth initiation with configured local credentials | Pass | Continue with Google navigates to Google's account chooser for My Wallet App. Callback targets local Supabase on port 54321 and return URL targets Ledger on port 5173. [Screenshot](google-account-chooser.png) |
| F-001b: Google credentials/consent, callback, authenticated session and reload | Pass | User completed Google sign-in. Ledger displayed the authenticated profile at the local callback and retained the session after reload. [Screenshot](google-session-persisted.png) |
| Google logout and protected-route check | Pass | Signed out through the account menu, then opened `/accounts`; redirected to `/login`. A rapid first click did not complete logout; a subsequent click after the menu settled succeeded. No claim of a reproducible logout defect from that observation. |

The previous attempt (QA-20261006-01) failed with Google `401 invalid_client`: the client ID was the literal `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)`. [Previous screenshot](../QA-20261006-01/google-invalid-client.png). That initiation failure no longer reproduces after the user added variables and services were restarted. The local OAuth happy path is verified; hosted production authentication was not tested.

## Service state

- Local Supabase stopped and started successfully, preserving existing data.
- Existing Vite instances stopped; one fresh instance started at `http://127.0.0.1:5173` with strict port selection.
- No instance crash observed during this retest.
- No other test families executed in this retest.

## Suggested follow-up

Remaining authentication variants include expiry, provider cancellation/error callback, and hosted production configuration. See the [consolidated report](../QA-20261006-summary.md) for subsequent seeded-user and isolated-fixture tests.
