/**
 * Simple in-memory rate limiter (good enough for single-instance deployments).
 * For multi-instance production, replace with Redis-based limiting.
 */
const DEFAULT_WINDOW_MS = 60 * 1000;  // 1 minute
const DEFAULT_MAX_REQUESTS = 30;       // 30 requests per window

// In-memory store: key → { count, resetAt }
const store = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (val.resetAt <= now) store.delete(key);
  }
}, 5 * 60 * 1000);

export function createRateLimiter(options = {}) {
  const windowMs  = options.windowMs  || DEFAULT_WINDOW_MS;
  const maxReqs   = options.maxRequests || DEFAULT_MAX_REQUESTS;
  const keyFn     = options.keyFn       || ((req) => req.ip || 'unknown');

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();

    if (!store.has(key) || store.get(key).resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const entry = store.get(key);
    entry.count++;

    if (entry.count > maxReqs) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', retryAfter);
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试',
        retryAfter,
      });
    }

    next();
  };
}
