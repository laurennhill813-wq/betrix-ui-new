# PR: Fix Telegram sendPhoto "wrong type of web page content" Error

## Description

Fixes critical Telegram bot photo sending failures caused by image providers returning HTML landing pages instead of direct image files.

**Error Fixed:**
```
[Telegram] sendPhoto failed Telegram API error: 
{"ok":false,"error_code":400,"description":"Bad Request: wrong type of the web page content"}
```

## Changes

### Core Fix: `src/telegram/telegramClient.js`
- ✅ Add preflight URL validation (HEAD/GET content-type checks)
- ✅ Extract `og:image` or `twitter:image` meta tags from HTML pages
- ✅ Fall back to `sendMessage` when URL is not a direct image
- ✅ Enhance multipart upload fallback with telemetry tracking
- ✅ Add comprehensive error logging

### Tests
- ✅ `tests/telegram-client.test.mjs`: Unit tests for photo sending scenarios
- ✅ `tests/telegram-upload-fallback.test.mjs`: Integration test for fallback behavior

### Documentation
- ✅ `TELEGRAM_SENDPHOTO_FIX.md`: Deployment guide with monitoring instructions

## Testing

All tests pass (8/8):
```bash
npm test
```

Test coverage includes:
- Direct image URL handling
- HTML page with og:image extraction
- Non-image content fallback to sendMessage
- Multipart upload fallback on Telegram API failure

## Telemetry Counters

New observability added:
- `sendphoto_failures`: Telegram sendPhoto API failures
- `upload_fallback_attempts`: Multipart upload fallback attempts
- `upload_fallback_success`: Successful multipart uploads
- `upload_fallback_failures`: Failed multipart upload attempts

## Monitoring

Post-deployment, monitor these metrics:
```
# Alert threshold: sendPhoto failures > 5 in 5min
redis-cli GET sendphoto_failures

# Alert threshold: upload fallback failures > 3 in 10min
redis-cli GET upload_fallback_failures

# Expected: should be > 0 if fallback is used
redis-cli GET upload_fallback_success
```

## Impact

- ✅ Fixes photo sending failures from HTML landing pages
- ✅ Improves reliability with multi-tier fallback strategy
- ✅ Backward compatible (no API changes)
- ✅ Low latency impact (~100-200ms preflight validation)
- ✅ Better observability with telemetry counters

## Deployment Steps

1. **Review:** Check changes in `src/telegram/telegramClient.js`
2. **Test:** `npm test` (all pass)
3. **Deploy:** Push to staging, monitor telemetry for 24h
4. **Verify:** Check logs for reduced `sendPhoto` failures and active counters
5. **Promote:** Merge to main/production

## Rollback

If issues occur:
```bash
git revert <commit-hash>
git push origin main
```

The fallback code in `src/services/telegram-sender.js` will handle legacy photo sends.

## Related Issues

- Telegram MediaTicker photo posting failures
- Image provider returning non-image HTML pages
- "wrong type of the web page content" API errors

## Checklist

- [x] Tests pass
- [x] No breaking changes
- [x] Telemetry integrated
- [x] Logging added
- [x] Documentation complete
- [ ] Deployed to staging
- [ ] 24h monitoring passed
- [ ] Promoted to production
