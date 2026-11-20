# Production dependency audit

GitHub Actions stopped in the production dependency audit because the lockfile resolved Zod to 4.6.5. The advisory identifies 4.6.6 as the first patched release. [GitHub security advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)

Raised the package requirement to 4.6.6 and regenerated the lockfile with pnpm. The dependency and its peer references now resolve to 4.6.7. A frozen-lockfile install and the production audit passed locally. The audit reported seven low and two moderate findings below the existing CI threshold.

Lint, the production build, all 1,248 Node tests, and the redesign checks passed with the updated lockfile.
