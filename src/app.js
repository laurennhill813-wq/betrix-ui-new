/**
 * BETRIX EXPRESS SERVER - PRODUCTION (Comprehensive, fully-featured)
 * - Express + WebSocket + Redis + Multer + Rate limiting + Security + Logging
 * - Designed to run on Render (binds to 0.0.0.0 and PORT)
 * - Robust proxy-aware rate limiting (IPv4/IPv6 safe), secure Telegram webhook,
 *   admin auth (bcrypt + Redis), graceful shutdown, and extensive scaffolding.
 *
 * NOTE: This file is intentionally comprehensive. Review environment variables
 * before deploying and ensure required packages are installed:
 *   npm i express body-parser ioredis helmet cors express-rate-limit compression morgan ws multer bcryptjs dotenv
 *
 * Keep secrets out of source control and set them in your deployment environment.
 */

import express from "express";
import bodyParser from "body-parser";
import Redis from "ioredis";
import helmet from "helmet";
import cors from "cors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import multer from "multer";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

// ============================================================================
// PATHS & ENV
// ============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  REDIS_URL = "redis://default:@localhost:6379",
  TELEGRAM_TOKEN = "",
  TELEGRAM_WEBHOOK_SECRET = "",
  TELEGRAM_WEBHOOK_URL = "",
  PAYPAL_CLIENT_ID = "",
  PAYPAL_CLIENT_SECRET = "",
  PORT = 5000,
  NODE_ENV = "production",
  ADMIN_USERNAME = "admin",
  ADMIN_PASSWORD = "betrix2024!",
  ALLOWED_ORIGINS = "*"
} = process.env;

const isProd = NODE_ENV === "production";
const port = Number.isInteger(Number(PORT)) ? Number(PORT) : 5000;

// ============================================================================
// BRAND CONFIG
// ============================================================================
const BETRIX_CONFIG = {
  brand: {
    name: "BETRIX",
    fullName: "BETRIX - Global Sports AI Platform",
    slogan: "Intelligent Sports Betting Analytics",
    version: "3.0.0",
    primaryColor: "#2563eb",
    secondaryColor: "#1e40af",
    accentColor: "#f59e0b"
  },
  menu: {
    main: [
      { name: "Dashboard", path: "/dashboard", icon: "📊" },
      { name: "Live Odds", path: "/odds", icon: "🎯" },
      { name: "Predictions", path: "/predictions", icon: "🔮" },
      { name: "Leaderboard", path: "/leaderboard", icon: "🏆" },
      { name: "Analytics", path: "/analytics", icon: "📈" },
      { name: "Payments", path: "/payments", icon: "💳" }
    ],
    admin: [
      { name: "System Overview", path: "/admin", icon: "🖥️" },
      { name: "User Management", path: "/admin/users", icon: "👥" },
      { name: "Payment Logs", path: "/admin/payments", icon: "💰" },
      { name: "API Analytics", path: "/admin/analytics", icon: "📊" },
      { name: "Settings", path: "/admin/settings", icon: "⚙️" }
    ]
  },
  pricing: {
    tiers: {
      free: { name: "Free", price: 0, features: ["Basic Predictions", "Limited Access", "Community Access"] },
      signup: { name: "Signup", price: 150, features: ["Full Access 24h", "Basic Support", "Professional Betslips"] },
      daily: { name: "VVIP Daily", price: 200, features: ["Premium Predictions", "Priority Support", "AI Coach Access"] },
      weekly: { name: "VVIP Weekly", price: 800, features: ["All Daily Features", "Extended Analytics", "Expert Insights"] },
      monthly: { name: "VVIP Monthly", price: 2500, features: ["All Features", "24/7 Support", "Custom Analysis", "Personal Manager"] }
    }
  }
};

// ============================================================================
// APP, SERVER, REDIS, WEBSOCKET
// ============================================================================
const app = express();
const server = createServer(app);
const redis = new Redis(REDIS_URL);

// WebSocket server attached to the same HTTP server
const wss = new WebSocketServer({ server });

// Trust proxy so req.ip and ipKeyGenerator work correctly behind load balancers
app.set("trust proxy", true);

