const getWsUrl = () => {
    let url = import.meta.env.VITE_WS_URL || window.location.origin;
    url = url.replace(/^http/, 'ws');
    if (window.location.protocol === 'https:' && !url.startsWith('wss:')) {
        url = url.replace(/^ws:/, 'wss:');
    }
    return url;
};

const WS_URL = getWsUrl();
const STUN_SERVER = import.meta.env.VITE_STUN_SERVER || 'stun:stun.l.google.com:19302';

class WebRTCService {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.authenticated = false;
        this.deviceId = null;
        this.onStreamCallback = null;
        this.onErrorCallback = null;
        this.onDisconnectCallback = null;

        this.config = {
            iceServers: [{ urls: STUN_SERVER }],
            iceCandidatePoolSize: 10,
        };
    }

    connect(streamToken, deviceId) {
        return new Promise((resolve, reject) => {
            this.deviceId = deviceId;
            const wsEndpoint = `${WS_URL}/ws/signaling`.replace(/\/+/g, '/').replace('ws:/', 'ws://').replace('wss:/', 'wss://');

            try {
                this.socket = new WebSocket(wsEndpoint);
            } catch (err) {
                return reject(new Error(`WebSocket error: ${err.message}`));
            }

            this.socket.onopen = () => {
                this.socket.send(JSON.stringify({ type: 'auth', streamToken }));
            };

            this.socket.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    await this.handleSignalingMessage(data, resolve, reject);
                } catch (error) {
                    console.error('[WebRTC] Msg Error:', error);
                }
            };

            this.socket.onerror = (error) => {
                reject(new Error('Signaling connection failed'));
            };

            this.socket.onclose = (event) => {
                this.cleanup();
                if (this.onDisconnectCallback) this.onDisconnectCallback();
                if (!this.authenticated) reject(new Error('Auth failed or server closed'));
            };
        });
    }

    async handleSignalingMessage(data, resolve, reject) {
        switch (data.type) {
            case 'authenticated':
                this.authenticated = true;
                if (resolve) resolve();
                break;
            case 'offer':
                await this.handleOffer(data);
                break;
            case 'answer':
                await this.handleAnswer(data);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(data);
                break;
            case 'request-offer':
                if (this.localStream) {
                    await this.createOffer();
                }
                break;
            case 'stream-stopped':
            case 'peer-disconnected':
                if (this.onDisconnectCallback) this.onDisconnectCallback();
                this.stopStream();
                break;
            case 'error':
                if (reject && !this.authenticated) reject(new Error(data.message));
                break;
        }
    }

    requestOffer() {
        if (this.socket && this.socket.readyState === 1) {
            this.socket.send(JSON.stringify({ type: 'request-offer' }));
        }
    }

    async startLocalStream(customConstraints = null) {
        if (!window.isSecureContext) throw new Error('HTTPS required for camera');

        const constraints = customConstraints || {
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: { echoCancellation: true, noiseSuppression: true }
        };

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            return this.localStream;
        } catch (error) {
            // Fallback to simple video if audio fails
            if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                return this.localStream;
            }
            throw error;
        }
    }

    createPeerConnection() {
        if (this.peerConnection) this.peerConnection.close();

        this.peerConnection = new RTCPeerConnection(this.config);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socket?.readyState === 1) {
                this.socket.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate
                }));
            }
        };

        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            if (this.onStreamCallback) this.onStreamCallback(this.remoteStream);
        };

        return this.peerConnection;
    }

    async createOffer() {
        this.createPeerConnection();
        const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await this.peerConnection.setLocalDescription(offer);
        this.socket.send(JSON.stringify({ type: 'offer', offer }));
    }

    async handleOffer(data) {
        this.createPeerConnection();
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.socket.send(JSON.stringify({ type: 'answer', answer }));
    }

    async handleAnswer(data) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    async handleIceCandidate(data) {
        if (this.peerConnection) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }

    onStream(callback) { this.onStreamCallback = callback; }
    onDisconnect(callback) { this.onDisconnectCallback = callback; }

    stopStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.remoteStream = null;
    }

    disconnect() {
        this.stopStream();
        if (this.socket) {
            if (this.socket.readyState === 1) {
                this.socket.send(JSON.stringify({ type: 'stop-stream' }));
            }
            this.socket.close();
        }
    }

    cleanup() {
        this.stopStream();
        this.authenticated = false;
    }
}

export default WebRTCService;
