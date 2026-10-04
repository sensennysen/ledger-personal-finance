Add a new check to `.github/workflows/ci.yml` as its own named step in the `verify` job.
Make it runnable locally through an npm script first, confirm it passes on the current branch, and keep the workflow at `contents: read`.