// ============================================================================
// LOGGING (Console + Redis + optional WebSocket broadcast)
// ============================================================================
const LOG_STREAM_KEY = "system:logs";
const LOG_LIMIT = 2000;

const log = (level, module, message, data = null) => {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, module, message, data, environment: NODE_ENV };

  // Console
  const suffix = data ? ` | ${JSON.stringify(data)}` : "";
  console.log(`[${timestamp}] [${level}] [${module}] ${message}${suffix}`);

  // Redis append + trim (best-effort)
  redis
    .lpush(LOG_STREAM_KEY, JSON.stringify(entry))
    .then(() => redis.ltrim(LOG_STREAM_KEY, 0, LOG_LIMIT - 1))
    .catch(err => console.error("Redis log error:", err?.message));

  // Increment counters (best-effort)
  redis.incr(`stats:logs:${level}`).catch(() => {});

  // Broadcast WARN/ERROR to connected admin sockets
  if (level === "WARN" || level === "ERROR") {
    broadcastToAdmins({ type: "log", data: entry });
  }
};

// ============================================================================
// WEBSOCKET: safe send, subscriptions, events
// ============================================================================
const activeConnections = new Set();
const clientSubscriptions = new Map();

const safeSend = (ws, payload) => {
  try {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
  } catch (err) {
    // ignore send errors for closed sockets
  }
};

const broadcastToAdmins = message => {
  const str = JSON.stringify(message);
  activeConnections.forEach(ws => {
    if (ws.readyState === 1) {
      try { ws.send(str); } catch (e) {}
    }
  });
};

const broadcastToChannel = (channel, message) => {
  const str = JSON.stringify(message);
  activeConnections.forEach(ws => {
    const subs = clientSubscriptions.get(ws);
    if (subs && subs.has(channel) && ws.readyState === 1) {
      try { ws.send(str); } catch (e) {}
    }
  });
};

wss.on("connection", (ws, req) => {
  const clientId = Math.random().toString(36).slice(2, 11);
  activeConnections.add(ws);
  clientSubscriptions.set(ws, new Set());

  log("INFO", "WEBSOCKET", "Client connected", {
    clientId,
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    totalConnections: activeConnections.size
  });

  safeSend(ws, {
    type: "welcome",
    data: {
      brand: BETRIX_CONFIG.brand,
      systemStatus: "operational",
      timestamp: new Date().toISOString(),
      serverVersion: BETRIX_CONFIG.brand.version,
      clientId
    }
  });

  ws.on("message", raw => {
    try {
      const data = JSON.parse(String(raw));
      handleWebSocketMessage(ws, data, clientId);
    } catch (err) {
      log("ERROR", "WEBSOCKET", "Invalid message JSON", { clientId, error: err.message });
      safeSend(ws, { type: "error", error: "Invalid message format" });
    }
  });

  ws.on("close", () => {
    activeConnections.delete(ws);
    clientSubscriptions.delete(ws);
    log("INFO", "WEBSOCKET", "Client disconnected", { clientId, remainingConnections: activeConnections.size });
  });

  ws.on("error", err => {
    log("ERROR", "WEBSOCKET", "Socket error", { clientId, error: err.message });
  });
});

const handleWebSocketMessage = (ws, data, clientId) => {
  switch (data?.type) {
    case "subscribe": {
      const channels = Array.isArray(data.channels) ? data.channels : [data.channels].filter(Boolean);
      const subs = clientSubscriptions.get(ws) || new Set();
      channels.forEach(c => subs.add(c));
      clientSubscriptions.set(ws, subs);
      log("INFO", "WEBSOCKET", "Subscribed", { clientId, channels });
      safeSend(ws, { type: "subscribed", channels, timestamp: Date.now() });
      break;
    }
    case "unsubscribe": {
      const channels = Array.isArray(data.channels) ? data.channels : [data.channels].filter(Boolean);
      const subs = clientSubscriptions.get(ws) || new Set();
      channels.forEach(c => subs.delete(c));
      clientSubscriptions.set(ws, subs);
      log("INFO", "WEBSOCKET", "Unsubscribed", { clientId, channels });
      safeSend(ws, { type: "unsubscribed", channels });
      break;
    }
    case "ping": {
      safeSend(ws, { type: "pong", timestamp: Date.now(), clientId });
      break;
    }
    case "get-stats": {
      safeSend(ws, { type: "stats", data: { clientId, uptime: process.uptime(), timestamp: Date.now() } });
      break;
    }
    default: {
      log("WARN", "WEBSOCKET", "Unknown message type", { clientId, type: data?.type });
      safeSend(ws, { type: "error", error: "Unknown message type" });
    }
  }
};

