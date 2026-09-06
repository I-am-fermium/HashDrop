/**
 * Tests for HashDrop Private Drop Hybrid Encryption
 */

import { encryptPrivateContent, decryptPrivateContent, generateRecipientKeypair } from './privateDrop';
import { calculateHash } from '../content';
import { calculateKeyFingerprint, exportSecretKey, importSecretKey, exportPublicKey, importPublicKey } from './keyManager';
import { exportArtifact, importArtifact } from './encryptedArtifact';

describe('Private Drop Hybrid Encryption', () => {
  describe('encrypt/decrypt round trip', () => {
    it('should encrypt and decrypt ASCII content', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Hello, HashDrop!');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_test123';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);
      const dec = await decryptPrivateContent({
        hashDropId,
        encryptedArtifact: enc.encryptedArtifact,
        encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
        mlKemCiphertext: enc.mlKemCiphertext,
        mlKemSecretKey: keypair.secretKey,
        keyFingerprint: fingerprint,
        expectedHash: hash,
        expectedSize: plaintext.length,
        contentType: 'text/plain',
      });

      expect(new TextDecoder().decode(dec.plaintext)).toBe('Hello, HashDrop!');
      expect(dec.verified).toBe(true);
    });

    it('should encrypt and decrypt Unicode content', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Hello 🌍 नमस्ते こんにちは 🚀🔐');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_test456';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);
      const dec = await decryptPrivateContent({
        hashDropId,
        encryptedArtifact: enc.encryptedArtifact,
        encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
        mlKemCiphertext: enc.mlKemCiphertext,
        mlKemSecretKey: keypair.secretKey,
        keyFingerprint: fingerprint,
        expectedHash: hash,
        expectedSize: plaintext.length,
        contentType: 'text/plain',
      });

      expect(new TextDecoder().decode(dec.plaintext)).toBe('Hello 🌍 नमस्ते こんにちは 🚀🔐');
      expect(dec.verified).toBe(true);
    });

    it('should fail with wrong secret key', async () => {
      const kp1 = await generateRecipientKeypair();
      const kp2 = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Secret');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(kp1.publicKey);
      const hashDropId = 'hd_test789';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', kp1.publicKey, fingerprint, hashDropId);

      await expect(
        decryptPrivateContent({
          hashDropId,
          encryptedArtifact: enc.encryptedArtifact,
          encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
          mlKemCiphertext: enc.mlKemCiphertext,
          mlKemSecretKey: kp2.secretKey,
          keyFingerprint: fingerprint,
          expectedHash: hash,
          expectedSize: plaintext.length,
          contentType: 'text/plain',
        })
      ).rejects.toThrow('Key unwrapping failed');
    });

    it('should fail with wrong hash', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Hello');
      const hash = await calculateHash(plaintext);
      const wrongHash = 'b'.repeat(64);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_testABC';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);

      // When expected hash is wrong, AAD mismatch causes key unwrapping to fail
      // This is correct security behavior - AAD binds to specific hash
      await expect(
        decryptPrivateContent({
          hashDropId,
          encryptedArtifact: enc.encryptedArtifact,
          encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
          mlKemCiphertext: enc.mlKemCiphertext,
          mlKemSecretKey: keypair.secretKey,
          keyFingerprint: fingerprint,
          expectedHash: wrongHash,
          expectedSize: plaintext.length,
          contentType: 'text/plain',
        })
      ).rejects.toThrow('Key unwrapping failed');
    });

    it('should fail with wrong size', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Hello');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_testDEF';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);

      // When expected size is wrong, AAD mismatch causes key unwrapping to fail
      // This is correct security behavior - AAD binds to specific size
      await expect(
        decryptPrivateContent({
          hashDropId,
          encryptedArtifact: enc.encryptedArtifact,
          encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
          mlKemCiphertext: enc.mlKemCiphertext,
          mlKemSecretKey: keypair.secretKey,
          keyFingerprint: fingerprint,
          expectedHash: hash,
          expectedSize: 999,
          contentType: 'text/plain',
        })
      ).rejects.toThrow('Key unwrapping failed');
    });
  });

  describe('payload structure', () => {
    it('should produce all required fields', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Test');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_testGHI';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);

      expect(enc.hashDropId).toBe(hashDropId);
      expect(enc.plaintextHash).toBe(hash);
      expect(enc.plaintextSize).toBe(4);
      expect(enc.contentType).toBe('text/plain');
      expect(enc.keyFingerprint).toBe(fingerprint);
      expect(enc.encryptedArtifact.iv.length).toBe(12);
      expect(enc.encryptedArtifact.ciphertext.length).toBeGreaterThan(0);
      expect(enc.mlKemCiphertext.length).toBe(1088);
      expect(enc.encryptedKeyEnvelope.iv.length).toBe(12);
      expect(enc.encryptedKeyEnvelope.encryptedKey.length).toBeGreaterThan(0);
    });
  });

  describe('key export/import', () => {
    it('should export and import secret key', async () => {
      const keypair = await generateRecipientKeypair();
      const exported = exportSecretKey(keypair.secretKey);
      const imported = importSecretKey(exported);
      expect(Buffer.from(imported).equals(Buffer.from(keypair.secretKey))).toBe(true);
    });

    it('should export and import public key', async () => {
      const keypair = await generateRecipientKeypair();
      const exported = exportPublicKey(keypair.publicKey);
      const imported = importPublicKey(exported);
      expect(Buffer.from(imported).equals(Buffer.from(keypair.publicKey))).toBe(true);
    });

    it('should reject malformed secret key envelope', () => {
      expect(() => importSecretKey('INVALID')).toThrow();
    });
  });

  describe('artifact export/import', () => {
    it('should export and import encrypted artifact', async () => {
      const artifact = {
        hashDropId: 'hd_test',
        contentHash: 'a'.repeat(64),
        contentSize: 100,
        contentType: 'text/plain',
        keyFingerprint: 'aabbccdd11223344',
        mlKemCiphertext: new Uint8Array(1088).fill(0),
        iv: new Uint8Array(12).fill(1),
        ciphertext: new Uint8Array(32).fill(2),
      };
      const exported = exportArtifact(artifact);
      const imported = importArtifact(exported);
      expect(imported.hashDropId).toBe(artifact.hashDropId);
      expect(imported.contentHash).toBe(artifact.contentHash);
      expect(imported.contentSize).toBe(artifact.contentSize);
      expect(imported.contentType).toBe(artifact.contentType);
      expect(imported.keyFingerprint).toBe(artifact.keyFingerprint);
      expect(Buffer.from(imported.mlKemCiphertext).equals(Buffer.from(artifact.mlKemCiphertext))).toBe(true);
      expect(Buffer.from(imported.iv).equals(Buffer.from(artifact.iv))).toBe(true);
      expect(Buffer.from(imported.ciphertext).equals(Buffer.from(artifact.ciphertext))).toBe(true);
    });

    it('should reject malformed artifact', () => {
      expect(() => importArtifact('INVALID')).toThrow();
    });
  });

  describe('AAD binding', () => {
    it('should fail when AAD metadata is tampered', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Test');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_testAAD';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);

      // Tamper with the hashDropId in AAD
      await expect(
        decryptPrivateContent({
          hashDropId: 'hd_TAMPERED',
          encryptedArtifact: enc.encryptedArtifact,
          encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
          mlKemCiphertext: enc.mlKemCiphertext,
          mlKemSecretKey: keypair.secretKey,
          keyFingerprint: fingerprint,
          expectedHash: hash,
          expectedSize: plaintext.length,
          contentType: 'text/plain',
        })
      ).rejects.toThrow(); // AAD mismatch should cause failure
    });
  });

  describe('nonce uniqueness', () => {
    it('should generate unique content IVs', async () => {
      const { generateAesIv } = require('./aesGcm');
      const iv1 = generateAesIv();
      const iv2 = generateAesIv();
      expect(Buffer.from(iv1).equals(Buffer.from(iv2))).toBe(false);
    });

    it('should generate unique AES keys', async () => {
      const { generateAesKey } = require('./aesGcm');
      const key1 = generateAesKey();
      const key2 = generateAesKey();
      expect(Buffer.from(key1).equals(Buffer.from(key2))).toBe(false);
    });

    it('should generate independent content and envelope IVs', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Test');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_iv_test';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);
      expect(Buffer.from(enc.encryptedArtifact.iv).equals(Buffer.from(enc.encryptedKeyEnvelope.iv))).toBe(false);
    });
  });

  describe('security tests', () => {
    it('should fail when ciphertext is tampered', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Secret');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_tamper_test';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);

      const tamperedArtifact = {
        ...enc.encryptedArtifact,
        ciphertext: new Uint8Array(enc.encryptedArtifact.ciphertext),
      };
      tamperedArtifact.ciphertext[0] ^= 0xff;

      await expect(
        decryptPrivateContent({
          hashDropId,
          encryptedArtifact: tamperedArtifact,
          encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
          mlKemCiphertext: enc.mlKemCiphertext,
          mlKemSecretKey: keypair.secretKey,
          keyFingerprint: fingerprint,
          expectedHash: hash,
          expectedSize: plaintext.length,
          contentType: 'text/plain',
        })
      ).rejects.toThrow();
    });

    it('should fail when content IV is tampered', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Secret');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_iv_tamper';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);

      const tamperedArtifact = {
        ...enc.encryptedArtifact,
        iv: new Uint8Array(enc.encryptedArtifact.iv),
      };
      tamperedArtifact.iv[0] ^= 0xff;

      await expect(
        decryptPrivateContent({
          hashDropId,
          encryptedArtifact: tamperedArtifact,
          encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
          mlKemCiphertext: enc.mlKemCiphertext,
          mlKemSecretKey: keypair.secretKey,
          keyFingerprint: fingerprint,
          expectedHash: hash,
          expectedSize: plaintext.length,
          contentType: 'text/plain',
        })
      ).rejects.toThrow();
    });

    it('should fail when key-envelope IV is tampered', async () => {
      const keypair = await generateRecipientKeypair();
      const plaintext = new TextEncoder().encode('Secret');
      const hash = await calculateHash(plaintext);
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const hashDropId = 'hd_env_iv_tamper';

      const enc = await encryptPrivateContent(plaintext, hash, 'text/plain', keypair.publicKey, fingerprint, hashDropId);

      const tamperedEnvelope = {
        ...enc.encryptedKeyEnvelope,
        iv: new Uint8Array(enc.encryptedKeyEnvelope.iv),
      };
      tamperedEnvelope.iv[0] ^= 0xff;

      await expect(
        decryptPrivateContent({
          hashDropId,
          encryptedArtifact: enc.encryptedArtifact,
          encryptedKeyEnvelope: tamperedEnvelope,
          mlKemCiphertext: enc.mlKemCiphertext,
          mlKemSecretKey: keypair.secretKey,
          keyFingerprint: fingerprint,
          expectedHash: hash,
          expectedSize: plaintext.length,
          contentType: 'text/plain',
        })
      ).rejects.toThrow();
    });

    it('should fail when artifact is swapped with another drop', async () => {
      const keypair1 = await generateRecipientKeypair();
      const keypair2 = await generateRecipientKeypair();
      const plaintext1 = new TextEncoder().encode('Drop 1');
      const plaintext2 = new TextEncoder().encode('Drop 2');
      const hash1 = await calculateHash(plaintext1);
      const hash2 = await calculateHash(plaintext2);
      const fingerprint1 = await calculateKeyFingerprint(keypair1.publicKey);
      const fingerprint2 = await calculateKeyFingerprint(keypair2.publicKey);

      const enc1 = await encryptPrivateContent(plaintext1, hash1, 'text/plain', keypair1.publicKey, fingerprint1, 'hd_drop1');
      const enc2 = await encryptPrivateContent(plaintext2, hash2, 'text/plain', keypair2.publicKey, fingerprint2, 'hd_drop2');

      await expect(
        decryptPrivateContent({
          hashDropId: 'hd_drop1',
          encryptedArtifact: enc2.encryptedArtifact,
          encryptedKeyEnvelope: enc1.encryptedKeyEnvelope,
          mlKemCiphertext: enc2.mlKemCiphertext,
          mlKemSecretKey: keypair1.secretKey,
          keyFingerprint: fingerprint1,
          expectedHash: hash1,
          expectedSize: plaintext1.length,
          contentType: 'text/plain',
        })
      ).rejects.toThrow();
    });
  });
});

// Helper function for tests
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
