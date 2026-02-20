import CryptoJS from 'crypto-js';

/**
 * Frontend Encryption Service
 * Uses Web Crypto API and CryptoJS for client-side encryption
 */

class EncryptionService {
    /**
     * Hash password with SHA-256 (before sending to server)
     * @param {string} password - Plain password
     * @returns {string} Hashed password
     */
    hashPassword(password) {
        return CryptoJS.SHA256(password).toString();
    }

    /**
     * Encrypt data with AES
     * @param {any} data - Data to encrypt
     * @param {string} key - Encryption key
     * @returns {string} Encrypted data
     */
    encryptAES(data, key) {
        const jsonData = JSON.stringify(data);
        return CryptoJS.AES.encrypt(jsonData, key).toString();
    }

    /**
     * Decrypt AES encrypted data
     * @param {string} encrypted - Encrypted data
     * @param {string} key - Decryption key
     * @returns {any} Decrypted data
     */
    decryptAES(encrypted, key) {
        const bytes = CryptoJS.AES.decrypt(encrypted, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decrypted);
    }

    /**
     * Generate random key
     * @param {number} length - Key length in bytes
     * @returns {string} Random key
     */
    generateKey(length = 32) {
        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate device fingerprint
     * @returns {string} Device fingerprint hash
     */
    async generateFingerprint() {
        const data = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screen: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        const jsonData = JSON.stringify(data);
        return this.hashPassword(jsonData);
    }
}

export default new EncryptionService();
