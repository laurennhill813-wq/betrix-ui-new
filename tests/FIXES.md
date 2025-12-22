Verification notes for test-suite fixes

Summary
-------
I inspected the tests requested in the task and ran the unified test runner locally.

- `tests/sportradar.test.js`: no stray bracket token found; file syntax valid and tests pass.
- `tests/azure-ai.smoke.node.js`: test runs under Node built-in runner; repository `package.json` already sets `type: "module"` and the test runner supplies `--experimental-vm-modules` to Jest. No syntax changes required.
- `tests/payment-router.test.js`: uses an internal `MockRedis` and invokes `createPaymentOrder`; I verified the test runs and the mocked flows execute successfully.

Actions taken
-------------
1. Ran `npm test` (the project's `scripts/run-all-tests.js`) and verified node-script and Jest suites completed without failures in this workspace.
2. Created this file to record the verification steps and results so CI reviewers can see that the files were inspected and that no source edits were needed.

Next steps
----------
- If you have a failing CI run on GitHub, push this branch and open a PR so Actions can re-run against CI environment.
- If you prefer me to make an explicit code fix (for reproducible failing environments), tell me which specific failing file/line you observed in CI and I'll patch it directly.

Timestamp: 2025-12-22
