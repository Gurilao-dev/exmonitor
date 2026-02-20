import firebaseService from '../services/firebase.js';
import { verifySessionToken, verifyStreamToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

/**
 * Streaming Routes
 * Manage active stream sessions and statistics
 */

export default async function streamRoutes(fastify, options) {

    /**
     * POST /stream/start
     * Start a new streaming session
     * Requires STREAM_TOKEN
     */
    fastify.post('/stream/start',
        {
            preHandler: [createRateLimiter('API'), verifyStreamToken]
        },
        async (request, reply) => {
            try {
                const { deviceId } = request.stream;
                const { startTime } = request.body;

                // Log stream start
                await firebaseService.logAccess({
                    type: 'STREAM_START',
                    deviceId,
                    userId: request.stream.userId, // Monitor or Transmitter ID
                    timestamp: startTime || new Date()
                });

                // Update device status
                await firebaseService.updateDeviceStatus(deviceId, 'streaming');

                return {
                    success: true,
                    message: 'Stream session started',
                    sessionId: request.stream.sessionId
                };
            } catch (error) {
                console.error('Stream start error:', error);
                return reply.code(500).send({ error: 'Internal server error' });
            }
        }
    );

    /**
     * POST /stream/stop
     * End a streaming session
     * Requires STREAM_TOKEN
     */
    fastify.post('/stream/stop',
        {
            preHandler: [createRateLimiter('API'), verifyStreamToken]
        },
        async (request, reply) => {
            try {
                const { deviceId } = request.stream;

                // Log stream stop
                await firebaseService.logAccess({
                    type: 'STREAM_STOP',
                    deviceId,
                    userId: request.stream.userId,
                    timestamp: new Date()
                });

                // Update device status
                await firebaseService.updateDeviceStatus(deviceId, 'online');

                return {
                    success: true,
                    message: 'Stream session stopped'
                };
            } catch (error) {
                console.error('Stream stop error:', error);
                return reply.code(500).send({ error: 'Internal server error' });
            }
        }
    );

    /**
     * GET /stream/:deviceId/stats
     * Get stream statistics
     * Requires SESSION_TOKEN (User must be owner or paired monitor)
     */
    fastify.get('/stream/:deviceId/stats',
        {
            preHandler: [createRateLimiter('API'), verifySessionToken]
        },
        async (request, reply) => {
            try {
                const { deviceId } = request.params;
                const userId = request.user.userId;

                // Verify access
                const devices = await firebaseService.getUserDevices(userId);
                const pairedDevices = await firebaseService.getPairedDevices(userId);

                const isOwner = devices.some(d => d.deviceId === deviceId);
                const isPaired = pairedDevices.some(d => d.deviceId === deviceId);

                if (!isOwner && !isPaired) {
                    return reply.code(403).send({ error: 'Not authorized to view stats' });
                }

                // Get device details for current status
                const deviceDoc = await firebaseService.devices.doc(deviceId).get();
                if (!deviceDoc.exists) {
                    return reply.code(404).send({ error: 'Device not found' });
                }
                const device = deviceDoc.data();

                // In a real app, we might aggregate WebRTC stats stored in Firebase/Redis
                // For now, return basic status
                return {
                    success: true,
                    stats: {
                        deviceId,
                        status: device.status,
                        lastSeen: device.lastSeen,
                        uptime: device.status === 'streaming' ? 'Active' : 'N/A'
                    }
                };
            } catch (error) {
                console.error('Stream stats error:', error);
                return reply.code(500).send({ error: 'Internal server error' });
            }
        }
    );
}
