/**
 * HashDrop AES-256-GCM Encryption Module
 *
 * Provides AES-256-GCM symmetric encryption using the Web Crypto API.
 * Used for encrypting content in HashDrop V3 PRIVATE mode.
 *
 * Security properties:
 * - AES-256 provides ~256-bit security against classical attacks
 * - GCM mode provides authenticated encryption (confidentiality + integrity)
 * - Random 256-bit key per drop
 * - Random 96-bit IV per encryption operation
 * - Key is never reused across drops
 * - IV is never reused with the same key
 */

/**
 * Pass a Uint8Array view to WebCrypto as a BufferSource.
 *
 * WebCrypto BufferSource arguments consume ONLY the bytes represented by the
 * view (its byteOffset/byteLength), never the whole backing ArrayBuffer. Passing
 * `.buffer` would be incorrect for subarrays, so the view itself is passed.
 */
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

/**
 * Generate a cryptographically random 256-bit AES key
 * Uses Web Crypto API CSPRNG
 */
export function generateAesKey(): Uint8Array {
  const key = new Uint8Array(32); // 256 bits
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(key);
  } else {
    // Fallback for environments without Web Crypto API
    const { randomBytes } = require('crypto');
    const buf = randomBytes(32);
    key.set(buf);
  }
  return key;
}

/**
 * Generate a cryptographically random 96-bit IV for AES-GCM
 * Uses Web Crypto API CSPRNG
 */
export function generateAesIv(): Uint8Array {
  const iv = new Uint8Array(12); // 96 bits (recommended for GCM)
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(iv);
  } else {
    const { randomBytes } = require('crypto');
    const buf = randomBytes(12);
    iv.set(buf);
  }
  return iv;
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - The data to encrypt
 * @param key - 256-bit AES key
 * @param iv - 96-bit nonce (must be unique per key)
 * @param aad - Additional authenticated data (optional, authenticated but not encrypted)
 * @returns Ciphertext with GCM auth tag appended
 */
export async function aesGcmEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    // Web Crypto API path
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      asBufferSource(key),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const algorithm: AesGcmParams = {
      name: 'AES-GCM',
      iv: asBufferSource(iv),
    };
    if (aad) {
      algorithm.additionalData = asBufferSource(aad);
    }

    const ciphertextBuffer = await globalThis.crypto.subtle.encrypt(
      algorithm,
      cryptoKey,
      asBufferSource(plaintext)
    );

    return new Uint8Array(ciphertextBuffer);
  } else {
    // Node.js crypto fallback
    const crypto = require('crypto');
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv));
    if (aad) {
      cipher.setAAD(Buffer.from(aad));
    }
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const result = new Uint8Array(encrypted.length + authTag.length);
    result.set(new Uint8Array(encrypted));
    result.set(new Uint8Array(authTag), encrypted.length);
    return result;
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param ciphertext - The encrypted data (includes GCM auth tag)
 * @param key - 256-bit AES key
 * @param iv - 96-bit nonce used during encryption
 * @param aad - Additional authenticated data (must match what was used during encryption)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function aesGcmDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    // Web Crypto API path
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      asBufferSource(key),
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const algorithm: AesGcmParams = {
      name: 'AES-GCM',
      iv: asBufferSource(iv),
    };
    if (aad) {
      algorithm.additionalData = asBufferSource(aad);
    }

    try {
      const plaintextBuffer = await globalThis.crypto.subtle.decrypt(
        algorithm,
        cryptoKey,
        asBufferSource(ciphertext)
      );
      return new Uint8Array(plaintextBuffer);
    } catch (e) {
      throw new Error('AES-GCM decryption failed: authentication tag mismatch or wrong key');
    }
  } else {
    // Node.js crypto fallback
    const crypto = require('crypto');
    // GCM auth tag is the last 16 bytes
    const authTagLength = 16;
    const encryptedData = ciphertext.slice(0, ciphertext.length - authTagLength);
    const authTag = ciphertext.slice(ciphertext.length - authTagLength);

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv));
    decipher.setAuthTag(Buffer.from(authTag));
    if (aad) {
      decipher.setAAD(Buffer.from(aad));
    }
    try {
      const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData)), decipher.final()]);
      return new Uint8Array(decrypted);
    } catch (e) {
      throw new Error('AES-GCM decryption failed: authentication tag mismatch or wrong key');
    }
  }
}
