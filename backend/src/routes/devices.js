import firebaseService from '../services/firebase.js';
import tokenService from '../services/tokens.js';
import { verifySessionToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

/**
 * Device Management Routes
 */

export default async function deviceRoutes(fastify, options) {

    /**
     * POST /devices/register
     * Register new device (transmitter)
     * Returns DEVICE_TOKEN
     */
    fastify.post('/register',
        {
            preHandler: [createRateLimiter('API'), verifySessionToken]
        },
        async (request, reply) => {
            try {
                const { deviceName } = request.body;

                if (!deviceName || deviceName.trim().length === 0) {
                    return reply.code(400).send({ error: 'Device name required' });
                }

                // Generate pairing code
                let pairingCode;
                let codeExists = true;

                while (codeExists) {
                    pairingCode = tokenService.generatePairingCode();
                    // Check if code already exists
                    try {
                        await firebaseService.findDeviceByPairingCode(pairingCode);
                        codeExists = true;
                    } catch {
                        codeExists = false;
                    }
                }

                // Register device
                const device = await firebaseService.registerDevice(
                    request.user.userId,
                    deviceName.trim(),
                    pairingCode
                );

                // Generate DEVICE_TOKEN
                const deviceToken = tokenService.generateDeviceToken(
                    request.user.userId,
                    device.deviceId,
                    device.deviceName
                );

                return {
                    success: true,
                    device: {
                        deviceId: device.deviceId,
                        deviceName: device.deviceName,
                        pairingCode: device.pairingCode,
                        status: device.status
                    },
                    deviceToken
                };
            } catch (error) {
                console.error('Device registration error:', error);
                return reply.code(500).send({ error: 'Internal server error' });
            }
        }
    );

    /**
     * POST /devices/pair
     * Pair monitor with transmitter using pairing code
     */
    fastify.post('/pair',
        {
            preHandler: [createRateLimiter('API'), verifySessionToken]
        },
        async (request, reply) => {
            try {
                const { pairingCode } = request.body;

                if (!pairingCode || pairingCode.length !== 6) {
                    return reply.code(400).send({ error: 'Valid 6-digit pairing code required' });
                }

                // Find device by pairing code
                const device = await firebaseService.findDeviceByPairingCode(pairingCode);

                // Check if already paired
                if (device.pairedWith && device.pairedWith.includes(request.user.userId)) {
                    return reply.code(409).send({ error: 'Already paired with this device' });
                }

                // Pair device
                await firebaseService.pairDevice(device.deviceId, request.user.userId);

                return {
                    success: true,
                    device: {
                        deviceId: device.deviceId,
                        deviceName: device.deviceName,
                        status: device.status
                    }
                };
            } catch (error) {
                console.error('Device pairing error:', error);

                if (error.message === 'Invalid pairing code' || error.message === 'Pairing code expired') {
                    return reply.code(404).send({ error: error.message });
                }

                return reply.code(500).send({ error: 'Internal server error' });
            }
        }
    );

    /**
     * GET /devices/list
     * List user's devices or paired devices
     */
    fastify.get('/list',
        {
            preHandler: [createRateLimiter('API'), verifySessionToken]
        },
        async (request, reply) => {
            try {
                const { mode } = request.query; // 'transmitter' or 'monitor'

                let devices;
                if (mode === 'monitor') {
                    devices = await firebaseService.getPairedDevices(request.user.userId);
                } else {
                    devices = await firebaseService.getUserDevices(request.user.userId);
                }

                return {
                    success: true,
                    devices: devices.map(device => ({
                        deviceId: device.deviceId,
                        deviceName: device.deviceName,
                        status: device.status || 'offline',
                        pairingCode: mode === 'transmitter' ? device.pairingCode : undefined,
                        lastSeen: device.lastSeen
                    }))
                };
            } catch (error) {
                console.error('Device list error:', error);
                return reply.code(500).send({ error: 'Internal server error' });
            }
        }
    );

    /**
     * PATCH /devices/:deviceId/status
     * Update device online/offline status
     */
    fastify.patch('/:deviceId/status',
        {
            preHandler: [createRateLimiter('API'), verifySessionToken]
        },
        async (request, reply) => {
            try {
                const { deviceId } = request.params;
                const { status } = request.body;

                if (!status || !['online', 'offline', 'streaming'].includes(status)) {
                    return reply.code(400).send({
                        error: 'Valid status required (online, offline, streaming)'
                    });
                }

                // Verify device ownership
                const devices = await firebaseService.getUserDevices(request.user.userId);
                const device = devices.find(d => d.deviceId === deviceId);

                if (!device) {
                    return reply.code(404).send({ error: 'Device not found' });
                }

                await firebaseService.updateDeviceStatus(deviceId, status);

                return {
                    success: true,
                    message: 'Status updated'
                };
            } catch (error) {
                console.error('Status update error:', error);
                return reply.code(500).send({ error: 'Internal server error' });
            }
        }
    );

    /**
     * DELETE /devices/:deviceId
     * Remove device
     */
    fastify.delete('/:deviceId',
        {
            preHandler: [createRateLimiter('API'), verifySessionToken]
        },
        async (request, reply) => {
            try {
                const { deviceId } = request.params;

                // Verify device ownership
                const devices = await firebaseService.getUserDevices(request.user.userId);
                const device = devices.find(d => d.deviceId === deviceId);

                if (!device) {
                    return reply.code(404).send({ error: 'Device not found' });
                }

                // Delete device
                await firebaseService.devices.doc(deviceId).delete();

                // Delete pairing code
                if (device.pairingCode) {
                    await firebaseService.pairingCodes.doc(device.pairingCode).delete();
                }

                return {
                    success: true,
                    message: 'Device removed'
                };
            } catch (error) {
                console.error('Device deletion error:', error);
                return reply.code(500).send({ error: 'Internal server error' });
            }
        }
    );

    /**
     * GET /devices/:deviceId/stream-token
     * Get temporary stream token for WebRTC
     */
    fastify.get('/:deviceId/stream-token',
        {
            preHandler: [createRateLimiter('API'), verifySessionToken]
        },
        async (request, reply) => {
            try {
                const { deviceId } = request.params;

                // Get device info
                const deviceDoc = await firebaseService.devices.doc(deviceId).get();

                if (!deviceDoc.exists) {
                    return reply.code(404).send({ error: 'Device not found' });
                }

                const device = deviceDoc.data();

                // Verify user is either owner or paired monitor
                const isOwner = device.userId === request.user.userId;
                const isPaired = device.pairedWith && device.pairedWith.includes(request.user.userId);

                if (!isOwner && !isPaired) {
                    return reply.code(403).send({ error: 'Not authorized to stream this device' });
                }

                // Generate STREAM_TOKEN
                const streamToken = tokenService.generateStreamToken(
                    deviceId,
                    isPaired ? request.user.userId : null,
                    isOwner ? request.user.userId : null
                );

                return {
                    success: true,
                    streamToken,
                    expiresIn: '1h'
                };
            } catch (error) {
                console.error('Stream token error:', error);
                return reply.code(500).send({ error: 'Internal server error' });
            }
        }
    );
}
