/**
 * Tests for HashDrop ML-KEM-768 Module
 */

import {
  generateKeypair,
  encapsulate,
  decapsulate,
  ML_KEM_768_PUBLIC_KEY_BYTES,
  ML_KEM_768_SECRET_KEY_BYTES,
  ML_KEM_768_CIPHERTEXT_BYTES,
  ML_KEM_768_SHARED_SECRET_BYTES,
} from './mlKem';

describe('ML-KEM-768', () => {
  describe('key generation', () => {
    it('should generate a keypair with correct sizes', async () => {
      const keypair = await generateKeypair();
      expect(keypair.publicKey.length).toBe(ML_KEM_768_PUBLIC_KEY_BYTES);
      expect(keypair.secretKey.length).toBe(ML_KEM_768_SECRET_KEY_BYTES);
    });

    it('should generate unique keypairs', async () => {
      const kp1 = await generateKeypair();
      const kp2 = await generateKeypair();
      expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(false);
      expect(Buffer.from(kp1.secretKey).equals(Buffer.from(kp2.secretKey))).toBe(false);
    });
  });

  describe('encapsulation', () => {
    it('should produce ciphertext and shared secret with correct sizes', async () => {
      const keypair = await generateKeypair();
      const result = await encapsulate(keypair.publicKey);
      expect(result.ciphertext.length).toBe(ML_KEM_768_CIPHERTEXT_BYTES);
      expect(result.sharedSecret.length).toBe(ML_KEM_768_SHARED_SECRET_BYTES);
    });

    it('should produce different ciphertexts for same public key', async () => {
      const keypair = await generateKeypair();
      const enc1 = await encapsulate(keypair.publicKey);
      const enc2 = await encapsulate(keypair.publicKey);
      expect(Buffer.from(enc1.ciphertext).equals(Buffer.from(enc2.ciphertext))).toBe(false);
    });
  });

  describe('decapsulation', () => {
    it('should produce the same shared secret', async () => {
      const keypair = await generateKeypair();
      const enc = await encapsulate(keypair.publicKey);
      const dec = await decapsulate(enc.ciphertext, keypair.secretKey);
      expect(Buffer.from(enc.sharedSecret).equals(Buffer.from(dec))).toBe(true);
    });

    it('should fail with wrong secret key', async () => {
      const kp1 = await generateKeypair();
      const kp2 = await generateKeypair();
      const enc = await encapsulate(kp1.publicKey);
      const dec = await decapsulate(enc.ciphertext, kp2.secretKey);
      // ML-KEM may not throw, but the shared secret should differ
      expect(Buffer.from(enc.sharedSecret).equals(Buffer.from(dec))).toBe(false);
    });
  });
});
