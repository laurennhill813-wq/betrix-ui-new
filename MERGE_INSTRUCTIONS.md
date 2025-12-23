# MERGE INSTRUCTIONS - chore/fix-tests-20251222 → main

## ⚠️ PREREQUISITES (MUST BE MET BEFORE MERGING)

### ✅ Local Verification Complete
- [x] All tests passing locally (exit code 0)
- [x] npm test verified on Node 20+
- [x] All 15 test files with ESM imports validated
- [x] payment-router.test.js MockRedis functionality confirmed
- [x] Working tree clean (all changes committed)
- [x] Branch synced with origin

### ⏳ AWAITING (BEFORE PROCEEDING WITH MERGE)
- [ ] **GitHub Actions CI PASSED** on chore/fix-tests-20251222 branch
  - Status: Must be GREEN before merge
  - Required Jobs: All smoke tests and full test suite
  
- [ ] **Reviewer APPROVED** the pull request
  - Status: Must have approval from maintainer
  - Comments: All concerns addressed

---

## STEP-BY-STEP MERGE PROCESS

### Step 1: Pre-Merge Verification (LOCAL)

**Run this before any merge:**

```powershell
# Navigate to repository
cd "d:\betrix-ui (1)\betrix-ui"

# Verify we're on the correct branch
git status
# Expected: On branch chore/fix-tests-20251222

# Verify working tree is clean
git diff --stat
# Expected: No output (clean working tree)

# Verify commits are in place
git log --oneline -5
# Expected: Should see: 9fac5a6, 8ba1367, 6e30eee, 5072d02, 1795513
```

### Step 2: Final Test Verification

**Run tests one final time before merge:**

```powershell
npm test
# Expected output:
# Exit Code: 0
# All test suites passing
```

### Step 3: Switch to Main Branch

```powershell
git checkout main
# Output: Switched to branch 'main'
```

### Step 4: Update Main with Latest Remote

```powershell
git pull origin main
# Expected: Fast-forward or merge latest remote changes
```

### Step 5: Perform the Merge (CHOOSE ONE APPROACH)

#### OPTION A: Merge with Merge Commit (RECOMMENDED)
**Best for history preservation. Recommended.**

```powershell
git merge --no-ff chore/fix-tests-20251222 -m "Merge branch 'chore/fix-tests-20251222' into main

Test fixes and improvements for Node 20+ compatibility

This merge includes:
- Jest ESM imports added to 15 test files
- MockRedis enhanced with type tracking for redis-adapter
- Complete documentation updates for Node 20 support
- All tests passing locally (exit code 0)

Fixes:
- Issue: 'jest is not defined' in ESM environment
  Solution: Added 'import { jest } from @jest/globals'
- Issue: MockRedis missing type() method
  Solution: Implemented type tracking in MockRedis

Tested: Node v22.21.0, npm test exit code 0
CI Status: GitHub Actions validation completed
Reviewer: [Approval obtained]"

# Expected output:
# Merge made by the 'recursive' strategy.
#  ...files changed...
```

#### OPTION B: Squash Merge
**Good if you want a single clean commit. Use if you prefer minimal history.**

```powershell
git merge --squash chore/fix-tests-20251222

# Git will automatically create a merge commit message
# Edit if needed
git commit -m "test: Fix Jest ESM compatibility for Node 20

- Added ESM Jest imports to 15 test files
- Fixed MockRedis type tracking for redis-adapter
- Updated documentation with Node 20 requirements
- All tests passing (npm test exit code 0)
- Node version tested: v22.21.0"

# Expected output:
# [main ...] test: Fix Jest ESM compatibility for Node 20
```

#### OPTION C: Fast-Forward Merge
**Only works if main hasn't changed since branch was created. Simplest but less history.**

```powershell
git merge chore/fix-tests-20251222

# Expected output:
# Fast-forward
#  ...files changed...
```

### Step 6: Verify Merge Success

**CRITICAL: Verify merge completed successfully**

```powershell
# Check current branch
git status
# Expected: On branch main

# Verify merge commit exists
git log --oneline -3
# Expected: Should show merge commit at top

# Verify merged files are present
git diff main chore/fix-tests-20251222
# Expected: No output (branches are now identical)

# Verify all test files are updated
git show --name-status HEAD | Select-Object -First 30
# Expected: Shows all 15 test files, documentation files updated
```

### Step 7: Run Tests on Merged Main

**Critical step: Verify tests still pass after merge**

```powershell
npm test
# Expected: Exit code 0, all tests passing
```

### Step 8: Push to Remote

**Only if Step 7 (tests) pass successfully**

```powershell
git push origin main

# Expected output:
# Enumerating objects...
# Writing objects...
# [main] chore/fix-tests-20251222 -> [updates to] chore/fix-tests-20251222
```

### Step 9: Verify Remote Update

```powershell
# Check remote status
git log --oneline -3 origin/main
# Expected: Should show merge commit

# Verify branch no longer exists if cleanup desired
git branch -a
# chore/fix-tests-20251222 still exists locally, but can be deleted after merge
```

---

## POST-MERGE CLEANUP & VERIFICATION

### Clean Up Local Branch (Optional)

```powershell
# Delete local feature branch
git branch -d chore/fix-tests-20251222
# Expected: Branch chore/fix-tests-20251222 deleted

# Delete remote feature branch (if no longer needed)
git push origin --delete chore/fix-tests-20251222
# Expected: [deleted] chore/fix-tests-20251222
```

### Verify Main Branch CI

**Wait for GitHub Actions to run on main**

