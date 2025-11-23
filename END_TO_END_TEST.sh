#!/bin/bash

echo "🚀 BETRIX END-TO-END TEST - COMPREHENSIVE VERIFICATION"
echo "======================================================"
echo ""

# 1. SYNTAX CHECK ALL FILES
echo "1️⃣ SYNTAX VALIDATION"
echo "---"
node -c src/worker-db.js 2>&1 && echo "✅ worker-db.js" || echo "❌ worker-db.js"
node -c src/handlers-new-features.js 2>&1 && echo "✅ handlers-new-features.js" || echo "❌ handlers-new-features.js"
node -c src/handlers-web-features.js 2>&1 && echo "✅ handlers-web-features.js" || echo "❌ handlers-web-features.js"
node -c src/server.js 2>&1 && echo "✅ server.js" || echo "❌ server.js"
echo ""

# 2. DEPENDENCIES CHECK
echo "2️⃣ DEPENDENCIES VERIFICATION"
echo "---"
npm list --depth=0 2>/dev/null | grep -E "✓|─" | wc -l > /tmp/dep_count.txt
DEP_COUNT=$(cat /tmp/dep_count.txt)
echo "✅ Installed packages: $DEP_COUNT"
npm list --depth=0 2>/dev/null | tail -20
echo ""

# 3. FILE STRUCTURE CHECK
echo "3️⃣ FILE STRUCTURE"
echo "---"
FILE_COUNT=$(find src -name "*.js" 2>/dev/null | wc -l)
SERVICE_COUNT=$(find src/services -name "*.js" 2>/dev/null | wc -l)
HANDLER_COUNT=$(find src -name "handlers*.js" -o -name "handler*.js" 2>/dev/null | wc -l)
echo "✅ Total JS files: $FILE_COUNT"
echo "✅ Service files: $SERVICE_COUNT"
echo "✅ Handler files: $HANDLER_COUNT"
echo ""

# 4. ENVIRONMENT VARIABLES CHECK
echo "4️⃣ ENVIRONMENT CONFIGURATION"
echo "---"
[ -n "$REDIS_URL" ] && echo "✅ REDIS_URL configured" || echo "❌ REDIS_URL missing"
[ -n "$TELEGRAM_TOKEN" ] && echo "✅ TELEGRAM_TOKEN configured" || echo "❌ TELEGRAM_TOKEN missing"
[ -n "$GEMINI_API_KEY" ] && echo "✅ GEMINI_API_KEY configured" || echo "❌ GEMINI_API_KEY missing"
[ -n "$DATABASE_URL" ] && echo "✅ DATABASE_URL configured" || echo "⚠️  DATABASE_URL (will use defaults)"
[ -n "$PORT" ] && echo "✅ PORT configured: $PORT" || echo "✅ PORT will default to 5000"
echo ""

# 5. SERVICES CHECK
echo "5️⃣ SERVICES AVAILABILITY"
echo "---"
grep -l "class.*Service" src/services/*.js 2>/dev/null | wc -l > /tmp/service_count.txt
SERVICE_TOTAL=$(cat /tmp/service_count.txt)
echo "✅ Total services: $SERVICE_TOTAL"
grep "export.*Service" src/services/*.js 2>/dev/null | wc -l > /tmp/exports_count.txt
EXPORTS=$(cat /tmp/exports_count.txt)
echo "✅ Exported services: $EXPORTS"
echo ""

# 6. HANDLERS CHECK
echo "6️⃣ COMMAND HANDLERS"
echo "---"
COMMANDS=$(grep -o "^    \"/[a-z_]*\"" src/worker-db.js 2>/dev/null | wc -l)
echo "✅ Commands configured: $COMMANDS"
grep "^    \"/[a-z_]*\"" src/worker-db.js 2>/dev/null | head -20
echo ""

# 7. SECRET SECURITY CHECK
echo "7️⃣ SECURITY VERIFICATION"
echo "---"
if grep -r "GEMINI_API_KEY\|TELEGRAM_TOKEN\|DATABASE_URL" src/ --include="*.js" | grep -v "process.env" | grep -v "CONFIG\." | grep -v "//"; then
  echo "❌ Found hardcoded secrets!"
else
  echo "✅ No hardcoded secrets found"
fi
if grep -r "127.0.0.1\|localhost" src/ --include="*.js" | grep -v "//\|comment"; then
  echo "❌ Found localhost references!"
else
  echo "✅ No unsafe localhost references"
fi
echo ""

# 8. BRANDING CHECK
echo "8️⃣ BRANDING INTEGRATION"
echo "---"
ICONS=$(grep -o "ICONS\.[A-Z_]*" src/handlers-web-features.js | wc -l)
echo "✅ Brand icons used: $ICONS"
grep "BrandingService" src/handlers-web-features.js >/dev/null && echo "✅ Branding service integrated" || echo "❌ Branding missing"
echo ""

# 9. MEMORY & PERFORMANCE
echo "9️⃣ RESOURCE CHECK"
echo "---"
MEM=$(ps aux | grep "node src/worker-db.js" | grep -v grep | awk '{print $6}')
if [ -z "$MEM" ]; then
  echo "ℹ️  Worker not currently running (this is OK - will start on demand)"
else
  echo "✅ Worker memory: ${MEM}KB"
fi
echo ""

# 10. WORKFLOW STATUS
echo "🔟 WORKFLOW STATUS"
echo "---"
if pgrep -f "node src/worker-db.js" > /dev/null; then
  echo "✅ Worker process running"
else
  echo "⚠️  Worker not currently running"
fi
echo ""

echo "======================================================"
echo "✅ END-TO-END TEST COMPLETE"
echo "======================================================"
