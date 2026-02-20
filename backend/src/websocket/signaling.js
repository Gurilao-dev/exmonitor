import tokenService, { TOKEN_TYPES } from '../services/tokens.js';

const connections = new Map(); // Store active connections

export default async function signalingHandler(fastify) {

    fastify.get('/ws/signaling', { websocket: true }, (connection, request) => {
        let userId = null;
        let deviceId = null;
        let authenticated = false;

        connection.socket.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === 'auth' && !authenticated) {
                    const { streamToken } = data;
                    if (!streamToken) {
                        connection.socket.send(JSON.stringify({ type: 'error', message: 'Stream token required' }));
                        return connection.socket.close();
                    }

                    try {
                        const decoded = tokenService.verifyToken(streamToken, TOKEN_TYPES.STREAM);
                        userId = decoded.monitorId || decoded.transmitterId;
                        deviceId = decoded.deviceId;
                        authenticated = true;

                        const connectionKey = `${deviceId}:${userId}`;
                        connections.set(connectionKey, connection.socket);

                        connection.socket.send(JSON.stringify({ type: 'authenticated', userId, deviceId }));
                    } catch (error) {
                        connection.socket.send(JSON.stringify({ type: 'error', message: 'Invalid stream token' }));
                        return connection.socket.close();
                    }
                    return;
                }

                if (!authenticated) {
                    connection.socket.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
                    return;
                }

                switch (data.type) {
                    case 'offer':
                    case 'answer':
                    case 'ice-candidate':
                    case 'request-offer':
                        relayToPeers(deviceId, userId, data);
                        break;
                    case 'stop-stream':
                        broadcast(deviceId, { type: 'stream-stopped', deviceId, userId });
                        break;
                    case 'ping':
                        connection.socket.send(JSON.stringify({ type: 'pong' }));
                        break;
                }
            } catch (error) {
                console.error('[WebSocket] Msg Error:', error);
            }
        });

        connection.socket.on('close', () => {
            if (authenticated) {
                const connectionKey = `${deviceId}:${userId}`;
                connections.delete(connectionKey);
                broadcast(deviceId, { type: 'peer-disconnected', userId });
            }
        });
    });

    function relayToPeers(deviceId, senderId, data) {
        connections.forEach((socket, key) => {
            const [connDeviceId, connUserId] = key.split(':');
            if (connDeviceId === deviceId && connUserId !== senderId) {
                if (socket.readyState === 1) socket.send(JSON.stringify({ ...data, from: senderId }));
            }
        });
    }

    function broadcast(deviceId, data) {
        connections.forEach((socket, key) => {
            const [connDeviceId] = key.split(':');
            if (connDeviceId === deviceId) {
                if (socket.readyState === 1) socket.send(JSON.stringify(data));
            }
        });
    }
}

export { connections };
