/**
 * Tests for HashDrop AES-256-GCM Encryption Module
 */

import { generateAesKey, generateAesIv, aesGcmEncrypt, aesGcmDecrypt } from './aesGcm';

describe('AES-256-GCM', () => {
  describe('key generation', () => {
    it('should generate a 32-byte key', () => {
      const key = generateAesKey();
      expect(key.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = generateAesKey();
      const key2 = generateAesKey();
      expect(Buffer.from(key1).equals(Buffer.from(key2))).toBe(false);
    });
  });

  describe('IV generation', () => {
    it('should generate a 12-byte IV', () => {
      const iv = generateAesIv();
      expect(iv.length).toBe(12);
    });

    it('should generate unique IVs', () => {
      const iv1 = generateAesIv();
      const iv2 = generateAesIv();
      expect(Buffer.from(iv1).equals(Buffer.from(iv2))).toBe(false);
    });
  });

  describe('encrypt/decrypt round trip', () => {
    it('should encrypt and decrypt ASCII content', async () => {
      const plaintext = new TextEncoder().encode('Hello, HashDrop!');
      const key = generateAesKey();
      const iv = generateAesIv();

      const ciphertext = await aesGcmEncrypt(plaintext, key, iv);
      const decrypted = await aesGcmDecrypt(ciphertext, key, iv);

      expect(new TextDecoder().decode(decrypted)).toBe('Hello, HashDrop!');
    });

    it('should encrypt and decrypt Unicode content', async () => {
      const plaintext = new TextEncoder().encode('Hello 🌍 नमस्ते こんにちは');
      const key = generateAesKey();
      const iv = generateAesIv();

      const ciphertext = await aesGcmEncrypt(plaintext, key, iv);
      const decrypted = await aesGcmDecrypt(ciphertext, key, iv);

      expect(new TextDecoder().decode(decrypted)).toBe('Hello 🌍 नमस्ते こんにちは');
    });

    it('should encrypt and decrypt empty content', async () => {
      const plaintext = new TextEncoder().encode('');
      const key = generateAesKey();
      const iv = generateAesIv();

      const ciphertext = await aesGcmEncrypt(plaintext, key, iv);
      const decrypted = await aesGcmDecrypt(ciphertext, key, iv);

      expect(decrypted.length).toBe(0);
    });

    it('should encrypt and decrypt large content', async () => {
      const content = 'x'.repeat(10000);
      const plaintext = new TextEncoder().encode(content);
      const key = generateAesKey();
      const iv = generateAesIv();

      const ciphertext = await aesGcmEncrypt(plaintext, key, iv);
      const decrypted = await aesGcmDecrypt(ciphertext, key, iv);

      expect(new TextDecoder().decode(decrypted)).toBe(content);
    });
  });

  describe('security', () => {
    it('should fail decryption with wrong key', async () => {
      const plaintext = new TextEncoder().encode('Secret message');
      const key = generateAesKey();
      const wrongKey = generateAesKey();
      const iv = generateAesIv();

      const ciphertext = await aesGcmEncrypt(plaintext, key, iv);

      await expect(aesGcmDecrypt(ciphertext, wrongKey, iv)).rejects.toThrow();
    });

    it('should fail decryption with modified ciphertext', async () => {
      const plaintext = new TextEncoder().encode('Secret message');
      const key = generateAesKey();
      const iv = generateAesIv();

      const ciphertext = await aesGcmEncrypt(plaintext, key, iv);
      ciphertext[0] ^= 0xff; // Flip bits

      await expect(aesGcmDecrypt(ciphertext, key, iv)).rejects.toThrow();
    });

    it('should produce different ciphertext for same plaintext with different IVs', async () => {
      const plaintext = new TextEncoder().encode('Hello');
      const key = generateAesKey();
      const iv1 = generateAesIv();
      const iv2 = generateAesIv();

      const ct1 = await aesGcmEncrypt(plaintext, key, iv1);
      const ct2 = await aesGcmEncrypt(plaintext, key, iv2);

      expect(Buffer.from(ct1).equals(Buffer.from(ct2))).toBe(false);
    });
  });
});
