import tokenService, { TOKEN_TYPES } from '../services/tokens.js';

/**
 * Authentication Middleware
 * Verifies JWT tokens for protected routes
 */

/**
 * Verify PRE_LOGIN_TOKEN
 */
export function verifyPreLoginToken(req, reply, done) {
    try {
        const token = req.headers['x-prelogin-token'];

        if (!token) {
            return reply.code(401).send({ error: 'PRE_LOGIN_TOKEN required' });
        }

        const decoded = tokenService.verifyToken(token, TOKEN_TYPES.PRE_LOGIN);
        req.preLoginData = decoded;
        done();
    } catch (error) {
        reply.code(401).send({ error: error.message });
    }
}

/**
 * Verify REGISTER_REQUEST_TOKEN
 */
export function verifyRegisterRequestToken(req, reply, done) {
    try {
        const token = req.headers['x-register-token'];

        if (!token) {
            return reply.code(401).send({ error: 'REGISTER_REQUEST_TOKEN required' });
        }

        const decoded = tokenService.verifyToken(token, TOKEN_TYPES.REGISTER_REQUEST);
        req.registerData = decoded;
        done();
    } catch (error) {
        reply.code(401).send({ error: error.message });
    }
}

/**
 * Verify SESSION_JWT
 */
export function verifySessionToken(req, reply, done) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'SESSION_JWT required' });
        }

        const token = authHeader.substring(7);
        const decoded = tokenService.verifyToken(token, TOKEN_TYPES.SESSION);

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            uniqueId: decoded.uniqueId
        };

        done();
    } catch (error) {
        reply.code(401).send({ error: error.message });
    }
}

/**
 * Verify DEVICE_TOKEN
 */
export function verifyDeviceToken(req, reply, done) {
    try {
        const token = req.headers['x-device-token'];

        if (!token) {
            return reply.code(401).send({ error: 'DEVICE_TOKEN required' });
        }

        const decoded = tokenService.verifyToken(token, TOKEN_TYPES.DEVICE);
        req.device = decoded;
        done();
    } catch (error) {
        reply.code(401).send({ error: error.message });
    }
}

/**
 * Verify STREAM_TOKEN
 */
export function verifyStreamToken(req, reply, done) {
    try {
        const token = req.headers['x-stream-token'];

        if (!token) {
            return reply.code(401).send({ error: 'STREAM_TOKEN required' });
        }

        const decoded = tokenService.verifyToken(token, TOKEN_TYPES.STREAM);
        req.stream = decoded;
        done();
    } catch (error) {
        reply.code(401).send({ error: error.message });
    }
}
