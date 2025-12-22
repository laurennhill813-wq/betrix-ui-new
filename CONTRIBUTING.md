# Contributing

Please ensure all pull requests pass the repository CI checks before requesting review. The CI workflow runs unit tests (including `test/aggregateFixtures.test.mjs`) and will fail the PR if tests do not pass.

All PRs must pass CI tests, including `test/aggregateFixtures.test.mjs` for multi-sport normalization.

Guidelines:
- Run tests locally with `node test/aggregateFixtures.test.mjs` or `npm test`.
- Keep changes focused and add unit tests for new behavior.