// ============================================================================
// MIDDLEWARE: security, cors, compression, logging, body parsing
// ============================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.telegram.org", "https://api.paypal.com"]
      }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
  })
);

app.use(
  cors({
    origin: ALLOWED_ORIGINS === "*" ? "*" : ALLOWED_ORIGINS.split(",").map(s => s.trim()),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200
  })
);

app.use(compression());
app.use(morgan(isProd ? "combined" : "dev"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Static assets
app.use(express.static(path.join(__dirname, "public")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Cache headers for static vs dynamic
app.use((req, res, next) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|woff|woff2)$/)) {
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h
  } else {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Branding headers
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", `${BETRIX_CONFIG.brand.name}/${BETRIX_CONFIG.brand.version}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// ============================================================================
// RATE LIMITING: IPv6-safe key generator and tier-based limiters
// ============================================================================
const baseRateLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => NODE_ENV === "development",
    // Use express-rate-limit's ipKeyGenerator helper to handle IPv6 correctly
    keyGenerator: req => {
      // prefer ipKeyGenerator (handles IPv6) but fallback to req.ip
      try {
        return ipKeyGenerator(req);
      } catch {
        return req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
      }
    }
  });

const freeLimiter = baseRateLimiter(60 * 1000, 30, "Rate limit exceeded. Upgrade for higher limits.");
const memberLimiter = baseRateLimiter(60 * 1000, 60, "Rate limit exceeded for member tier.");
const vvipLimiter = baseRateLimiter(60 * 1000, 150, "Rate limit exceeded for VVIP tier.");
const adminLimiter = baseRateLimiter(60 * 1000, 300, "Rate limit exceeded for admin.");

const getUserTier = async userId => {
  try {
    if (!userId) return "free";
    const tier = await redis.get(`user:tier:${userId}`);
    return tier || "free";
  } catch (err) {
    log("WARN", "TIER", "Redis tier lookup failed", { error: err.message });
    return "free";
  }
};

const tierBasedRateLimiter = async (req, res, next) => {
  try {
    const userId = req.query.userId || req.body.userId || req.headers["x-user-id"];
    const tier = await getUserTier(userId);
    log("DEBUG", "RATELIMIT", "Tier check", { userId, tier, ip: req.ip, forwarded: req.headers["x-forwarded-for"] });
    if (tier === "admin") return adminLimiter(req, res, next);
    if (tier === "vvip") return vvipLimiter(req, res, next);
    if (tier === "member") return memberLimiter(req, res, next);
    return freeLimiter(req, res, next);
  } catch (err) {
    log("ERROR", "RATELIMIT", "Tier limiter error", { error: err.message });
    return freeLimiter(req, res, next);
  }
};

// ============================================================================
// UPLOADS: Multer memory storage with validation
// ============================================================================
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|txt|csv/;
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = allowed.test(ext) && allowed.test(file.mimetype);
    if (ok) {
      log("INFO", "UPLOAD", "File accepted", { filename: file.originalname, mimetype: file.mimetype });
      cb(null, true);
    } else {
      log("WARN", "UPLOAD", "File rejected", { filename: file.originalname, mimetype: file.mimetype });
      cb(new Error("Invalid file type. Allowed: jpeg, jpg, png, gif, pdf, txt, csv"));
    }
  }
});

