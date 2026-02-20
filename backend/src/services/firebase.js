import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Firebase Service - Database and Authentication
 */

class FirebaseService {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize Firebase Admin SDK
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        try {
            // For development: use service account key file
            // For production: use environment variables
            const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
                ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
                : {
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
                };

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
            });

            this.db = admin.firestore();
            this.auth = admin.auth();
            this.initialized = true;

            console.log('✅ Firebase initialized successfully');
        } catch (error) {
            console.error('❌ Firebase initialization error:', error.message);
            throw error;
        }
    }

    /**
     * Collections References
     */
    get users() {
        return this.db.collection('users');
    }

    get devices() {
        return this.db.collection('devices');
    }

    get pairingCodes() {
        return this.db.collection('pairingCodes');
    }

    get accessLogs() {
        return this.db.collection('accessLogs');
    }

    get blockedIPs() {
        return this.db.collection('blockedIPs');
    }

    /**
     * Create new user account
     * @param {string} email - User email
     * @param {string} password - Hashed password
     * @param {string} uniqueId - 5-character unique ID
     * @returns {Object} User data
     */
    async createUser(email, password, uniqueId) {
        try {
            // Create Firebase Auth user
            const userRecord = await this.auth.createUser({
                email,
                password,
                emailVerified: false
            });

            // Store user data in Firestore
            const userData = {
                uid: userRecord.uid,
                email,
                uniqueId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLogin: null,
                devices: []
            };

            await this.users.doc(userRecord.uid).set(userData);

            return { uid: userRecord.uid, email, uniqueId };
        } catch (error) {
            if (error.code === 'auth/email-already-exists') {
                throw new Error('Email already registered');
            }
            throw error;
        }
    }

    /**
     * Verify user credentials
     * @param {string} email - User email
     * @param {string} password - Password to verify
     * @returns {Object} User data
     */
    async verifyUser(email, password) {
        try {
            // Firebase Admin SDK doesn't have signInWithEmailAndPassword
            // We need to use client SDK for password verification
            // For now, we'll just check if user exists
            const userRecord = await this.auth.getUserByEmail(email);
            const userDoc = await this.users.doc(userRecord.uid).get();

            if (!userDoc.exists) {
                throw new Error('User data not found');
            }

            return {
                uid: userRecord.uid,
                ...userDoc.data()
            };
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                throw new Error('User not found');
            }
            throw error;
        }
    }

    /**
     * Update user last login
     * @param {string} uid - User ID
     */
    async updateLastLogin(uid) {
        await this.users.doc(uid).update({
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    /**
     * Register device
     * @param {string} userId - User ID
     * @param {string} deviceName - Device name
     * @param {string} pairingCode - 6-digit pairing code
     * @returns {Object} Device data
     */
    async registerDevice(userId, deviceName, pairingCode) {
        const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const deviceData = {
            deviceId,
            userId,
            deviceName,
            pairingCode,
            status: 'offline',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSeen: null,
            pairedWith: []
        };

        await this.devices.doc(deviceId).set(deviceData);

        // Store pairing code for lookup
        await this.pairingCodes.doc(pairingCode).set({
            deviceId,
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        return deviceData;
    }

    /**
     * Find device by pairing code
     * @param {string} pairingCode - 6-digit pairing code
     * @returns {Object} Device data
     */
    async findDeviceByPairingCode(pairingCode) {
        const codeDoc = await this.pairingCodes.doc(pairingCode).get();

        if (!codeDoc.exists) {
            throw new Error('Invalid pairing code');
        }

        const { deviceId, expiresAt } = codeDoc.data();

        // Check expiration
        if (expiresAt.toDate() < new Date()) {
            throw new Error('Pairing code expired');
        }

        const deviceDoc = await this.devices.doc(deviceId).get();

        if (!deviceDoc.exists) {
            throw new Error('Device not found');
        }

        return deviceDoc.data();
    }

    /**
     * Pair monitor with transmitter
     * @param {string} deviceId - Transmitter device ID
     * @param {string} monitorUserId - Monitor user ID
     */
    async pairDevice(deviceId, monitorUserId) {
        await this.devices.doc(deviceId).update({
            pairedWith: admin.firestore.FieldValue.arrayUnion(monitorUserId)
        });
    }

    /**
     * Update device status
     * @param {string} deviceId - Device ID
     * @param {string} status - Status: 'online' | 'offline' | 'streaming'
     */
    async updateDeviceStatus(deviceId, status) {
        await this.devices.doc(deviceId).update({
            status,
            lastSeen: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    /**
     * Get user's devices
     * @param {string} userId - User ID
     * @returns {Array} List of devices
     */
    async getUserDevices(userId) {
        const snapshot = await this.devices
            .where('userId', '==', userId)
            .get();

        return snapshot.docs.map(doc => doc.data());
    }

    /**
     * Get paired devices (monitor view)
     * @param {string} monitorUserId - Monitor user ID
     * @returns {Array} List of paired devices
     */
    async getPairedDevices(monitorUserId) {
        const snapshot = await this.devices
            .where('pairedWith', 'array-contains', monitorUserId)
            .get();

        return snapshot.docs.map(doc => doc.data());
    }

    /**
     * Log access event
     * @param {Object} logData - Log data
     */
    async logAccess(logData) {
        await this.accessLogs.add({
            ...logData,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    /**
     * Check if IP is blocked
     * @param {string} ip - IP address
     * @returns {boolean} True if blocked
     */
    async isIPBlocked(ip) {
        const doc = await this.blockedIPs.doc(ip).get();

        if (!doc.exists) {
            return false;
        }

        const { expiresAt } = doc.data();

        if (expiresAt && expiresAt.toDate() < new Date()) {
            // Expired, remove block
            await this.blockedIPs.doc(ip).delete();
            return false;
        }

        return true;
    }

    /**
     * Block IP address
     * @param {string} ip - IP address
     * @param {string} reason - Block reason
     * @param {number} durationMs - Duration in milliseconds (default: 1 hour)
     */
    async blockIP(ip, reason, durationMs = 60 * 60 * 1000) {
        await this.blockedIPs.doc(ip).set({
            reason,
            blockedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + durationMs)
        });
    }
}

const firebaseService = new FirebaseService();
export default firebaseService;
