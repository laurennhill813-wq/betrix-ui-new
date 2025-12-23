# Contributing

## Requirements

- **Node version**: Node 20+ (ESM required)
- **CI checks**: All pull requests must pass repository CI checks before requesting review
- **Test coverage**: Include unit tests for all new behavior

## Node 20 & ESM Compatibility

This repository uses ES modules (`type: "module"` in `package.json`). When writing tests:

1. **Jest imports**: All test files using Jest utilities must import from `@jest/globals`:
   ```javascript
   import { jest } from '@jest/globals';
   ```

2. **Global objects**: Do not use `global.fetch = jest.fn()`. Instead:
   ```javascript
   // ✅ Correct
   fetch = jest.fn();
   
   // ❌ Incorrect
   global.fetch = jest.fn();
   ```

3. **Test execution**: Tests run under Node 20 with `--experimental-vm-modules` flag

## Running Tests

- **Full suite**: `npm test` (runs all Node.js and Jest tests)
- **Multi-sport normalization**: `node test/aggregateFixtures.test.mjs`
- **Single Jest file**: `npx jest tests/your-test.js --experimental-vm-modules`

## CI Workflow

The CI pipeline includes:
1. Node.js built-in test runner (Node smoke tests, integration tests)
2. Jest test suite (RapidAPI, payment, fixtures, etc.)
3. Multi-sport normalization validation (`aggregateFixtures.test.mjs`)

All suites must pass under Node 20 ESM environment.

## Guidelines

- Keep changes focused and atomic
- Add unit tests for new behavior
- Ensure all Jest tests have proper ESM imports
- Test locally with `npm test` before opening PR
- Check that MockRedis mock data properly tracks key types (string vs hash) if using UserService

## Troubleshooting

If tests fail locally:
1. Verify Node version: `node --version` (should be v20+)
2. Check for `global.fetch` usage (should be `fetch`)
3. Verify Jest imports: `import { jest } from '@jest/globals'`
4. Check MockRedis has `type()` method if testing with UserService
5. Run `npm test` to see full output