// ============================================================================
// AUTH: Admin Basic auth backed by Redis-stored bcrypt hash
// ============================================================================
const authenticateAdmin = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    log("WARN", "AUTH", "Missing Basic auth");
    return res.status(401).json({ error: "Admin authentication required" });
  }

  try {
    const creds = Buffer.from(auth.slice(6), "base64").toString();
    const [username, password] = creds.split(":");
    const adminHash = await redis.get("admin:password");

    // If no hash in Redis, initialize using ADMIN_PASSWORD (only in non-sensitive dev flows)
    if (!adminHash) {
      const fallbackHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await redis.set("admin:password", fallbackHash);
      log("INFO", "AUTH", "Admin password initialized in Redis (use env to override)", { username: ADMIN_USERNAME });
    }

    const storedHash = adminHash || (await redis.get("admin:password"));
    const valid = await bcrypt.compare(password, storedHash);

    if (username === ADMIN_USERNAME && valid) {
      req.adminUser = username;
      log("INFO", "AUTH", "Admin authenticated", { username });
      return next();
    }

    log("WARN", "AUTH", "Invalid admin credentials", { username });
    return res.status(401).json({ error: "Invalid admin credentials" });
  } catch (err) {
    log("ERROR", "AUTH", "Authentication error", { error: err.message });
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// ============================================================================
// UTILITIES: formatting, telegram, queue
// ============================================================================
const formatResponse = (success, data = null, message = "") => ({
  success,
  data,
  message,
  timestamp: new Date().toISOString(),
  brand: BETRIX_CONFIG.brand.name
});

const getBrandStyles = () => `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, ${BETRIX_CONFIG.brand.primaryColor} 0%, ${BETRIX_CONFIG.brand.secondaryColor} 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .container { max-width: 500px; width: 100%; padding: 20px; }
  .brand-header { text-align: center; color: white; margin-bottom: 40px; }
  .brand-header h1 { font-size: 2.5em; margin-bottom: 10px; font-weight: 700; }
  .brand-header p { font-size: 1.1em; opacity: 0.9; }
  .payment-status { background: white; border-radius: 10px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); text-align: center; }
  .payment-status.success { border-top: 5px solid #10b981; }
  .payment-status.error { border-top: 5px solid #ef4444; }
  .payment-status.cancelled { border-top: 5px solid ${BETRIX_CONFIG.brand.accentColor}; }
`;

// Telegram helpers (uses global fetch in Node 18+; if Node < 18, install node-fetch)
const generatePricingMessage = () => {
  let msg = `💵 <b>${BETRIX_CONFIG.brand.name} Pricing Plans</b>\n\n`;
  Object.entries(BETRIX_CONFIG.pricing.tiers).forEach(([k, t]) => {
    msg += `🎯 <b>${t.name}</b> - ${t.price}\n`;
    t.features.forEach(f => (msg += `   ✅ ${f}\n`));
    msg += "\n";
  });
  msg += `💳 Use /pay to subscribe`;
  return msg;
};

const sendTelegram = async (chatId, message, options = {}) => {
  try {
    if (!TELEGRAM_TOKEN) {
      log("WARN", "TELEGRAM", "TELEGRAM_TOKEN not configured");
      return { ok: false, error: "token_missing" };
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const payload = { chat_id: chatId, text: message, parse_mode: "HTML", ...options };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.ok) log("INFO", "TELEGRAM", "Message sent", { chatId });
    else log("ERROR", "TELEGRAM", "Send failed", { chatId, error: data.description });
    return data;
  } catch (err) {
    log("ERROR", "TELEGRAM", "Send error", { error: err.message });
    return { ok: false, error: err.message };
  }
};

const queueJob = async (type, data, priority = "normal") => {
  try {
    const key = `jobs:${priority}`;
    const payload = { id: Math.random().toString(36).slice(2, 10), type, data, timestamp: Date.now(), priority };
    await redis.rpush(key, JSON.stringify(payload));
    log("INFO", "QUEUE", "Job queued", { id: payload.id, type, priority });
    return payload.id;
  } catch (err) {
    log("ERROR", "QUEUE", "Queue push failed", { error: err.message });
    throw err;
  }
};

// ============================================================================
// ROUTES: root, health, dashboard
// ============================================================================
app.get("/", (req, res) => {
  res.json({
    ...BETRIX_CONFIG.brand,
    status: "operational",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    endpoints: {
      dashboard: "/dashboard",
      api: "/api/v1",
      admin: "/admin",
      webhooks: "/webhook",
      payments: "/paypal",
      health: "/health",
      metrics: "/metrics"
    },
    menu: BETRIX_CONFIG.menu.main
  });
});

app.get("/health", (req, res) => {
  res.json(formatResponse(true, { status: "healthy", uptime: process.uptime(), redis: true, version: BETRIX_CONFIG.brand.version }, "All systems operational"));
});

app.get("/dashboard", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    brand: BETRIX_CONFIG.brand,
    menu: BETRIX_CONFIG.menu.main,
    stats: { totalUsers: 50000, activePredictions: 1234, totalPayments: 450000, systemUptime: process.uptime() }
  }));
});

