/**
 * User management service
 * Handles user profiles, referrals, roles, and subscriptions
 */

import { Logger } from "../utils/logger.js";
import { CONFIG } from "../config.js";
import createRedisAdapter from "../utils/redis-adapter.js";

const logger = new Logger("UserService");

class UserService {
  constructor(redis) {
    this.redis = createRedisAdapter(redis);
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    const key = `user:${userId}`;
    try {
      const type = await this.redis.type(key);
      if (!type || type === "none") return null;

      if (type === "string") {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      }

      if (type === "hash") {
        const obj = await this.redis.hgetall(key);
        // hgetall returns an object with all string values — return as-is
        return Object.keys(obj).length ? obj : null;
      }

      // For other types (list/set/zset) try to return null but log for diagnostics
      logger.warn("Get user: unexpected redis key type", { key, type });
      return null;
    } catch (err) {
      logger.error("Get user failed", err);
      return null;
    }
  }

  /**
   * Save/update user
   */
  async saveUser(userId, data) {
    const key = `user:${userId}`;
    try {
      // Read existing value in a type-safe way so we can merge fields if it's a hash
      let current = {};
      try {
        const type = await this.redis.type(key);
        if (type === "string") {
          const raw = await this.redis.get(key);
          current = raw ? JSON.parse(raw) : {};
        } else if (type === "hash") {
          current = (await this.redis.hgetall(key)) || {};
        }
      } catch (e) {
        // ignore and continue with empty current
        logger.warn("saveUser: failed to read existing key type", {
          key,
          err: e && e.message,
        });
      }

      const updated = {
        ...current,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      // Ensure the key is a plain string before writing
      try {
        await this.redis.del(key);
      } catch (e) {
        logger.warn("saveUser: failed to delete existing key before set", {
          key,
          err: e && e.message,
        });
      }

      await this.redis.set(key, JSON.stringify(updated));
      return updated;
    } catch (err) {
      logger.error("Save user failed", err);
      throw err;
    }
  }

  /**
   * Check if user is paid/member
   */
  isPaid(user) {
    return Boolean(user?.paid_at);
  }

  /**
   * Check if user is VVIP
   */
  isVVIP(user) {
    if (user?.role !== CONFIG.ROLES.VVIP) return false;
    if (!user?.vvip_expires_at) return true;
    return Date.now() < Number(user.vvip_expires_at);
  }

  /**
   * Check if user is admin
   */
  isAdmin(userId) {
    return String(userId) === String(CONFIG.TELEGRAM.ADMIN_ID);
  }

  /**
   * Check if user is ACTIVE
   * Accepts either a user object or userId
   */
  async isActive(userOrId) {
    try {
      if (!userOrId) return false;
      if (typeof userOrId === "object") {
        return String(userOrId.state || "").toUpperCase() === "ACTIVE";
      }
      const user = await this.getUser(userOrId);
      if (!user) return false;
      return String(user.state || "").toUpperCase() === "ACTIVE";
    } catch (e) {
      logger.warn("isActive check failed", e?.message || String(e));
      return false;
    }
  }

  /**
   * Defensive: if user is ACTIVE but onboarding keys exist, delete them.
   * Returns true if any onboarding key was removed.
   */
  async ensureNoOnboarding(userId) {
    try {
      if (!userId) return false;
      const user = await this.getUser(userId);
      if (!user) return false;
      if (String(user.state || "").toUpperCase() === "ACTIVE") {
        try {
          await this.redis.del(`user:${userId}:onboarding`);
          logger.info("ensureNoOnboarding: removed onboarding key for ACTIVE user", { userId });
          return true;
        } catch (e) {
          logger.debug("ensureNoOnboarding: failed to delete onboarding key", e?.message || String(e));
          return false;
        }
      }
      return false;
    } catch (e) {
      logger.warn("ensureNoOnboarding failed", e?.message || String(e));
      return false;
    }
  }

  /**
   * Generate referral code
   */
  generateReferralCode(userId) {
    const base = Buffer.from(String(userId))
      .toString("base64")
      .replace(/=+/g, "");
    const rand = Math.random().toString(36).slice(2, 6);
    return `${base}-${rand}`;
  }

  /**
   * Get or create referral code
   */
  async getOrCreateReferralCode(userId) {
    let user = await this.getUser(userId);
    if (!user?.referral_code) {
      const code = this.generateReferralCode(userId);
      user = await this.saveUser(userId, {
        referral_code: code,
        referrals_count: 0,
        rewards_points: 0,
      });
    }
    return user.referral_code;
  }

  /**
   * Apply referral code for new user
   */
  async applyReferral(code, newUserId) {
    try {
      if (!code) return null;

      const base = code.split("-")[0];
      let referrerId;

      try {
        referrerId = Buffer.from(base, "base64").toString("utf8");
      } catch {
        return null;
      }

      if (!/^\d+$/.test(referrerId)) return null;

      // Don't allow self-referrals
      if (String(referrerId) === String(newUserId)) return null;

      // Update referrer
      const refUser = (await this.getUser(referrerId)) || {};
      const count = Number(refUser.referrals_count || 0) + 1;
      const points = Number(refUser.rewards_points || 0) + 10;

      await this.saveUser(referrerId, {
        referrals_count: count,
        rewards_points: points,
      });

      // Track in leaderboard
      await this.redis.zincrby("leaderboard:referrals", 1, String(referrerId));

      // Update new user
      await this.saveUser(newUserId, {
        referred_by: referrerId,
        referral_used: code,
      });

      logger.info(`Referral applied: ${referrerId} -> ${newUserId}`);
      return referrerId;
    } catch (err) {
      logger.error("Apply referral failed", err);
      return null;
    }
  }

  /**
   * Set VVIP subscription
   */
  async setVVIPSubscription(userId, durationMs) {
    const expiresAt = Date.now() + durationMs;
    return this.saveUser(userId, {
      role: CONFIG.ROLES.VVIP,
      vvip_expires_at: expiresAt,
    });
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(type = "referrals", limit = 10) {
    try {
      const key =
        type === "referrals" ? "leaderboard:referrals" : "leaderboard:points";
      const topIds = await this.redis.zrevrange(
        key,
        0,
        limit - 1,
        "WITHSCORES",
      );

      const users = [];
      for (let i = 0; i < topIds.length; i += 2) {
        const userId = topIds[i];
        const score = topIds[i + 1];
        const user = await this.getUser(userId);

        if (user) {
          users.push({
            id: userId,
            name: user.name,
            country: user.country,
            score: parseInt(score),
          });
        }
      }

      return users;
    } catch (err) {
      logger.error("Get leaderboard failed", err);
      return [];
    }
  }
}

export { UserService };
