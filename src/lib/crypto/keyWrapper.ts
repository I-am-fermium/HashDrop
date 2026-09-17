/**
 * HashDrop AES Key Wrapper Module
 *
 * Provides authenticated encryption for wrapping AES content keys.
 * Uses AES-256-GCM to encrypt the random AES content key with a
 * key-encryption key derived from the ML-KEM shared secret.
 *
 * Construction:
 *   ML-KEM shared secret
 *        │
 *        ▼
 *   HKDF-SHA-256
 *        │
 *        ▼
 *   key-encryption key (KEK)
 *        │
 *        ▼
 *   AES-256-GCM (wrap random AES content key)
 *        │
 *        ▼
 *   encrypted AES-key envelope
 *
 * The envelope contains:
 *   IV (12 bytes) + encrypted AES key (32 bytes) + GCM auth tag (16 bytes)
 *   Total: 60 bytes
 */

import { generateAesIv, aesGcmEncrypt, aesGcmDecrypt } from './aesGcm';

/**
 * Encrypted AES-key envelope
 */
export interface AesKeyEnvelope {
  iv: Uint8Array; // 96-bit nonce
  encryptedKey: Uint8Array; // AES-256-GCM encrypted content key (includes auth tag)
}

/**
 * Wrap a random AES-256 content key using a key-encryption key
 *
 * @param contentKey - Random AES-256 content key (32 bytes)
 * @param kek - Key-encryption key (32 bytes)
 * @param aad - Additional authenticated data (optional)
 * @returns Encrypted key envelope
 */
export async function wrapAesKey(
  contentKey: Uint8Array,
  kek: Uint8Array,
  aad?: Uint8Array
): Promise<AesKeyEnvelope> {
  const iv = generateAesIv();
  const encryptedKey = await aesGcmEncrypt(contentKey, kek, iv, aad);
  
  return {
    iv,
    encryptedKey,
  };
}

/**
 * Unwrap an AES-256 content key from its envelope
 *
 * @param envelope - Encrypted key envelope
 * @param kek - Key-encryption key (32 bytes)
 * @param aad - Additional authenticated data (must match what was used during wrapping)
 * @returns Random AES-256 content key (32 bytes)
 * @throws Error if decryption fails (wrong key, tampered envelope)
 */
export async function unwrapAesKey(
  envelope: AesKeyEnvelope,
  kek: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  return aesGcmDecrypt(envelope.encryptedKey, kek, envelope.iv, aad);
}
