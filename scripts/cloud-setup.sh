#!/bin/bash
# SessionStart hook: install dependencies in Claude Code cloud sessions only.
# Local sessions exit immediately.

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile || echo "cloud-setup: pnpm install failed" >&2

exit 0
