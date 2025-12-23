#!/bin/bash
set -euo pipefail

##
# Verify that this PR changes ONLY test, documentation, and configuration files.
# Blocks merge if any production code is modified.
#
# Usage:
#   ./scripts/verify-test-only-changes.sh [main|origin/main]
##

BASE_BRANCH="${1:-origin/main}"
TEMP_FILE=$(mktemp)
PROD_FILES=$(mktemp)

trap "rm -f $TEMP_FILE $PROD_FILE" EXIT

echo "🔍 Verifying test-only changes against $BASE_BRANCH..."
echo ""

# Get list of changed files
git diff "$BASE_BRANCH" --name-only > "$TEMP_FILE" || {
  echo "❌ Failed to compare with $BASE_BRANCH"
  exit 1
}

# Allowed patterns (whitelist)
ALLOWED_PATTERNS=(
  '^tests/'
  '^__tests__/'
  '^\.github/workflows/'
  '^docs/'
  '^scripts/'
  '^config/'
  'MERGE_'
  '\.md$'
  '^CHANGELOG'
  '^CONTRIBUTING'
  '^\.eslintrc'
  '^\.prettierrc'
  '^tsconfig'
  '^jest\.config'
)

# Check each changed file against whitelist
> "$PROD_FILES"
while IFS= read -r file; do
  [ -z "$file" ] && continue
  
  MATCHED=0
  for pattern in "${ALLOWED_PATTERNS[@]}"; do
    if [[ "$file" =~ $pattern ]]; then
      MATCHED=1
      break
    fi
  done
  
  if [ $MATCHED -eq 0 ]; then
    echo "$file" >> "$PROD_FILES"
  fi
done < "$TEMP_FILE"

# Report findings
PROD_COUNT=$(wc -l < "$PROD_FILES" | tr -d ' ')
if [ "$PROD_COUNT" -gt 0 ]; then
  echo "❌ ERROR: Found $PROD_COUNT production file(s) modified:"
  echo ""
  cat "$PROD_FILES" | sed 's/^/  - /'
  echo ""
  echo "This branch must contain ONLY test and documentation changes."
  exit 1
fi

# Success case
TOTAL_COUNT=$(wc -l < "$TEMP_FILE" | tr -d ' ')
echo "✅ All $TOTAL_COUNT file(s) are test/doc/config files"
echo ""
echo "Changed files:"
cat "$TEMP_FILE" | sed 's/^/  ✓ /'

exit 0
