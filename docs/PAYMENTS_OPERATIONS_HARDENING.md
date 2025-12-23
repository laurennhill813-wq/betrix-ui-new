# Payments Operations: M-Pesa & Crypto Hardening

## Overview

This document defines defensive programming patterns for payment flows: M-Pesa Lipana and NOWPayments crypto. Both require idempotency, retry safety, and exhaustive audit trails.

---

## 1. M-Pesa Lipana (MPESA) Defensive Patterns

### Safe Retry Loop with Jitter

**Problem:** Network timeout → retry storm → duplicate withdrawals.

**Solution:**

```typescript
/**
 * Initiate M-Pesa withdrawal with exponential backoff + jitter
 * Guaranteed idempotent via unique transaction ID
 */
export async function initiateWithdrawal(
  userId: string,
  amountKES: number,
  phoneNumber: string
): Promise<WithdrawalResult> {
  const txId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 1000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await mpesaClient.withdraw({
        transactionId: txId, // Unique key; MPESA de-dupes
        userId,
        phoneNumber,
        amountKES,
        callbackUrl: `${config.apiUrl}/webhooks/mpesa/${txId}`,
      });

      // Log successful initiation
      await auditLog.record({
        event: 'withdrawal_initiated',
        userId,
        txId,
        amount: amountKES,
        timestamp: new Date().toISOString(),
        attempt,
      });

      return result;
    } catch (error) {
      const isRetryable =
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.message.includes('timeout');

      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        await auditLog.record({
          event: 'withdrawal_failed',
          userId,
          txId,
          amount: amountKES,
          error: error.message,
          final: attempt === MAX_RETRIES - 1,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }

      // Exponential backoff + jitter
      const delayMs =
        BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(
        `[MPESA] Retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs.toFixed(
          0
        )}ms`,
        { txId, userId }
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Withdrawal initiation failed after ${MAX_RETRIES} attempts`);
}
```

### Webhook Idempotency

**Problem:** MPESA resends completion webhook if ACK is delayed → duplicate balance credit.

**Solution:**

```typescript
/**
 * Handle M-Pesa withdrawal completion webhook
 * Idempotent via event deduplication
 */