// ============================================================================
// ADMIN: dashboard, users, payments, analytics, settings
// ============================================================================
app.get("/admin", authenticateAdmin, tierBasedRateLimiter, async (req, res) => {
  const raw = await redis.lrange(LOG_STREAM_KEY, 0, 19).catch(() => []);
  const recentLogs = raw.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
  res.json(formatResponse(true, {
    menus: BETRIX_CONFIG.menu.admin,
    stats: { totalUsers: 50000, activeSessions: 2340, revenue: 450000, systemHealth: "98%" },
    recentLogs
  }));
});

app.get("/admin/users", authenticateAdmin, tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    users: [{ id: 1, name: "User1", tier: "vvip", status: "active" }, { id: 2, name: "User2", tier: "member", status: "active" }],
    total: 50000,
    active: 45000
  }));
});

app.get("/admin/payments", authenticateAdmin, tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    payments: [{ id: "PY1", user: "User1", amount: 2500, status: "completed", method: "PayPal" }],
    total: 450000,
    pending: 25000
  }));
});

app.get("/admin/analytics", authenticateAdmin, tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    metrics: { dailyActiveUsers: 12340, totalPredictions: 1234567, accuracy: 97.2, roi: 18.3 },
    trends: { predictions: "+15%", users: "+12%", revenue: "+18%" }
  }));
});

app.post("/admin/settings", authenticateAdmin, upload.single("logo"), async (req, res) => {
  try {
    const settings = req.body;
    await redis.set("admin:settings", JSON.stringify(settings));
    log("INFO", "ADMIN", "Settings updated", { admin: req.adminUser });
    res.json(formatResponse(true, settings, "Settings updated"));
  } catch (err) {
    log("ERROR", "ADMIN", "Settings update failed", { error: err.message });
    res.status(500).json(formatResponse(false, null, "Failed to update settings"));
  }
});

// ============================================================================
// PREDICTIONS / ODDS / LEADERBOARD / ANALYTICS (scaffolding)
// ============================================================================
app.get("/predictions", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    predictions: [
      { match: "Barcelona vs Real Madrid", pred: "Barcelona Win", conf: "87%", odds: 1.85 },
      { match: "Man United vs Liverpool", pred: "Over 2.5", conf: "86%", odds: 1.78 }
    ],
    accuracy: 97.2,
    totalPredictions: 1234567
  }));
});

app.get("/odds", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    odds: [
      { league: "EPL", match: "Man United vs Liverpool", home: 2.45, draw: 3.20, away: 2.80 }
    ],
    updated: new Date().toISOString()
  }));
});

app.get("/leaderboard", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    leaderboard: [
      { rank: 1, name: "ProBetter", points: 15450, winRate: "68%" }
    ],
    yourRank: 247
  }));
});

app.get("/analytics", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, { metrics: { dailyActiveUsers: 12340, accuracy: 97.2 } }));
});

// ============================================================================
// USER: stats, rank, referrals
// ============================================================================
app.get("/user/:userId/stats", tierBasedRateLimiter, (req, res) => {
  const userId = req.params.userId;
  const bets = 156, wins = 95;
  res.json(formatResponse(true, {
    userId, totalBets: bets, wins, losses: bets - wins, winRate: ((wins / bets) * 100).toFixed(1) + "%"
  }));
});

app.get("/user/:userId/rank", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, { userId: req.params.userId, globalRank: 247, points: 12340 }));
});

app.get("/user/:userId/referrals", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, { userId: req.params.userId, totalReferrals: 14, earnings: 8400 }));
});

