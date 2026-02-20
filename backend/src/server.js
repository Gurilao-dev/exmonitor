import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import firebaseService from './services/firebase.js';
import authRoutes from './routes/auth.js';
import deviceRoutes from './routes/devices.js';
import streamRoutes from './routes/stream.js';
import signalingHandler from './websocket/signaling.js';
import { requestLogger } from './middleware/rateLimit.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Create Fastify instance
const fastify = Fastify({
    logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
    },
    trustProxy: true, // Important for getting real IP behind proxies
});

/**
 * Register plugins
 */

// CORS
await fastify.register(cors, {
    origin: [
        'http://localhost:5173',
        'https://exmonitor.vercel.app',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-PreLogin-Token',
        'X-Register-Token',
        'X-Device-Token',
        'X-Stream-Token'
    ],
});

// Security headers
await fastify.register(helmet, {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'ws:', 'wss:'],
        },
    },
});

// WebSocket support
await fastify.register(websocket);

/**
 * Global hooks
 */

// Request logging
fastify.addHook('onRequest', requestLogger);

// Error handler
fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
        return reply.code(400).send({
            error: 'Validation error',
            details: error.validation
        });
    }

    return reply.code(error.statusCode || 500).send({
        error: error.message || 'Internal server error'
    });
});

/**
 * Initialize Firebase
 */
try {
    firebaseService.initialize();
} catch (error) {
    fastify.log.fatal('Failed to initialize Firebase:', error);
    process.exit(1);
}

/**
 * Register routes
 */

// Health check
fastify.get('/health', async () => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    };
});

// API routes
fastify.get('/', async () => {
    return {
        message: 'ExMonitor API is running',
        status: 'online',
        healthCheck: '/health'
    };
});


await fastify.register(authRoutes, { prefix: '/auth' });
await fastify.register(deviceRoutes, { prefix: '/devices' });
await fastify.register(streamRoutes, { prefix: '/stream' });

// WebSocket signaling
await fastify.register(signalingHandler);

/**
 * Start server
 */

const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: HOST });

        console.log('\n🟢 ExMonitor Backend Server Started');
        console.log(`📡 API: http://localhost:${PORT}`);
        console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws/signaling`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('\n✅ Server is ready to accept connections\n');

    } catch (err) {
        fastify.log.fatal(err);
        process.exit(1);
    }
};

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    try {
        await fastify.close();
        console.log('Server closed');
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
