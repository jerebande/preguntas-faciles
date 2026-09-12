const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function authLimiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = attempts.get(key);

    if (!current || now - current.startedAt >= WINDOW_MS) {
        attempts.set(key, { startedAt: now, count: 1 });
        return next();
    }

    if (current.count >= MAX_ATTEMPTS) {
        res.setHeader("Retry-After", Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000));
        return res.status(429).json({ error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." });
    }

    current.count += 1;
    next();
}

setInterval(() => {
    const expiration = Date.now() - WINDOW_MS;
    for (const [key, entry] of attempts) {
        if (entry.startedAt < expiration) attempts.delete(key);
    }
}, WINDOW_MS).unref();

module.exports = { authLimiter };