```powershell
# Check main branch tests
npm test
# Expected: Exit code 0

# Verify latest commits
git log --oneline -5
# Expected: Should see merge commit followed by previous main commits
```

### Update Documentation (Post-Merge)

**After merge is confirmed successful:**

1. Update [FIXES.md](tests/FIXES.md):
   ```
   ## Merge Status
   - Branch merged to main: [DATE/TIME]
   - Commit: [MERGE_COMMIT_HASH]
   - CI Status: PASSED
   - Verification: Complete
   ```

2. Close related GitHub PR with completion note:
   ```
   ✅ Merge completed successfully!
   
   - Merged commit: [HASH]
   - All tests passing on main
   - CI verified: [DATE]
   - Documentation updated
   
   This branch is now integrated into main.
   ```

3. Update CHANGELOG.md (if applicable):
   ```
   ## Version [X.Y.Z] - 2025-12-22
   
   ### Fixed
   - Jest ESM compatibility for Node 20+
   - MockRedis type tracking for redis-adapter
   - All test suites now pass in Node 20+ environment
   ```

---

## ROLLBACK PROCEDURE (IF NEEDED)

**Only if merge causes unexpected issues**

### Method 1: Revert Merge Commit

```powershell
# Identify merge commit
git log --oneline -5

# Revert the merge (create new commit that undoes merge)
git revert -m 1 <MERGE_COMMIT_HASH>

# Push revert
git push origin main

# Expected: New commit created that undoes the merge
```

### Method 2: Reset to Previous State

```powershell
# WARNING: Only if merge hasn't been distributed

# Get previous commit hash
git log --oneline -5

# Reset to before merge
git reset --hard <PREVIOUS_COMMIT_HASH>

# Force push (use with caution!)
git push origin main --force

# Expected: Repository reset to before merge
```

---

## CHECKLIST: Complete This Before Merging

| Step | Task | Status | Notes |
|------|------|--------|-------|
| 1 | GitHub Actions CI PASSED | ⏳ REQUIRED | Must be green on chore/fix-tests-20251222 |
| 2 | Reviewer APPROVED | ⏳ REQUIRED | PR must have approval from maintainer |
| 3 | Main branch updated | ⏳ REQUIRED | `git pull origin main` complete |
| 4 | Working tree clean | ✅ DONE | All changes committed, verified |
| 5 | Tests passing locally | ✅ DONE | `npm test` exit code 0 verified |
| 6 | Merge strategy chosen | ⏳ READY | Recommend: --no-ff (Option A) |
| 7 | Pre-merge verification done | ⏳ READY | Follow Step 1 above |
| 8 | Final test run before merge | ⏳ READY | `npm test` one more time |
| 9 | Merge executed | ⏳ PENDING | Use chosen strategy from Step 5 |
| 10 | Post-merge tests pass | ⏳ PENDING | Run tests on merged main |
| 11 | Remote updated | ⏳ PENDING | `git push origin main` complete |
| 12 | PR closed/labeled | ⏳ PENDING | Mark as merged and completed |

---

## EXPECTED OUTCOMES AFTER MERGE

### ✅ Success Indicators
- Merge commit appears in main branch history
- All tests pass on main (exit code 0)
- GitHub Actions CI passes on main
- PR closed as merged
- Feature branch can be safely deleted
- No conflicts or errors reported

### ❌ Failure Indicators (Rollback Needed)
- Merge conflicts (should not occur, but handle if needed)
- Tests fail on merged main
- CI fails after merge
- Unexpected errors appear
- → Follow ROLLBACK PROCEDURE above

---

## IMPORTANT NOTES

### ⚠️ CRITICAL REQUIREMENTS
1. **CI MUST PASS** before merge - non-negotiable
2. **Reviewer approval** required - follow team workflow
3. **Tests MUST pass** locally before merge attempt
4. **Clean working tree** - no uncommitted changes

### 📌 BEST PRACTICES
- Use `--no-ff` flag (Option A) to preserve branch history
- Run tests after merge before declaring success
- Keep PR description updated with merge info
- Document any post-merge steps taken
- Tag release if applicable after merge

### 🔍 MONITORING AFTER MERGE
- Watch for CI failures on main
- Monitor for unexpected behavior in production
- Keep FIXES.md updated with merge confirmation
- Be ready to rollback if critical issues appear

---

## QUESTIONS OR ISSUES?

### Reference Documents
- [MERGE_VERIFICATION.md](MERGE_VERIFICATION.md) - Complete verification checklist
- [MERGE_REQUEST_SUMMARY.md](MERGE_REQUEST_SUMMARY.md) - PR summary for reviewers
- [tests/FIXES.md](tests/FIXES.md) - Technical details of all fixes
- [CONTRIBUTING.md](CONTRIBUTING.md) - Node 20 guidelines

### Quick Reference Commands
```powershell
# Check current branch
git status

# View branch history
git log --oneline -10

# See what will merge
git diff --stat main..chore/fix-tests-20251222

# Run final tests
npm test

# Switch to main
git checkout main

# Merge the branch
git merge --no-ff chore/fix-tests-20251222

# Push to remote
git push origin main
```

---

## FINAL SIGN-OFF

**Branch**: chore/fix-tests-20251222  
**Target**: main  
**Status**: READY FOR MERGE (pending CI and approval)  
**Prepared**: 2025-12-22  
**Next Step**: Execute merge once CI passes and reviewer approves  

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-22  
**Prepared By**: GitHub Copilot  
**For**: betrix-ui Development Team
