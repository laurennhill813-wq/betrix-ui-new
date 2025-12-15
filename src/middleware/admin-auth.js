export function adminAuth(req, res, next) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return next(); // no admin key configured — allow access (safe for local)

  const provided = req.headers['x-admin-key'] || req.query.api_key || req.headers['authorization'];
  if (!provided) return res.status(401).json({ ok: false, error: 'missing admin key' });

  // support "Bearer <key>"
  const token = String(provided).startsWith('Bearer ') ? String(provided).slice(7).trim() : String(provided).trim();
  if (token !== key) return res.status(403).json({ ok: false, error: 'invalid admin key' });
  return next();
}

export default adminAuth;