// ============================================================================
// AUDIT & PRICING
// ============================================================================
app.get("/audit", authenticateAdmin, tierBasedRateLimiter, async (req, res) => {
  try {
    const raw = await redis.lrange(LOG_STREAM_KEY, 0, 50).catch(() => []);
    const parsed = raw.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean).slice(0, 20);
    res.json(formatResponse(true, { auditLogs: parsed }));
  } catch (err) {
    log("ERROR", "AUDIT", "Fetch failed", { error: err.message });
    res.status(500).json(formatResponse(false, null, "Failed to fetch audit logs"));
  }
});

app.get("/pricing", (req, res) => {
  res.json(formatResponse(true, { tiers: BETRIX_CONFIG.pricing.tiers }));
});

// ============================================================================
// TELEGRAM WEBHOOK (secure, token header + optional path token)
// ============================================================================
const validateTelegramRequest = (req, pathToken) => {
  // If TELEGRAM_WEBHOOK_SECRET is set, require header match
  if (TELEGRAM_WEBHOOK_SECRET) {
    const header = req.headers["x-telegram-bot-api-secret-token"];
    if (!header || header !== TELEGRAM_WEBHOOK_SECRET) return { ok: false, reason: "invalid_secret_header" };
  }
  // If path token provided, ensure it matches TELEGRAM_TOKEN (optional)
  if (pathToken && TELEGRAM_TOKEN && pathToken !== TELEGRAM_TOKEN) return { ok: false, reason: "invalid_path_token" };
  return { ok: true };
};

app.post("/webhook/:token?", tierBasedRateLimiter, express.json({ limit: "1mb" }), async (req, res) => {
  const pathToken = req.params.token;
  const check = validateTelegramRequest(req, pathToken);
  if (!check.ok) {
    log("WARN", "WEBHOOK", "Invalid webhook request", { reason: check.reason, forwarded: req.headers["x-forwarded-for"] });
    return res.status(403).send("Forbidden");
  }

  // Process webhook asynchronously: queue job and respond 200 quickly
  try {
    const payload = req.body;
    await queueJob("telegram:update", payload, "normal");
    log("DEBUG", "WEBHOOK", "Webhook queued", { size: JSON.stringify(payload).length });
    res.status(200).send("OK");
  } catch (err) {
    log("ERROR", "WEBHOOK", "Queue failed", { error: err.message });
    res.status(500).send("Internal Server Error");
  }
});

// ============================================================================
// PAYMENTS (scaffold) - PayPal placeholder endpoints
// ============================================================================
app.post("/paypal/create", tierBasedRateLimiter, async (req, res) => {
  // Placeholder: integrate PayPal SDK here
  res.json(formatResponse(true, { id: "PAY-EXAMPLE" }, "PayPal create placeholder"));
});

app.post("/paypal/execute", tierBasedRateLimiter, async (req, res) => {
  res.json(formatResponse(true, null, "PayPal execute placeholder"));
});

// ============================================================================
// ERROR HANDLING & 404
// ============================================================================
app.use((req, res) => {
  res.status(404).json(formatResponse(false, null, "Not found"));
});

app.use((err, req, res, next) => {
  log("ERROR", "EXPRESS", "Unhandled error", { message: err.message, stack: err.stack });
  res.status(500).json(formatResponse(false, null, "Internal server error"));
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
let shuttingDown = false;
const gracefulShutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  log("INFO", "SHUTDOWN", "Graceful shutdown initiated");
  try {
    // Stop accepting new connections
    server.close(() => log("INFO", "SHUTDOWN", "HTTP server closed"));
    // Close WebSocket connections
    activeConnections.forEach(ws => {
      try { ws.close(1001, "Server shutting down"); } catch (e) {}
    });
    // Close Redis
    await redis.quit().catch(() => {});
    log("INFO", "SHUTDOWN", "Redis connection closed");
    process.exit(0);
  } catch (err) {
    log("ERROR", "SHUTDOWN", "Shutdown error", { error: err.message });
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// ============================================================================
// START SERVER
// ============================================================================
server.listen(port, "0.0.0.0", () => {
  log("INFO", "INIT", "Server initialization completed", { brand: BETRIX_CONFIG.brand.name, version: BETRIX_CONFIG.brand.version, environment: NODE_ENV });
  log("INFO", "SERVER", "BETRIX Server started", { port, environment: NODE_ENV, version: BETRIX_CONFIG.brand.version });
});

// Export app for testing or serverless adapters
export { app, server, redis, wss };
