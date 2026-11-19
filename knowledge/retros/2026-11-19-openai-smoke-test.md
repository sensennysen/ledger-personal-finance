# OpenAI extraction smoke test

Added a standalone `test:openai` command for a short phrase and a synthetic receipt. Both Responses API requests use `store: false` and strict structured output. The receipt is sent inline and prints distinct subtotal, total, cash tendered, and change values.

Verified both cases with a mocked Responses API. The mock checked the request shape, storage flag, and fixture bytes. A simulated permissions error surfaced its status, code, and request ID. Returning the cash tendered as the amount failed the receipt assertion. The missing-key path also failed with setup instructions. Lint, production build, and the redesign checks passed with the installed tools.

Switched the command to the repo root `.env`. Both live GPT-6 Luna cases passed with the project key loaded from that file. The OpenAI key is outside Vite's public environment prefix.

## Backlog

- The regular unit suite had 1,235 passes and one existing Windows failure. `tests/hardcodedColors.test.mjs` compares Windows paths with a slash-delimited allowlist. The pinned pnpm version could not be fetched in this environment, so validation used the available pnpm and installed tools.
