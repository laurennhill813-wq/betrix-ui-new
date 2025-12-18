import logger from "../utils/logger.js";
import createRedisAdapter from "../utils/redis-adapter.js";

// Create a payment record in Postgres (supports drizzle or raw pg pool wrapper)
// dbClient: result of initDb() from src/db/client.js
// redis: redis-adapter instance
export async function createPaymentRecord(dbClient, redis, payment) {
  try {
    // normalize redis interface
    const r = redis ? createRedisAdapter(redis) : null;
    if (!payment) throw new Error("payment object required");

    const safeMetadata = (() => {
      try {
        if (!payment.metadata) return {};
        if (typeof payment.metadata === "string")
          return JSON.parse(payment.metadata);
        if (typeof payment.metadata === "object") return payment.metadata;
        return { value: String(payment.metadata) };
      } catch (e) {
        logger.warn(
          "createPaymentRecord: malformed metadata, coercing to object",
          e?.message || String(e),
        );
        return { _raw: String(payment.metadata) };
      }
    })();

    const row = {
      user_id: payment.userId || payment.user_id || null,
      provider:
        payment.provider || payment.paymentMethod || payment.processor || null,
      provider_ref:
        payment.providerRef ||
        payment.provider_ref ||
        payment.transactionId ||
        payment.transaction_id ||
        null,
      amount: payment.totalAmount || payment.amount || null,
      currency:
        payment.currency ||
        (payment.meta && payment.meta.currency) ||
        (safeMetadata && safeMetadata.currency) ||
        null,
      status: payment.status || "completed",
      metadata: safeMetadata,
    };

    // Persist to Postgres using drizzle if available
    if (dbClient && dbClient.type === "drizzle" && dbClient.db) {
      try {
        const { payments } = await import("../db/schema.js");
        const res = await dbClient.db
          .insert(payments)
          .values({
            user_id: row.user_id,
            provider: row.provider,
            provider_ref: row.provider_ref,
            amount: row.amount,
            currency: row.currency,
            status: row.status,
            created_at: new Date(),
          })
          .returning();
        const inserted = Array.isArray(res) ? res[0] : res;
        // Create quick redis mapping for provider_ref -> orderId
        if (row.provider_ref && r && r.setex) {
          try {
            await r.setex(
              `payment:by_provider_ref:${row.provider}:${row.provider_ref}`,
              30 * 24 * 60 * 60,
              JSON.stringify({ id: inserted.id }),
            );
          } catch (e) {
            /* ignore */
          }
        }
        return inserted;
      } catch (e) {
        logger.warn(
          "Drizzle insert failed, falling back to SQL",
          e?.message || String(e),
        );
      }
    }

    // Fallback: raw pg pool
    if (dbClient && (dbClient.pool || dbClient.query)) {
      try {
        const pool = dbClient.pool || dbClient;
        const q = `INSERT INTO payments (user_id, provider, provider_ref, amount, currency, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING *`;
        const vals = [
          row.user_id,
          row.provider,
          row.provider_ref,
          row.amount,
          row.currency,
          row.status,
        ];
        const clientQuery = dbClient.query
          ? dbClient.query
          : (sql, params) => pool.query(sql, params);
        const result = await clientQuery(q, vals);
        const inserted = result && result.rows ? result.rows[0] : null;
        if (row.provider_ref && r && r.setex) {
          try {
            await r.setex(
              `payment:by_provider_ref:${row.provider}:${row.provider_ref}`,
              30 * 24 * 60 * 60,
              JSON.stringify({ id: inserted && inserted.id }),
            );
          } catch (e) {
            /* ignore */
          }
        }
        return inserted;
      } catch (e) {
        logger.warn(
          "Raw pg insert failed, falling back to Redis",
          e?.message || String(e),
        );
        // allow function to continue to Redis fallback below
      }
    }

    // If no db configured, persist to Redis as fallback
    if (r && r.setex) {
      const key = `payments:log:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      await r.setex(key, 30 * 24 * 60 * 60, JSON.stringify(row));
      if (row.provider_ref)
        await r.setex(
          `payment:by_provider_ref:${row.provider}:${row.provider_ref}`,
          30 * 24 * 60 * 60,
          key,
        );
      return { _redis_key: key };
    }

    throw new Error("No DB or Redis available to persist payment");
  } catch (err) {
      try {
        logger.error("createPaymentRecord failed", err?.message || String(err), {
          stack: err?.stack,
          payment: typeof payment === "string" ? payment : JSON.stringify(payment),
        });
      } catch (logErr) {
        // fallback simple log
        logger.error("createPaymentRecord failed (logging error)", String(err));
      }
    throw err;
  }
}

/**
 * Update an existing payment record in Postgres.
 * lookup: { id } or { provider_ref, provider }
 * updates: { status, transaction_id, metadata }
 */
export async function updatePaymentRecord(dbClient, lookup = {}, updates = {}) {
  try {
    if (!dbClient) throw new Error("dbClient required");

    const { id, provider_ref, provider } = lookup;
    const { status, transaction_id, metadata } = updates;

    if (dbClient && dbClient.type === "drizzle" && dbClient.db) {
      const { payments } = await import("../db/schema.js");
      const upd = {};
      if (status) upd.status = status;
      if (transaction_id) upd.transaction_id = transaction_id;
      if (metadata) upd.metadata = metadata;

      let q = dbClient.db.update(payments).set(upd);
      if (id) q = q.where(payments.id.equals(Number(id)));
      else if (provider && provider_ref)
        q = q
          .where(payments.provider.equals(provider))
          .where(payments.provider_ref.equals(provider_ref));
      else throw new Error("Invalid lookup for updatePaymentRecord");

      const res = await q.returning();
      return Array.isArray(res) ? res[0] : res;
    }

    // raw pg fallback
    const pool = dbClient.pool || dbClient;
    const sets = [];
    const vals = [];
    let idx = 1;
    if (status) {
      sets.push(`status = $${idx++}`);
      vals.push(status);
    }
    if (transaction_id) {
      sets.push(`transaction_id = $${idx++}`);
      vals.push(transaction_id);
    }
    if (metadata) {
      sets.push(
        `metadata = jsonb_strip_nulls(coalesce(metadata, '{}'::jsonb) || $${idx++}::jsonb)`,
      );
      // Ensure metadata is sent as a JSON string to pg driver
      vals.push(typeof metadata === "string" ? metadata : JSON.stringify(metadata));
    }

    if (!sets.length) throw new Error("No updates provided");

    let where = "";
    if (id) {
      where = `WHERE id = $${idx++}`;
      vals.push(id);
    } else if (provider && provider_ref) {
      where = `WHERE provider = $${idx++} AND provider_ref = $${idx++}`;
      vals.push(provider, provider_ref);
    } else {
      throw new Error("Invalid lookup for updatePaymentRecord");
    }

    const q = `UPDATE payments SET ${sets.join(", ")}, updated_at = now() ${where} RETURNING *`;
    const { rows } = await pool.query(q, vals);
    return rows[0] || null;
  } catch (err) {
    logger.error("updatePaymentRecord failed", err?.message || String(err));
    throw err;
  }
}

export default { createPaymentRecord, updatePaymentRecord };
