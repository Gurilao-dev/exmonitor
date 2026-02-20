import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class APIService {
    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Request interceptor - add tokens
        this.client.interceptors.request.use(
            (config) => {
                const sessionToken = localStorage.getItem('sessionToken');
                if (sessionToken) config.headers.Authorization = `Bearer ${sessionToken}`;

                const preLoginToken = localStorage.getItem('preLoginToken');
                if (preLoginToken) config.headers['X-PreLogin-Token'] = preLoginToken;

                const registerToken = localStorage.getItem('registerToken');
                if (registerToken) config.headers['X-Register-Token'] = registerToken;

                const deviceToken = localStorage.getItem('deviceToken');
                if (deviceToken) config.headers['X-Device-Token'] = deviceToken;

                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor - handle errors
        this.client.interceptors.response.use(
            (response) => response.data,
            (error) => {
                if (error.response) {
                    if (error.response.status === 401 && !error.config.url.includes('/login')) {
                        this.clearTokens();
                        window.location.href = '/';
                    }
                    const responseData = error.response.data;
                    return Promise.reject({
                        error: responseData.error || responseData.message || `Erro no servidor (${error.response.status})`
                    });
                } else if (error.request) {
                    return Promise.reject({ error: 'Erro de rede - servidor inacessível.' });
                } else {
                    return Promise.reject({ error: error.message || 'Ocorreu um erro inesperado' });
                }
            }
        );
    }

    clearTokens() {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('preLoginToken');
        localStorage.removeItem('registerToken');
        localStorage.removeItem('deviceToken');
    }

    // === Auth Endpoints ===
    async validateGlobalPassword(password) {
        const data = await this.client.post('/auth/validate-global', { globalPassword: password });
        localStorage.setItem('preLoginToken', data.preLoginToken);
        return data;
    }

    async requestRegister(email) {
        const data = await this.client.post('/auth/request-register', { email });
        localStorage.setItem('registerToken', data.registerToken);
        return data;
    }

    async register(email, password, name) {
        const data = await this.client.post('/auth/register', { email, password, name });
        localStorage.setItem('sessionToken', data.sessionToken);
        return data;
    }

    async login(email, password) {
        const data = await this.client.post('/auth/login', { email, password });
        localStorage.setItem('sessionToken', data.sessionToken);
        return data;
    }

    async logout() {
        try { await this.client.post('/auth/logout'); } catch (e) {}
        this.clearTokens();
    }

    // === Device Endpoints ===
    async registerDevice(deviceName) {
        return this.client.post('/devices/register', { deviceName });
    }

    async pairDevice(pairingCode) {
        return this.client.post('/devices/pair', { pairingCode });
    }

    async listDevices(mode = 'transmitter') {
        return this.client.get(`/devices/list?mode=${mode}`);
    }

    async updateDeviceStatus(deviceId, status) {
        return this.client.patch(`/devices/${deviceId}/status`, { status });
    }

    async deleteDevice(deviceId) {
        return this.client.delete(`/devices/${deviceId}`);
    }

    async getStreamToken(deviceId) {
        return this.client.get(`/devices/${deviceId}/stream-token`);
    }

    // === Stream Sync ===
    async startStreamSession(deviceId, startTime) {
        const tokenData = await this.getStreamToken(deviceId);
        return this.client.post('/stream/start', { startTime }, {
            headers: { 'X-Stream-Token': tokenData.streamToken }
        });
    }
}

export default new APIService();
