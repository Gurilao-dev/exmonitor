import firebaseService from '../services/firebase.js';

/**
 * Rate Limiting Middleware with IP Blocking
 * Tracks failed attempts and blocks IPs exceeding thresholds
 */

// In-memory store for rate limiting (use Redis in production)
const attempts = new Map();

const LIMITS = {
    GLOBAL_PASSWORD: { max: 50, window: 15 * 60 * 1000, blockDuration: 5 * 60 * 1000 }, // 50 attempts in 15min
    LOGIN: { max: 50, window: 15 * 60 * 1000, blockDuration: 5 * 60 * 1000 }, // 50 attempts in 15min
    REGISTER: { max: 20, window: 60 * 60 * 1000, blockDuration: 5 * 60 * 1000 }, // 20 attempts in 1hr
    API: { max: 1000, window: 60 * 1000, blockDuration: 0 } // 1000 requests per minute
};

/**
 * Get client IP from request
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.ip ||
        req.socket.remoteAddress;
}

/**
 * Check and increment attempt counter
 * @param {string} ip - Client IP
 * @param {string} type - Rate limit type
 * @returns {Object} { allowed: boolean, remaining: number }
 */
function checkRateLimit(ip, type) {
    const limit = LIMITS[type];
    const key = `${ip}:${type}`;
    const now = Date.now();

    if (!attempts.has(key)) {
        attempts.set(key, []);
    }

    const requestTimes = attempts.get(key);

    // Remove old attempts outside the window
    const validAttempts = requestTimes.filter(time => now - time < limit.window);
    attempts.set(key, validAttempts);

    if (validAttempts.length >= limit.max) {
        return {
            allowed: false,
            remaining: 0,
            retryAfter: Math.ceil((validAttempts[0] + limit.window - now) / 1000)
        };
    }

    validAttempts.push(now);
    attempts.set(key, validAttempts);

    return {
        allowed: true,
        remaining: limit.max - validAttempts.length,
        retryAfter: 0
    };
}

/**
 * Create rate limit middleware
 * @param {string} type - Rate limit type
 */
export function createRateLimiter(type) {
    return async function rateLimiter(req, reply) {
        try {
            const ip = getClientIP(req);

            // Check if IP is blocked in Firebase
            // Wrap in try/catch to ensure Firebase errors don't crash requests
            let isBlocked = false;
            try {
                isBlocked = await firebaseService.isIPBlocked(ip);
            } catch (err) {
                console.error('Firebase IP block check failed:', err);
                // Fail open - allow request if check fails
            }

            if (isBlocked) {
                return reply.code(403).send({
                    error: 'IP address blocked due to suspicious activity',
                    code: 'IP_BLOCKED'
                });
            }

            const result = checkRateLimit(ip, type);

            if (!result.allowed) {
                const limit = LIMITS[type];

                // Block IP if it exceeds limit
                if (limit.blockDuration > 0) {
                    // Don't await this to prevent blocking response
                    firebaseService.blockIP(
                        ip,
                        `Exceeded ${type} rate limit`,
                        limit.blockDuration
                    ).catch(err => console.error('Failed to block IP:', err));
                }

                reply.header('X-RateLimit-Limit', limit.max);
                reply.header('X-RateLimit-Remaining', 0);
                reply.header('X-RateLimit-Reset', result.retryAfter);
                reply.header('Retry-After', result.retryAfter);

                return reply.code(429).send({
                    error: 'Too many requests',
                    retryAfter: result.retryAfter,
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            }

            reply.header('X-RateLimit-Limit', LIMITS[type].max);
            reply.header('X-RateLimit-Remaining', result.remaining);
        } catch (error) {
            console.error('Rate limit middleware error:', error);
            // Allow request to proceed on internal middleware error
        }
    };
}

/**
 * Device fingerprinting middleware
 * Creates unique identifier for devices
 */
export async function deviceFingerprint(req, reply) {
    const fingerprint = {
        userAgent: req.headers['user-agent'],
        acceptLanguage: req.headers['accept-language'],
        acceptEncoding: req.headers['accept-encoding'],
        ip: getClientIP(req)
    };

    // Create hash of fingerprint
    const crypto = await import('crypto');
    const hash = crypto.default
        .createHash('sha256')
        .update(JSON.stringify(fingerprint))
        .digest('hex');

    req.fingerprint = hash;
}

/**
 * Log all requests
 */
export async function requestLogger(req, reply) {
    const ip = getClientIP(req);
    const logData = {
        ip,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        timestamp: new Date()
    };

    // Don't await - log asynchronously
    firebaseService.logAccess(logData).catch(err =>
        console.error('Logging error:', err)
    );
}
