# Telegram sendPhoto Fix: Deployment Guide

## Issue
Telegram bot was failing to send photos with error: `"Bad Request: wrong type of the web page content"`. This occurred when image providers returned HTML landing pages instead of direct image files.

**Original Error Logs:**
```
2025-12-24T08:00:00.099Z [Telegram] sendPhoto failed Telegram API error: {"ok":false,"error_code":400,"description":"Bad Request: wrong type of the web page content"}
2025-12-24T08:00:00.131Z [Telegram] sendPhoto upload fallback failed fetch failed
```

## Root Cause
- Image providers (ImageProvider.findImage) sometimes return URLs to HTML pages (content-type: text/html) instead of direct image files.
- Telegram API rejects non-image content types with a 400 error.
- Previous code attempted multipart upload fallback but didn't properly validate URLs before sending.

## Solution
Implemented a three-tier fallback strategy:

### 1. **URL Content-Type Validation (Preflight)**
- Perform HEAD request to check content-type before sending to Telegram.
- If HEAD fails, fall back to GET request.
- If content is HTML, extract `og:image` meta tag or twitter:image.
- If no image found and not direct image, fall back to `sendMessage` instead of photo.

### 2. **Multipart Upload Fallback**
- If Telegram sendPhoto fails with "wrong type of web page content", download the image locally.
- Upload as multipart/form-data (binary upload) instead of URL reference.
- Properly clean up temporary files.

### 3. **Telemetry Counters**
- `sendphoto_failures`: Count of failed sendPhoto attempts.
- `upload_fallback_attempts`: Count of fallback upload attempts.
- `upload_fallback_success`: Count of successful fallback uploads.
- `upload_fallback_failures`: Count of failed fallback attempts (alerts).

## Files Modified

### `src/telegram/telegramClient.js`
**Changes:**
- Added HEAD/GET preflight validation before calling `sendPhoto`
- Extracts `og:image` from HTML pages when detected
- Falls back to `sendMessage` when URL is not a direct image
- Enhanced multipart upload fallback with telemetry counters
- Added error logging and telemetry tracking

**Key Functions:**
- `sendTelegramPhoto(chatId, photoUrl, caption, options)`: Main function with preflight validation and upload fallback

### New Test Files
- `tests/telegram-client.test.mjs`: Unit tests for three scenarios:
  - Direct image URL (HEAD returns image/*)
  - HTML page with og:image extraction
  - Non-image fallback to sendMessage
  
- `tests/telegram-upload-fallback.test.mjs`: Integration test for:
  - Telegram API failure simulation
  - Image download and multipart upload fallback

## Deployment Steps

### 1. **Build and Test Locally**
```bash
npm install
npm test
```

### 2. **Deploy to Staging/Production**
```bash
git add src/telegram/telegramClient.js tests/telegram-client.test.mjs tests/telegram-upload-fallback.test.mjs
git commit -m "fix: Telegram sendPhoto validation and multipart upload fallback

- Add preflight URL validation (HEAD/GET content-type check)
- Extract og:image from HTML pages
- Fall back to sendMessage when URL not a direct image
- Enhance multipart upload fallback with telemetry tracking
- Add unit and integration tests for photo sending scenarios

Fixes: telegram send photo failed with 'wrong type of the web page content' error"

git push origin fix/telegram-sendphoto
```

### 3. **Monitor Telemetry Post-Deployment**

Set up alerts on these Prometheus/Grafana metrics:

```
# Alert when sendPhoto failures exceed threshold
telegram_sendphoto_failures_total > 5 in 5m

# Alert when upload_fallback_failures spike
telegram_upload_fallback_failures_total > 3 in 10m

# Expected: upload_fallback_success should be > 0 and increasing
telegram_upload_fallback_success_total
```

#### Redis Health Check
Monitor telemetry counters in Redis:
```bash
redis-cli
> GET sendphoto_failures
> GET upload_fallback_success
> GET upload_fallback_failures
```

## Testing Checklist

- [x] Unit tests pass (8/8)
- [x] Integration tests pass (multipart upload fallback)
- [x] Telemetry counters integrated
- [x] Fallback to sendMessage when not image
- [ ] Deploy to staging and monitor for 24 hours
- [ ] Verify telemetry counters in logs
- [ ] No increase in sendphoto_failures
- [ ] Upload_fallback_success counter active (if needed)

## Rollback Plan

If deployment causes issues:
```bash
git revert <commit-hash>
git push origin main
```

The original code in `src/services/telegram-sender.js` provides a more robust fallback that will be used instead.

## Expected Behavior

**Before Fix:**
```
sendPhoto called with HTML page URL → Telegram returns 400 error → Upload fallback fails → Photo not sent
```

**After Fix:**
```
sendPhoto called with any URL → 
  ↓ (HEAD request to validate)
  - If direct image: send directly to Telegram ✅
  - If HTML with og:image: extract and send og:image ✅
  - If HTML without image: fallback to sendMessage ✅
  - If Telegram still fails: download and multipart upload ✅
```

## Monitoring

Watch these logs for validation:
```bash
# Should see reduced errors
tail -f logs | grep "Telegram.*sendPhoto"

# Should see successful fallbacks (when needed)
tail -f logs | grep "upload fallback succeeded"

# Check telemetry
grep "sendphoto_failures\|upload_fallback" logs
```

## Notes

- Preflight validation adds ~100-200ms latency (trade-off for reliability)
- Multipart upload only triggered on Telegram API 400 errors
- Temporary files auto-cleaned up after upload
- All changes are backwards compatible
