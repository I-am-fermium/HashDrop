/**
 * HashDrop ML-KEM-768 Module
 *
 * Provides post-quantum key encapsulation using ML-KEM-768 (FIPS 203).
 * Used for protecting the AES-256 key in HashDrop V3 PRIVATE mode.
 *
 * ML-KEM-768 parameters:
 * - Public key: 1184 bytes
 * - Secret key: 2400 bytes
 * - Ciphertext: 1088 bytes
 * - Shared secret: 32 bytes
 *
 * Security level: ~192-bit post-quantum security (NIST Level 3)
 *
 * Library: mlkem (https://www.npmjs.com/package/mlkem)
 * - Standards-compliant implementation of FIPS 203
 * - Pure TypeScript, browser-compatible
 * - No peer dependencies
 */

import { createMlKem768 } from 'mlkem';

/**
 * ML-KEM-768 keypair
 */
export interface MlKemKeypair {
  publicKey: Uint8Array; // 1184 bytes
  secretKey: Uint8Array; // 2400 bytes
}

/**
 * ML-KEM-768 encapsulation result
 */
export interface MlKemEncapsulation {
  ciphertext: Uint8Array; // 1088 bytes
  sharedSecret: Uint8Array; // 32 bytes
}

// Cached instance (factory is async)
let mlKemInstance: Awaited<ReturnType<typeof createMlKem768>> | null = null;

/**
 * Get or create the ML-KEM-768 instance
 */
async function getInstance() {
  if (!mlKemInstance) {
    mlKemInstance = await createMlKem768();
  }
  return mlKemInstance;
}

/**
 * Generate a new ML-KEM-768 keypair
 * @returns [publicKey, secretKey]
 */
export async function generateKeypair(): Promise<MlKemKeypair> {
  const instance = await getInstance();
  const [publicKey, secretKey] = instance.generateKeyPair();
  return { publicKey, secretKey };
}

/**
 * Encapsulate a shared secret using the recipient's public key
 * @param publicKey - Recipient's ML-KEM-768 public key (1184 bytes)
 * @returns [ciphertext, sharedSecret]
 */
export async function encapsulate(publicKey: Uint8Array): Promise<MlKemEncapsulation> {
  const instance = await getInstance();
  const [ciphertext, sharedSecret] = instance.encap(publicKey);
  return { ciphertext, sharedSecret };
}

/**
 * Decapsulate a shared secret using the recipient's secret key
 * @param ciphertext - ML-KEM-768 ciphertext (1088 bytes)
 * @param secretKey - Recipient's ML-KEM-768 secret key (2400 bytes)
 * @returns sharedSecret (32 bytes)
 */
export async function decapsulate(
  ciphertext: Uint8Array,
  secretKey: Uint8Array
): Promise<Uint8Array> {
  const instance = await getInstance();
  return instance.decap(ciphertext, secretKey);
}

// ML-KEM-768 size constants
export const ML_KEM_768_PUBLIC_KEY_BYTES = 1184;
export const ML_KEM_768_SECRET_KEY_BYTES = 2400;
export const ML_KEM_768_CIPHERTEXT_BYTES = 1088;
export const ML_KEM_768_SHARED_SECRET_BYTES = 32;
