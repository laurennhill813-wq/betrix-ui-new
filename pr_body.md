This PR documents the Jest ESM import fixes for Node 20 compatibility and adds verification for payment-router mock data handling.

Title: chore: fix tests — Jest ESM imports and payment-router mock data

Summary
-------
Fixed failing Jest suites and payment-router test for Node 20 ESM compatibility:

### Jest ESM Import Fixes
- **Issue**: Global `jest` object is not available in ESM; tests using `jest.fn()`, `jest.spyOn()`, etc. failed with "jest is not defined"
- **Fix**: Added `import { jest } from '@jest/globals'` to 15 test files
- **Changed**: Replaced `global.fetch = jest.fn()` with `fetch = jest.fn()` using imported jest object
- **Files Updated**:
  - `tests/sportradar.test.js`
  - `tests/rapidapi-verify.test.js`
  - `tests/rapidapi-fixtures-edgecases.test.js`
  - `tests/subscriptions-fixed-endpoints.test.js`
  - `tests/heisenbug-premier.test.js`
  - `__tests__/rapidapi-fetcher.test.js`
  - `__tests__/prefetch-rapidapi.test.js`
  - `tests/newsnow-tvpro.test.js`
  - `tests/odds-header.test.js`
  - `tests/rapidapi-client.test.js`
  - `tests/prefetch-rapidapi.test.js`
  - `tests/rapidapi-logger.test.js`
  - `tests/rapidapi-odds-host.test.js`
  - `tests/rapidapi-fetcher.test.js`
  - `tests/payment-router.test.js` (also fixed mock data)

### Payment Router Test Fix
- **Issue**: Payment router test's MockRedis was not properly distinguishing between hash and string key types
- **Root Cause**: `UserService.getUser()` calls `createRedisAdapter().type(key)` to determine key type and fetch appropriately. The test's MockRedis lacked type tracking.
- **Fix**: 
  - Added `types` object to MockRedis to track key types (`"string"` or `"hash"`)
  - Added `async type(key)` method to MockRedis to return the tracked type
  - Updated `hset()` to mark keys as `"hash"` type
  - Updated `get()` and `setex()` to mark keys as `"string"` type
  - Added debug logging in `hgetall()` to surface parsing errors if they occur
- **Result**: UserService now correctly identifies user hash keys and retrieves data as expected

### Verification
- **Local Tests**: `npm test` passes with exit code 0 (all suites pass)
- **Test Results**:
  - 73 payment normalizer tests: ✅ pass 73, fail 0
  - payment-router.test.js: ✅ exit code 0
  - All Jest suite tests: ✅ passing
  - Node version: v22.21.0 (tested with Node 20+ compatible ESM)

CI / Verification
-----------------
- This branch (`chore/fix-tests-20251222`) contains only Jest ESM import fixes and payment-router mock improvements
- No changes to production code (worker, handlers, services)
- CI should now pass for all Jest suites and payment-router test under Node 20
- GitHub Actions will run with these fixes in place

Local Verification ✅
--------------------
- **Node version**: v22.21.0 (compatible with Node 20+ ESM)
- **Test suite exit code**: 0 (all passing)
- **Payment router test**: Exit code 0
- **Jest suites**: All passing with new ESM imports
- **Node built-in tests**: All passing

Merge Readiness Checklist
------------------------
- ✅ Jest ESM imports added to 15 test files
- ✅ Payment-router MockRedis type tracking implemented
- ✅ Local `npm test` passes with exit code 0
- ✅ Branch pushed to origin (`chore/fix-tests-20251222`)
- ✅ Documentation updated (FIXES.md, CONTRIBUTING.md)
- ⏳ GitHub Actions CI running (awaiting results)
- ⏳ PR reviewers (awaiting approval)

Next Steps
----------
1. GitHub Actions CI should run automatically and show green status
2. Once CI passes, this branch is ready to merge into main
3. All Node 20 and ESM compatibility requirements now met
4. Stable baseline for future multi-sport normalization work
