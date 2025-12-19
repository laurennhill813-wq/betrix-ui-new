// Unified state machine for user lifecycle
export const STATES = {
  NEW: "NEW",
  ONBOARDING: "ONBOARDING",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  ACTIVE: "ACTIVE",
  VVIP: "VVIP",
  IDLE: "IDLE",
};

export function normalizeState(s) {
  if (!s) return STATES.NEW;
  const up = String(s).toUpperCase();
  return STATES[up] || up;
}

// Redis helpers: keys
export function stateKey(userId) {
  return `user:${userId}`;
}

export function stateDataKey(userId) {
  return `user:${userId}:state_data`;
}

export async function getUserState(redis, userId) {
  const key = stateKey(userId);
  try {
    // Try string-style storage first
    const raw = await (typeof redis.get === "function" ? redis.get(key) : null);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return normalizeState(parsed.state || parsed.status || parsed.user_state);
      } catch {
        return normalizeState(raw);
      }
    }

    // Fallback: maybe stored as a hash (hgetall)
    if (typeof redis.hgetall === "function") {
      try {
        const obj = await redis.hgetall(key);
        if (obj && Object.keys(obj).length > 0) {
          return normalizeState(obj.state || obj.status || obj.user_state || obj.state || STATES.NEW);
        }
      } catch (e) {
        // ignore and fall through
      }
    }

    return STATES.NEW;
  } catch (e) {
    return STATES.NEW;
  }
}

export async function setUserState(redis, userId, state, ttlSeconds) {
  const key = stateKey(userId);
  try {
    // Write as JSON string for new-style callers
    let obj = {};
    try {
      const existingRaw = typeof redis.get === "function" ? await redis.get(key) : null;
      obj = existingRaw ? JSON.parse(existingRaw) : {};
    } catch {
      obj = {};
    }

    obj.state = normalizeState(state);
    obj.updatedAt = new Date().toISOString();

    const value = JSON.stringify(obj);
    if (ttlSeconds && Number(ttlSeconds) > 0) {
      if (typeof redis.setex === "function") {
        await redis.setex(key, Number(ttlSeconds), value);
      } else {
        await redis.set(key, value);
        if (typeof redis.expire === "function") await redis.expire(key, Number(ttlSeconds));
      }
    } else {
      await redis.set(key, value);
    }

    // Also write hash field for backwards compatibility with modules using hgetall/hset
    try {
      if (typeof redis.hset === "function") {
        // hset accepts (key, object) in our redis adapter
        await redis.hset(key, { state: obj.state, updatedAt: obj.updatedAt });
        if (ttlSeconds && Number(ttlSeconds) > 0 && typeof redis.expire === "function") {
          await redis.expire(key, Number(ttlSeconds));
        }
      }
    } catch (e) {
      // non-fatal
    }

    return obj;
  } catch (e) {
    throw e;
  }
}

export async function getStateData(redis, userId) {
  try {
    const raw = await redis.get(stateDataKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export async function setStateData(redis, userId, data, ttlSeconds) {
  try {
    const val = JSON.stringify(data || {});
    if (ttlSeconds && Number(ttlSeconds) > 0) {
      await redis.setex(stateDataKey(userId), Number(ttlSeconds), val);
    } else {
      await redis.set(stateDataKey(userId), val);
    }
    return data;
  } catch (e) {
    throw e;
  }
}

export async function clearStateData(redis, userId) {
  try {
    await redis.del(stateDataKey(userId));
  } catch (e) {
    // ignore
  }
}

export function isOnboardingState(state) {
  if (!state) return false;
  const s = String(state).toUpperCase();
  return s === STATES.ONBOARDING || s.startsWith("SIGNUP_") || s === "SIGNUP_NAME" || s === "SIGNUP_COUNTRY" || s === "SIGNUP_AGE";
}

export function isPaymentPendingState(state) {
  if (!state) return false;
  const s = String(state).toUpperCase();
  return s === STATES.PAYMENT_PENDING || s === "PAYMENT_PENDING";
}

