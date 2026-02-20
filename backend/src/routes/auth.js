import tokenService from '../services/tokens.js';
import firebaseService from '../services/firebase.js';
import { verifyPreLoginToken, verifyRegisterRequestToken } from '../middleware/auth.js';
import { createRateLimiter, deviceFingerprint } from '../middleware/rateLimit.js';

export default async function authRoutes(fastify) {

  // === Global Access ===

  fastify.post('/validate-global',
    {
      preHandler: [createRateLimiter('GLOBAL_PASSWORD'), deviceFingerprint]
    },
    async (request, reply) => {
      const { globalPassword } = request.body;

      // Use environment variable or default fallback
      const EXPECTED_PASSWORD = (process.env.GLOBAL_PASSWORD || 'admin123').trim();

      if (!globalPassword || globalPassword.trim() !== EXPECTED_PASSWORD) {
        return reply.code(401).send({ error: 'Invalid global password' });
      }

      // Generate Pre-Login Token
      const preLoginToken = tokenService.generatePreLoginToken(request.ip);

      return {
        ok: true,
        preLoginToken
      };
    });

  fastify.get('/verify-global',
    {
      preHandler: [verifyPreLoginToken]
    },
    async (request, reply) => {
      return { ok: true };
    }
  );

  // === Registration Flow ===

  fastify.post('/request-register',
    {
      preHandler: [
        createRateLimiter('REGISTER'),
        deviceFingerprint,
        verifyPreLoginToken
      ]
    },
    async (request, reply) => {
      const { email } = request.body;
      // Basic validation
      if (!email || !email.includes('@')) {
        return reply.code(400).send({ error: 'Invalid email' });
      }

      // Generate Register Request Token
      // In real app, we might check if email is allowed
      const registerToken = tokenService.generateRegisterRequestToken(
        request.ip,
        request.headers['user-agent'] || 'unknown'
      );

      return {
        ok: true,
        registerToken
      };
    });

  fastify.post('/register',
    {
      preHandler: [verifyRegisterRequestToken]
    },
    async (request, reply) => {
      const { email, password, name } = request.body;

      try {
        // Verify register token presence (middleware should handle validation if added to route)
        // Ideally use preHandler: [verifyRegisterRequestToken] if strict flow needed
        // For now relying on simple implementation to unblock user

        const uniqueId = tokenService.generateUniqueId();

        // Create user in Firebase
        const user = await firebaseService.createUser(email, password, uniqueId);

        // Generate Session Token
        const sessionToken = tokenService.generateSessionToken(
          user.uid,
          user.email,
          user.uniqueId
        );

        return {
          ok: true,
          sessionToken,
          user: {
            uid: user.uid,
            email: user.email,
            uniqueId: user.uniqueId
          }
        };
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({ error: error.message });
      }
    });

  // === Login Flow ===

  fastify.post('/login',
    {
      preHandler: [
        createRateLimiter('LOGIN'),
        deviceFingerprint,
        verifyPreLoginToken
      ]
    },
    async (request, reply) => {
      const { email, password } = request.body;

      try {
        // Verify user credentials
        const user = await firebaseService.verifyUser(email, password);

        // Generate Session Token
        const sessionToken = tokenService.generateSessionToken(
          user.uid,
          user.email,
          user.uniqueId
        );

        // Update last login
        await firebaseService.updateLastLogin(user.uid);

        return {
          ok: true,
          sessionToken,
          user: {
            uid: user.uid,
            email: user.email,
            uniqueId: user.uniqueId
          }
        };
      } catch (error) {
        request.log.error(error);
        return reply.code(401).send({ error: 'Invalid email or password' });
      }
    });

  // === Session Management ===

  fastify.post('/logout', async (request, reply) => {
    // Client should discard tokens
    // Server could blacklist tokens here
    return { ok: true };
  });

  fastify.post('/refresh', async (request, reply) => {
    const { token } = request.body;
    try {
      const newToken = tokenService.refreshSessionToken(token);
      return {
        ok: true,
        sessionToken: newToken
      };
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  });
}