export async function handleMpesaCallback(
  req: express.Request,
  res: express.Response
) {
  const event = req.body;
  const eventId = event.transactionId; // Unique per MPESA response

  try {
    // Check idempotency: has this event been processed?
    const processed = await db.mpesaEvents.findOne({ eventId });
    if (processed) {
      console.log(`[MPESA] Duplicate webhook (already processed): ${eventId}`);
      res.status(200).json({ status: 'ack' }); // ACK anyway
      return;
    }

    // Validate webhook signature
    const isValid = validateMpesaSignature(req, config.mpesaWebhookSecret);
    if (!isValid) {
      console.error(`[MPESA] Invalid signature on webhook: ${eventId}`);
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    // Parse event
    const {
      transactionId,
      userId,
      amountKES,
      status, // 'success' | 'failed'
      errorMessage,
    } = event;

    // Update user balance atomically
    if (status === 'success') {
      const result = await db.users.updateOne(
        { id: userId },
        {
          $inc: { balanceKES: -amountKES }, // Deduct
          $push: {
            transactions: {
              type: 'withdrawal',
              amount: amountKES,
              status: 'completed',
              txId: transactionId,
              timestamp: new Date(),
            },
          },
        }
      );

      if (result.modifiedCount === 0) {
        throw new Error(`User not found or balance update failed: ${userId}`);
      }
    } else {
      // Failed withdrawal; reverse any holds
      await db.users.updateOne(
        { id: userId },
        {
          $pull: { pendingWithdrawals: { txId: transactionId } },
          $push: {
            transactions: {
              type: 'withdrawal_failed',
              amount: amountKES,
              reason: errorMessage,
              txId: transactionId,
              timestamp: new Date(),
            },
          },
        }
      );
    }

    // Record event (marks as processed)
    await db.mpesaEvents.insertOne({
      eventId,
      transactionId,
      userId,
      status,
      receivedAt: new Date(),
    });

    // Audit log
    await auditLog.record({
      event: `withdrawal_${status}`,
      userId,
      txId: transactionId,
      amount: amountKES,
      reason: errorMessage || undefined,
      timestamp: new Date().toISOString(),
    });

    // ACK to MPESA
    res.status(200).json({ status: 'ack' });
  } catch (error) {
    console.error('[MPESA] Webhook processing error:', error);

    // Log failure but still ACK to prevent retry storm
    await auditLog.record({
      event: 'withdrawal_webhook_error',
      error: (error as Error).message,
      eventId: req.body.transactionId,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({ status: 'ack', error: 'processing_failed' });
  }
}
```

### Reconciliation Job

**Problem:** Network glitch → MPESA says success, but our DB shows pending.

**Solution (Daily at 2 AM UTC):**

```typescript
/**
 * Reconcile pending M-Pesa withdrawals against MPESA status API
 */
export async function reconcileMpesaWithdrawals() {
  const pendingTxns = await db.users.aggregate([
    {
      $match: {
        'transactions.type': 'withdrawal',
        'transactions.status': 'pending',
      },
    },
    {
      $project: {
        id: 1,
        pending: {
          $filter: {
            input: '$transactions',
            as: 'tx',
            cond: {
              $and: [
                { $eq: ['$$tx.type', 'withdrawal'] },
                { $eq: ['$$tx.status', 'pending'] },
              ],
            },
          },
        },
      },
    },
  ]);

  for await (const user of pendingTxns) {
    for (const tx of user.pending) {
      try {
        const status = await mpesaClient.getTransactionStatus(tx.txId);

        // Reconcile
        if (status.state === 'completed') {
          await db.users.updateOne(
            { id: user.id, 'transactions.txId': tx.txId },
            {
              $set: { 'transactions.$.status': 'completed' },
            }
          );
          console.log(`[RECONCILE] Marked completed: ${tx.txId}`);
        } else if (status.state === 'failed') {
          // Refund balance
          await db.users.updateOne(
            { id: user.id, 'transactions.txId': tx.txId },
            {
              $set: { 'transactions.$.status': 'failed' },
              $inc: { balanceKES: tx.amount }, // Restore
            }
          );
          console.log(`[RECONCILE] Marked failed, refunded: ${tx.txId}`);
        }
        // else: still pending (MPESA hasn't processed)

        // Audit
        await auditLog.record({
          event: 'reconciliation_check',
          userId: user.id,
          txId: tx.txId,
          mpesaStatus: status.state,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[RECONCILE] Status check failed for ${tx.txId}:`, error);
        await auditLog.record({
          event: 'reconciliation_error',
          txId: tx.txId,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  console.log('[RECONCILE] M-Pesa reconciliation complete');
}
```

---

## 2. NOWPayments Crypto Engine (Hardening)

### Modular Client Router

**Problem:** Crypto address formats vary (Bitcoin, Ethereum, USDC). Client logic is monolithic.

**Solution:**

```typescript
export interface CryptoProvider {
  name: string;
  currencies: string[];
  createInvoice(
    amount: number,
    currency: string
  ): Promise<{ address: string; invoiceId: string }>;
  checkPayment(invoiceId: string): Promise<PaymentStatus>;
  validateAddress(address: string): boolean;
}

class NowpaymentsClient implements CryptoProvider {
  name = 'nowpayments';
  currencies = ['BTC', 'ETH', 'USDC', 'DAI'];

  async createInvoice(amount: number, currency: string) {
    if (!this.currencies.includes(currency)) {
      throw new Error(`Unsupported: ${currency}`);
    }
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': config.nowpaymentsKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: currency.toLowerCase(),
        description: 'BETRIX deposit',
        return_url: `${config.apiUrl}/crypto/success`,
      }),
    });
    if (!response.ok) throw new Error(`Invoice creation failed: ${response.statusText}`);
    const { id, address } = await response.json();
    return { invoiceId: id, address };
  }

  async checkPayment(invoiceId: string) {
    const response = await fetch(
      `https://api.nowpayments.io/v1/invoice/${invoiceId}`,
      {
        headers: { 'x-api-key': config.nowpaymentsKey },
      }
    );
    if (!response.ok) throw new Error('Payment check failed');
    const data = await response.json();
    return {
      status: data.payment_status, // 'waiting' | 'confirmed' | 'finished'
      amountReceived: data.amount_received,
      confirmations: data.confirmations,
    };
  }

  validateAddress(address: string): boolean {
    // Bitcoin address: 26–35 chars, starts with 1, 3, or bc1
    // Ethereum address: 0x + 40 hex chars
    return (
      /^[13bc1][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
      /^0x[a-fA-F0-9]{40}$/.test(address)
    );
  }
}

// Router
class CryptoRouter {
  private clients: Map<string, CryptoProvider> = new Map();

  register(provider: CryptoProvider) {
    this.clients.set(provider.name, provider);
  }

  getProvider(name: string): CryptoProvider {
    const provider = this.clients.get(name);
    if (!provider) throw new Error(`Unknown crypto provider: ${name}`);
    return provider;
  }

  listCurrencies(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [name, provider] of this.clients) {
      result[name] = provider.currencies;
    }
    return result;
  }
}

// Usage
const cryptoRouter = new CryptoRouter();
cryptoRouter.register(new NowpaymentsClient());
```

### Reconciliation Metrics

```typescript
/**
 * Track crypto payment reconciliation
 */
export async function recordCryptoMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    pending: await db.cryptoPayments.countDocuments({ status: 'waiting' }),
    confirmed: await db.cryptoPayments.countDocuments({
      status: 'confirmed',
    }),
    finished: await db.cryptoPayments.countDocuments({ status: 'finished' }),
    failed: await db.cryptoPayments.countDocuments({ status: 'failed' }),

    // Transition times
    avgWaitToPending: await calculateAvgTransition('waiting', 'confirmed'),
    avgPendingToFinished: await calculateAvgTransition('confirmed', 'finished'),

    // Stuck detection
    stuckFor30Min: await db.cryptoPayments.countDocuments({
      status: 'waiting',
      createdAt: { $lt: new Date(Date.now() - 30 * 60000) },
    }),
  };

  // Emit to Prometheus
  console.log('[CRYPTO METRICS]', metrics);

  // Alert on stuck payments
  if (metrics.stuckFor30Min > 0) {
    console.warn(
      `[ALERT] ${metrics.stuckFor30Min} crypto payments stuck for 30+ minutes`
    );
    // Trigger PagerDuty / Slack alert
  }

  return metrics;
}
```

---

## 3. Fraud & Velocity Controls

### Velocity Limits

```typescript
/**
 * Enforce rate limits per user per hour
 */
export async function checkVelocityLimit(
  userId: string,
  limit: { deposits: number; withdrawals: number }
) {
  const oneHourAgo = new Date(Date.now() - 3600000);

  const [deposits, withdrawals] = await Promise.all([
    db.transactions.countDocuments({
      userId,
      type: 'deposit',
      timestamp: { $gt: oneHourAgo },
    }),
    db.transactions.countDocuments({
      userId,
      type: 'withdrawal',
      timestamp: { $gt: oneHourAgo },
    }),
  ]);

  if (deposits >= limit.deposits) {
    throw new Error(
      `Deposit limit exceeded (${limit.deposits}/hour). Try again later.`
    );
  }
  if (withdrawals >= limit.withdrawals) {
    throw new Error(
      `Withdrawal limit exceeded (${limit.withdrawals}/hour). Try again later.`
    );
  }

  return { ok: true, depositsRemaining: limit.deposits - deposits };
}
```

### Device Fingerprinting

```typescript
/**
 * Detect anomalous access patterns (new device, new IP)
 */
export async function checkDeviceAnomaly(
  userId: string,
  currentDeviceFingerprint: string,
  currentIp: string
): Promise<boolean> {
  const knownDevices = await db.users.findOne(
    { id: userId },
    { projection: { knownDeviceFingerprints: 1, knownIps: 1 } }
  );

  const isNewDevice = !knownDevices?.knownDeviceFingerprints?.includes(
    currentDeviceFingerprint
  );
  const isNewIp = !knownDevices?.knownIps?.includes(currentIp);

  if (isNewDevice || isNewIp) {
    console.warn(`[ANOMALY] New device or IP for ${userId}`, {
      device: isNewDevice,
      ip: isNewIp,
      fingerprint: currentDeviceFingerprint,
      ip: currentIp,
    });

    // Log anomaly; potentially throttle
    await auditLog.record({
      event: 'device_anomaly',
      userId,
      isNewDevice,
      isNewIp,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  return false;
}
```

---

## 4. PII Handling & Compliance

### Minimized Storage

**Store ONLY:**
- M-Pesa phone number (hashed for lookups, encrypted in DB)
- Crypto wallet address (public; no PII)

**DO NOT store:**
- Full names (use user ID)
- Email (if not verified)
- KYC/AML docs (redirect to compliance partner)
- Payment method (volatile)

### Encryption at Rest

```typescript
import crypto from 'crypto';

const CIPHER_ALGO = 'aes-256-gcm';
const encryptionKey = crypto.scryptSync(config.dbEncryptionKey, 'salt', 32);

function encryptPII(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(CIPHER_ALGO, encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Return: iv + ciphertext + authTag (base64)
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

function decryptPII(encoded: string): string {
  const buffer = Buffer.from(encoded, 'base64');
  const iv = buffer.slice(0, 16);
  const ciphertext = buffer.slice(16, buffer.length - 16);
  const authTag = buffer.slice(buffer.length - 16);
  const decipher = crypto.createDecipheriv(CIPHER_ALGO, encryptionKey, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
```

### Access Logs

```typescript
/**
 * Audit all access to encrypted PII
 */
export async function logPIIAccess(userId: string, accessor: string) {
  await db.piiAccessLog.insertOne({
    userId,
    accessor, // service name or user ID
    timestamp: new Date(),
    ip: getCurrentIp(), // from request context
    reason: 'withdrawal_initiation', // why accessed?
  });
}
```

---

## 5. Operations Checklist

### Pre-Launch
- [ ] Idempotency keys tested (duplicate requests return same result)
- [ ] Webhook retry logic tested (ACK on duplicate)
- [ ] Reconciliation job runs daily without errors
- [ ] Velocity limits enforced and tested
- [ ] Device fingerprinting + anomaly detection live
- [ ] PII encrypted at rest + audit logs active
- [ ] Secrets (API keys) in environment variables, never in code
- [ ] Payment status transition times monitored

### Ongoing
- [ ] Daily: Run MPESA reconciliation
- [ ] Hourly: Check crypto stuck-payment alerts
- [ ] Hourly: Review velocity limit hits (anomaly?)
- [ ] Weekly: Audit access logs for PII reads
- [ ] Monthly: Security audit (dependency updates, key rotation)

### Incident Response
- [ ] Stuck withdrawal? Check webhook logs; manually ACK if needed
- [ ] Duplicate charge? Refund immediately; audit log root cause
- [ ] High velocity anomaly? Block user; send verification email
- [ ] Crypto address mismatch? Halt deposits; escalate to ops

---

## 6. Integration Examples

### Withdrawal Initiation
```typescript
app.post('/api/withdrawals/mpesa', async (req, res) => {
  const { userId, amountKES, phoneNumber } = req.body;

  try {
    // Velocity check
    await checkVelocityLimit(userId, { deposits: 5, withdrawals: 3 });

    // Anomaly check
    const isAnomaly = await checkDeviceAnomaly(
      userId,
      req.deviceFingerprint,
      req.ip
    );
    if (isAnomaly) {
      return res.status(429).json({ error: 'Unusual activity; try again later' });
    }

    // Initiate with retries
    const result = await initiateWithdrawal(userId, amountKES, phoneNumber);

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
```

---

**Version:** 1.0  
**Last Updated:** 2025-12-23  
**Owner:** BETRIX Payments & Operations  
**Related:** QUALITY_GATES.md, FIXTURE_ANALYSIS_EXPLAINABILITY.md
