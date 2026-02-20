import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Token Service - Multi-layer token management
 * Handles 5 different token types for defense-in-depth security
 */

const TOKEN_TYPES = {
    PRE_LOGIN: 'PRE_LOGIN_TOKEN',
    REGISTER_REQUEST: 'REGISTER_REQUEST_TOKEN',
    SESSION: 'SESSION_JWT',
    DEVICE: 'DEVICE_TOKEN',
    STREAM: 'STREAM_TOKEN'
};

const TOKEN_EXPIRY = {
    PRE_LOGIN: '15m',
    REGISTER_REQUEST: '5m',
    SESSION: '7d',
    DEVICE: '30d',
    STREAM: '1h'
};

class TokenService {
    constructor() {
        // Enforce a stable secret if env var is missing to prevent invalid token loops
        this.secret = process.env.JWT_SECRET || 'exmonitor-stable-secret-key-2024';
        this.blacklist = new Set(); // In production, use Redis
    }

    /**
     * Generate PRE_LOGIN_TOKEN after global password validation
     * @param {string} ip - Client IP address
     * @returns {string} JWT token
     */
    generatePreLoginToken(ip) {
        return jwt.sign(
            {
                type: TOKEN_TYPES.PRE_LOGIN,
                ip,
                nonce: crypto.randomBytes(16).toString('hex')
            },
            this.secret,
            { expiresIn: TOKEN_EXPIRY.PRE_LOGIN }
        );
    }

    /**
     * Generate REGISTER_REQUEST_TOKEN for first registration step
     * @param {string} ip - Client IP address
     * @param {string} fingerprint - Device fingerprint
     * @returns {string} JWT token
     */
    generateRegisterRequestToken(ip, fingerprint) {
        return jwt.sign(
            {
                type: TOKEN_TYPES.REGISTER_REQUEST,
                ip,
                fingerprint,
                nonce: crypto.randomBytes(16).toString('hex')
            },
            this.secret,
            { expiresIn: TOKEN_EXPIRY.REGISTER_REQUEST }
        );
    }

    /**
     * Generate SESSION_JWT after successful login/registration
     * @param {string} userId - User ID from Firebase
     * @param {string} email - User email
     * @param {string} uniqueId - 5-character unique ID
     * @returns {string} JWT token
     */
    generateSessionToken(userId, email, uniqueId) {
        return jwt.sign(
            {
                type: TOKEN_TYPES.SESSION,
                userId,
                email,
                uniqueId,
                iat: Math.floor(Date.now() / 1000)
            },
            this.secret,
            { expiresIn: TOKEN_EXPIRY.SESSION }
        );
    }

    /**
     * Generate DEVICE_TOKEN for device registration
     * @param {string} userId - User ID
     * @param {string} deviceId - Device ID
     * @param {string} deviceName - Device name
     * @returns {string} JWT token
     */
    generateDeviceToken(userId, deviceId, deviceName) {
        return jwt.sign(
            {
                type: TOKEN_TYPES.DEVICE,
                userId,
                deviceId,
                deviceName,
                iat: Math.floor(Date.now() / 1000)
            },
            this.secret,
            { expiresIn: TOKEN_EXPIRY.DEVICE }
        );
    }

    /**
     * Generate STREAM_TOKEN for WebRTC session authorization
     * @param {string} deviceId - Device ID
     * @param {string} monitorId - Monitor user ID
     * @param {string} transmitterId - Transmitter user ID
     * @returns {string} JWT token
     */
    generateStreamToken(deviceId, monitorId, transmitterId) {
        return jwt.sign(
            {
                type: TOKEN_TYPES.STREAM,
                deviceId,
                monitorId,
                transmitterId,
                sessionId: crypto.randomBytes(16).toString('hex'),
                iat: Math.floor(Date.now() / 1000)
            },
            this.secret,
            { expiresIn: TOKEN_EXPIRY.STREAM }
        );
    }

    /**
     * Verify any token
     * @param {string} token - JWT token
     * @param {string} expectedType - Expected token type (optional)
     * @returns {Object} Decoded token payload
     * @throws {Error} If token invalid, expired, or blacklisted
     */
    verifyToken(token, expectedType = null) {
        // Check blacklist
        if (this.blacklist.has(token)) {
            throw new Error('Token has been revoked');
        }

        try {
            const decoded = jwt.verify(token, this.secret);

            // Verify token type if specified
            if (expectedType && decoded.type !== expectedType) {
                // If it's a SESSION token but we expected something else, it might be an older token format
                // but for security we should enforce the type check if it's provided.
                throw new Error(`Invalid token type. Expected ${expectedType}, got ${decoded.type || 'undefined'}`);
            }

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            }
            throw error;
        }
    }

    /**
     * Revoke a token (add to blacklist)
     * @param {string} token - Token to revoke
     */
    revokeToken(token) {
        this.blacklist.add(token);

        // In production, also store in Redis with TTL
        // redis.setex(`blacklist:${token}`, 60 * 60 * 24 * 7, '1');
    }

    /**
     * Generate unique 5-character ID for users
     * @returns {string} Unique 5-character code
     */
    generateUniqueId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 5; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    /**
     * Generate 6-digit pairing code
     * @returns {string} 6-digit code
     */
    generatePairingCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Refresh session token (extend expiry)
     * @param {string} oldToken - Current session token
     * @returns {string} New session token
     */
    refreshSessionToken(oldToken) {
        const decoded = this.verifyToken(oldToken, TOKEN_TYPES.SESSION);

        // Revoke old token
        this.revokeToken(oldToken);

        // Generate new token with same data
        return this.generateSessionToken(
            decoded.userId,
            decoded.email,
            decoded.uniqueId
        );
    }
}

export default new TokenService();
export { TOKEN_TYPES };
