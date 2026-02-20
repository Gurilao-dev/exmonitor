import crypto from 'crypto';

/**
 * Encryption Service - AES-256-GCM + RSA-OAEP
 * Provides end-to-end encryption for sensitive data transmission
 */

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.rsaAlgorithm = 'rsa';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.authTagLength = 16; // 128 bits
  }

  /**
   * Generate RSA key pair for initial handshake
   */
  generateRSAKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    return { publicKey, privateKey };
  }

  /**
   * Generate random AES session key
   */
  generateSessionKey() {
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Encrypt data with AES-256-GCM
   * @param {string} plaintext - Data to encrypt
   * @param {Buffer} key - AES session key
   * @returns {Object} { encrypted, iv, authTag }
   */
  encryptAES(plaintext, key) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt data with AES-256-GCM
   * @param {string} encrypted - Encrypted data
   * @param {Buffer} key - AES session key
   * @param {string} iv - Initialization vector
   * @param {string} authTag - Authentication tag
   * @returns {string} Decrypted plaintext
   */
  decryptAES(encrypted, key, iv, authTag) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Encrypt session key with RSA public key
   * @param {Buffer} sessionKey - AES session key
   * @param {string} publicKey - RSA public key in PEM format
   * @returns {string} Encrypted session key (base64)
   */
  encryptSessionKeyRSA(sessionKey, publicKey) {
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      sessionKey
    );
    return encrypted.toString('base64');
  }

  /**
   * Decrypt session key with RSA private key
   * @param {string} encryptedKey - Encrypted session key (base64)
   * @param {string} privateKey - RSA private key in PEM format
   * @returns {Buffer} Decrypted AES session key
   */
  decryptSessionKeyRSA(encryptedKey, privateKey) {
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(encryptedKey, 'base64')
    );
    return decrypted;
  }

  /**
   * Create HMAC signature for replay attack prevention
   * @param {string} data - Data to sign
   * @param {Buffer} key - Signing key
   * @returns {string} HMAC signature (hex)
   */
  createSignature(data, key) {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify HMAC signature
   * @param {string} data - Original data
   * @param {string} signature - HMAC signature
   * @param {Buffer} key - Signing key
   * @returns {boolean} Verification result
   */
  verifySignature(data, signature, key) {
    const expectedSignature = this.createSignature(data, key);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Encrypt payload with timestamp and signature
   * @param {Object} payload - Data to encrypt
   * @param {Buffer} sessionKey - AES session key
   * @returns {Object} Encrypted package
   */
  encryptPayload(payload, sessionKey) {
    const timestamp = Date.now();
    const dataWithTimestamp = JSON.stringify({
      ...payload,
      timestamp
    });

    const encrypted = this.encryptAES(dataWithTimestamp, sessionKey);
    const signature = this.createSignature(encrypted.encrypted, sessionKey);

    return {
      ...encrypted,
      signature,
      timestamp
    };
  }

  /**
   * Decrypt and verify payload
   * @param {Object} encryptedPackage - Encrypted package
   * @param {Buffer} sessionKey - AES session key
   * @param {number} maxAge - Maximum age in milliseconds (default: 30s)
   * @returns {Object} Decrypted payload
   * @throws {Error} If signature invalid or timestamp expired
   */
  decryptPayload(encryptedPackage, sessionKey, maxAge = 30000) {
    const { encrypted, iv, authTag, signature, timestamp } = encryptedPackage;

    // Verify signature
    if (!this.verifySignature(encrypted, signature, sessionKey)) {
      throw new Error('Invalid signature - possible tampering detected');
    }

    // Verify timestamp (prevent replay attacks)
    const now = Date.now();
    if (Math.abs(now - timestamp) > maxAge) {
      throw new Error('Timestamp expired - possible replay attack');
    }

    // Decrypt
    const decrypted = this.decryptAES(encrypted, sessionKey, iv, authTag);
    const payload = JSON.parse(decrypted);

    // Remove timestamp from payload
    delete payload.timestamp;

    return payload;
  }

  /**
   * Hash password with SHA-256 (frontend use)
   * @param {string} password - Plain password
   * @returns {string} Hashed password (hex)
   */
  hashPasswordSHA256(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
}

export default new EncryptionService();
