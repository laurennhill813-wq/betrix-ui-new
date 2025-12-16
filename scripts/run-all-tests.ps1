<#
Run all test suites in this repository.

This script runs two test ecosystems present in the repo:
 1) Node built-in tests that import `node:test` (runs with `node --test`)
 2) Jest tests (runs with `npx jest`)

It sets `NODE_OPTIONS=--experimental-vm-modules` for Jest so ESM tests run correctly.

Usage:
  pwsh ./scripts/run-all-tests.ps1
#>

param()

$ErrorActionPreference = 'Stop'

Write-Host "=== Running Node built-in tests ==="

# Discover files that use node:test and run only those with node --test
Write-Host "Discovering node:test files..."
$nodeFiles = Get-ChildItem -Path (Join-Path $PSScriptRoot '..' 'tests') -Recurse -File -Include *.js,*.mjs -ErrorAction SilentlyContinue | Where-Object {
  try { Select-String -Path $_.FullName -Pattern 'node:test' -SimpleMatch -Quiet } catch { $false }
}

$nodeExit = 0
if ($nodeFiles -and $nodeFiles.Count -gt 0) {
  Write-Host "Running Node built-in tests (node --test) on $($nodeFiles.Count) files..." -ForegroundColor Green
  $fileArgs = $nodeFiles | ForEach-Object { $_.FullName }
  node --test $fileArgs --test-reporter=spec
  $nodeExit = $LASTEXITCODE
  if ($nodeExit -eq 0) { Write-Host "Node tests passed." -ForegroundColor Green } else { Write-Host "Node tests failed (exit $nodeExit)" -ForegroundColor Red }
} else {
  Write-Host "No node:test suites found." -ForegroundColor Yellow
}

Write-Host "`n=== Running Jest tests ==="
# Ensure ESM support for Jest
$env:NODE_OPTIONS = '--experimental-vm-modules'

# Discover Jest-style test files (exclude files that import node:test)
Write-Host "Discovering Jest-style test files (excluding node:test suites)..."
$allTestFiles = Get-ChildItem -Path (Join-Path $PSScriptROOT '..' 'tests') -Recurse -File -Include *.js,*.mjs -ErrorAction SilentlyContinue
$jestFiles = @()
foreach ($f in $allTestFiles) {
  try { $containsNodeTest = Select-String -Path $f.FullName -Pattern 'node:test' -SimpleMatch -Quiet } catch { $containsNodeTest = $false }
  if (-not $containsNodeTest) { $jestFiles += $f.FullName }
}

$jestExit = 0
if ($jestFiles.Count -eq 0) {
  Write-Host "No Jest-style test files found. Skipping Jest." -ForegroundColor Yellow
} else {
  Write-Host "Running single Jest invocation on $($jestFiles.Count) files..." -ForegroundColor Green
  # Run Jest once with the discovered files; --passWithNoTests prevents exit code on empty suites
  npx jest --passWithNoTests --runInBand --verbose $jestFiles
  $jestExit = $LASTEXITCODE
  if ($jestExit -eq 0) { Write-Host "Jest tests passed." -ForegroundColor Green } else { Write-Host "Jest tests failed (exit $jestExit)" -ForegroundColor Red }
}

Write-Host "`n=== Combined Test Summary ==="
Write-Host "Node exit code: $nodeExit"
Write-Host "Jest exit code: $jestExit"

if ($nodeExit -ne 0 -or $jestExit -ne 0) {
    Write-Host "❌ Some tests failed."
    exit 1
} else {
    Write-Host "✅ All tests passed."
    exit 0
}
