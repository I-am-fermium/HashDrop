/**
 * Tests for the ONE canonical encrypted-artifact protocol.
 *
 * version ≠ type:
 *   - version is the artifact schema version (exactly one: "v1").
 *   - type is the object kind (TEXT | IMAGE | VIDEO | AUDIO), validated for
 *     consistency with the MIME type and authenticated via AAD.
 *
 * Covers schema validation, deterministic serialization, binary-safe round
 * trips, and tamper detection (type / filename / MIME / size / ciphertext).
 */

import {
  createArtifact,
  exportArtifact,
  importArtifact,
  isValidArtifact,
  assertArtifactMetadata,
} from './crypto/encryptedArtifact';
import { encryptPrivateContent, decryptPrivateContent, generateRecipientKeypair } from './crypto/privateDrop';
import { calculateKeyFingerprint } from './crypto/keyManager';
import { calculateHash } from './content';

const MIME_BY_TYPE: Record<string, string> = {
  TEXT: 'text/plain',
  IMAGE: 'image/png',
  VIDEO: 'video/mp4',
  AUDIO: 'audio/wav',
};

const TYPE_BYTES: Uint8Array[] = [
  new TextEncoder().encode('hello text'),
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
  new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
  new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]),
];

function makeArtifact(type: string, filename = '') {
  return createArtifact(
    {
      hashDropId: 'hd_abc12345',
      contentHash: 'c'.repeat(64),
      contentSize: 18,
      type: type as 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO',
      contentType: MIME_BY_TYPE[type],
      keyFingerprint: 'aabbccddeeff0011',
      filename: filename || undefined,
    },
    new Uint8Array(1088).fill(1),
    new Uint8Array(12).fill(2),
    new Uint8Array(32).fill(3)
  );
}

/** Replace the field at `index` of a canonical envelope with `value`. */
function withField(envelope: string, index: number, value: string): string {
  const parts = envelope.split('|');
  parts[index] = value;
  return parts.join('|');
}
describe('Canonical encrypted artifact (v1)', () => {
  describe('schema', () => {
    it('serializes exactly 13 fields for every object type', () => {
      for (const type of ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO']) {
        const env = exportArtifact(makeArtifact(type));
        expect(env.startsWith('HASHDROP-PRIVATE-BLOB|v1|')).toBe(true);
        expect(env.split('|').length).toBe(13);
      }
    });

    it('carries version, type, filename, MIME, size, crypto and payload separately', () => {
      const env = exportArtifact(makeArtifact('IMAGE', 'photo.png'));
      const p = env.split('|');
      expect(p[1]).toBe('v1'); // version (schema)
      expect(p[5]).toBe('IMAGE'); // type (object kind)
      expect(p[6]).toBe('image/png'); // mime
      expect(p[4]).toBe('18'); // size
      expect(p[7]).toBe('HD-P2'); // crypto version
      expect(p[12]).toBe('photo.png'); // filename (display metadata)
    });

    it('rejects an unsupported artifact version', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      expect(isValidArtifact(withField(env, 1, 'v9'))).toBe(false);
    });

    it('rejects an unsupported object type', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      expect(() => importArtifact(withField(env, 5, 'DOCUMENT'))).toThrow('Unsupported artifact type');
    });

    it('rejects a type that contradicts the MIME type', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      expect(() => importArtifact(withField(env, 5, 'IMAGE'))).toThrow('does not match');
      expect(() => assertArtifactMetadata('VIDEO', 'image/png')).toThrow('does not match');
    });

    it('rejects an invalid size', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      expect(() => importArtifact(withField(env, 4, '-1'))).toThrow('Invalid content size');
      expect(() => importArtifact(withField(env, 4, 'abc'))).toThrow('Invalid content size');
    });

    it('rejects non-canonical size representations', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      for (const size of ['00', '01', '0100', '+100', '1.0', '100abc', 'abc100', ' 100', '100 ', '']) {
        expect(() => importArtifact(withField(env, 4, size))).toThrow('Invalid content size');
      }
    });

    it('rejects unsafe integer sizes', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      for (const size of ['9007199254740992', '10000000000000000000000']) {
        expect(() => importArtifact(withField(env, 4, size))).toThrow('Invalid content size');
      }
    });

    it('rejects a missing HashDrop ID and malformed commitment/fingerprint', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      expect(() => importArtifact(withField(env, 2, ''))).toThrow('missing HashDrop ID');
      // contentHash: exactly 64 canonical lowercase hex characters
      expect(() => importArtifact(withField(env, 3, 'not-a-hex-hash'))).toThrow('64 lowercase hexadecimal');
      expect(() => importArtifact(withField(env, 3, 'a'.repeat(63)))).toThrow('64 lowercase hexadecimal');
      expect(() => importArtifact(withField(env, 3, `${'a'.repeat(64)}00`))).toThrow('64 lowercase hexadecimal');
      expect(() => importArtifact(withField(env, 3, 'A'.repeat(64)))).toThrow('64 lowercase hexadecimal');
      // keyFingerprint: exactly 16 canonical lowercase hex characters
      expect(() => importArtifact(withField(env, 8, 'aabbccdd1122334'))).toThrow('16 lowercase hexadecimal');
      expect(() => importArtifact(withField(env, 8, 'aabbccdd1122334455'))).toThrow('16 lowercase hexadecimal');
      expect(() => importArtifact(withField(env, 8, 'gg'.repeat(8)))).toThrow('16 lowercase hexadecimal');
      expect(() => importArtifact(withField(env, 8, 'AABBCCDD11223344'))).toThrow('16 lowercase hexadecimal');
    });

    it('rejects malformed Base64 in binary fields (no silent normalization)', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      expect(isValidArtifact(withField(env, 9, 'not base64!'))).toBe(false); // invalid characters
      expect(isValidArtifact(withField(env, 10, 'AA'))).toBe(false);          // unpadded
      expect(isValidArtifact(withField(env, 11, 'SGVs bG8='))).toBe(false);   // embedded whitespace
      expect(isValidArtifact(withField(env, 9, 'QT=='))).toBe(false);         // non-canonical padding
    });

    it('rejects an unsupported crypto version', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      expect(() => importArtifact(withField(env, 7, 'HD-P1'))).toThrow('Unsupported artifact crypto version');
    });

    it('accepts every canonical object type', () => {
      for (const type of ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO']) {
        const imported = importArtifact(exportArtifact(makeArtifact(type)));
        expect(imported.type).toBe(type);
      }
    });

    it('rejects non-canonical casing of the object type (no case folding)', () => {
      const env = exportArtifact(makeArtifact('TEXT'));
      // 'text', 'Text', 'tEXT', padded variants — none is the canonical wire form.
      for (const bad of ['text', 'Text', 'tEXT', 'TEXT ', ' TEXT', 'DOCUMENT']) {
        expect(() => importArtifact(withField(env, 5, bad))).toThrow('Unsupported artifact type');
      }
      for (const bad of ['image', 'Image', 'video', 'Video', 'audio', 'Audio']) {
        expect(() => importArtifact(withField(env, 5, bad))).toThrow('Unsupported artifact type');
      }
    });

    it('rejects direct assertArtifactMetadata calls with non-canonical type/MIME casing', () => {
      expect(() => assertArtifactMetadata('text', 'text/plain')).toThrow('Unsupported artifact type');
      expect(() => assertArtifactMetadata('TEXT', 'TEXT/PLAIN')).toThrow('Non-canonical artifact MIME type');
      expect(() => assertArtifactMetadata('TEXT', ' text/plain')).toThrow('Non-canonical artifact MIME type');
      expect(() => assertArtifactMetadata('TEXT', 'text/plain ')).toThrow('Non-canonical artifact MIME type');
      expect(() => assertArtifactMetadata('TEXT', 'Text/Plain')).toThrow('Non-canonical artifact MIME type');
    });

    it('accepts canonical lowercase MIME and rejects non-canonical MIME representations', () => {
      const env = exportArtifact(makeArtifact('TEXT')); // mime: text/plain
      const imported = importArtifact(env);
      expect(imported.contentType).toBe('text/plain');

      for (const bad of ['TEXT/PLAIN', 'Text/Plain', 'tEXT/pLAIN', ' text/plain', 'text/plain ', '\ttext/plain']) {
        expect(() => importArtifact(withField(env, 6, bad))).toThrow('Non-canonical artifact MIME type');
      }

      // Every other supported MIME keeps its canonical lowercase form.
      for (const type of ['IMAGE', 'VIDEO', 'AUDIO']) {
        const importedTyped = importArtifact(exportArtifact(makeArtifact(type)));
        expect(importedTyped.contentType).toBe(MIME_BY_TYPE[type]);
        expect(importedTyped.contentType).toBe(importedTyped.contentType.toLowerCase());
      }
    });

    it('rejects a wrong field count / malformed envelope', () => {
      expect(isValidArtifact('HASHDROP-PRIVATE-BLOB|v1|short')).toBe(false);
      expect(isValidArtifact(`HASHDROP-PRIVATE-BLOB|v1|${'a'.repeat(64)}|100|TEXT|text/plain`)).toBe(false);
      // The old 12-field form (no explicit type) is rejected.
      expect(
        isValidArtifact('HASHDROP-PRIVATE-BLOB|v1|hd|hash|1|text/plain|HD-P2|fp|AA==|AA==|AA==|')
      ).toBe(false);
    });
  });

  describe('serialization', () => {
    it('is deterministic (export → import → export is stable)', () => {
      for (const type of ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO']) {
        const first = exportArtifact(makeArtifact(type, 'x.bin'));
        const again = exportArtifact(importArtifact(first));
        expect(again).toBe(first);
      }
    });

    it('round-trips every object type with optional filename', () => {
      for (const type of ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO']) {
        const noName = importArtifact(exportArtifact(makeArtifact(type)));
        expect(noName.type).toBe(type);
        expect(noName.contentType).toBe(MIME_BY_TYPE[type]);
        expect(noName.filename).toBe('');

        const named = importArtifact(exportArtifact(makeArtifact(type, `${type.toLowerCase()}.dat`)));
        expect(named.filename).toBe(`${type.toLowerCase()}.dat`);
      }
    });

    it('is binary safe for the encrypted payload (0x00 and high-bit bytes)', () => {
      const payload = new Uint8Array(64);
      for (let i = 0; i < payload.length; i++) {
        payload[i] = (i * 37) & 0xff; // covers 0x00, high-bit range, arbitrary bytes
      }
      const artifact = makeArtifact('TEXT');
      artifact.ciphertext = payload;
      const imported = importArtifact(exportArtifact(artifact));
      expect(Buffer.from(imported.ciphertext).equals(Buffer.from(payload))).toBe(true);
    });

    it('re-sanitizes hostile filenames at import (no path traversal)', () => {
      const env = exportArtifact(makeArtifact('IMAGE'));
      const hostile = withField(env, 12, '../../secret.png');
      const imported = importArtifact(hostile);
      expect(imported.filename).not.toContain('/');
      expect(imported.filename).not.toContain('..');
    });
  });

  describe('filename safety at the creation boundary', () => {
    it('sanitizes pipe-delimited hostile filenames so serialization stays parseable', () => {
      const hostileNames = ['hello|world.txt', 'foo||bar', '|', '|||||'];
      for (const hostile of hostileNames) {
        const artifact = makeArtifact('IMAGE', hostile);
        expect(artifact.filename).not.toContain('|');

        // The envelope must remain 13 parseable fields and round-trip.
        const envelope = exportArtifact(artifact);
        expect(envelope.split('|').length).toBe(13);
        const imported = importArtifact(envelope);
        expect(imported.filename).toBe(artifact.filename);
      }
    });

    it('sanitizes path-traversal filenames identically at creation and import', () => {
      for (const hostile of ['../../secret.png', '..\\..\\secret.png', 'C:\\secret']) {
        const artifact = makeArtifact('AUDIO', hostile);
        expect(artifact.filename).not.toContain('/');
        expect(artifact.filename).not.toContain('\\');
        expect(artifact.filename).not.toContain('..');

        const imported = importArtifact(exportArtifact(artifact));
        expect(imported.filename).toBe(artifact.filename);
      }
    });

    it('preserves empty-filename semantics (no filename)', () => {
      const artifact = makeArtifact('TEXT');
      expect(artifact.filename).toBe('');
      const imported = importArtifact(exportArtifact(artifact));
      expect(imported.filename).toBe('');
    });
  });
describe('tamper detection through real cryptography', () => {
    async function roundTrip() {
      const bytes = TYPE_BYTES[1];
      const hash = await calculateHash(bytes);
      const keypair = await generateRecipientKeypair();
      const fingerprint = await calculateKeyFingerprint(keypair.publicKey);
      const enc = await encryptPrivateContent(bytes, hash, 'image/png', keypair.publicKey, fingerprint, 'hd_t1', 'photo.png');
      return { bytes, hash, keypair, fingerprint, enc };
    }

    it('encrypt → decrypt returns exactly the original bytes', async () => {
      const { bytes, hash, keypair, fingerprint, enc } = await roundTrip();
      const dec = await decryptPrivateContent({
        hashDropId: 'hd_t1',
        encryptedArtifact: enc.encryptedArtifact,
        encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
        mlKemCiphertext: enc.mlKemCiphertext,
        mlKemSecretKey: keypair.secretKey,
        keyFingerprint: fingerprint,
        expectedHash: hash,
        expectedSize: bytes.length,
        contentType: 'image/png',
      });
      expect(Buffer.from(dec.plaintext).equals(Buffer.from(bytes))).toBe(true);
      expect(enc.encryptedArtifact.type).toBe('IMAGE');
    });

    it('changing only the filename does not break decryption (filename is unauthenticated display metadata)', async () => {
      const { bytes, hash, keypair, fingerprint, enc } = await roundTrip();
      const envelope = exportArtifact(enc.encryptedArtifact);
      const parts = envelope.split('|');
      parts[12] = 'renamed-after-publish.png';
      const renamed = importArtifact(parts.join('|'));
      expect(renamed.filename).toBe('renamed-after-publish.png');

      // Filename is display metadata only — it is NOT in AAD/hash, so the
      // decryption and verification still succeed with a renamed file.
      const dec = await decryptPrivateContent({
        hashDropId: 'hd_t1',
        encryptedArtifact: renamed,
        encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
        mlKemCiphertext: enc.mlKemCiphertext,
        mlKemSecretKey: keypair.secretKey,
        keyFingerprint: fingerprint,
        expectedHash: hash,
        expectedSize: bytes.length,
        contentType: 'image/png',
      });
      expect(Buffer.from(dec.plaintext).equals(Buffer.from(bytes))).toBe(true);
    });

    it('a tampered object TYPE is rejected at import (type/MIME mismatch)', async () => {
      const { enc } = await roundTrip();
      const envelope = exportArtifact(enc.encryptedArtifact);
      // Flip type IMAGE → VIDEO without changing the MIME: the canonical
      // validator rejects the envelope before any decryption is attempted.
      expect(() => importArtifact(withField(envelope, 5, 'VIDEO'))).toThrow('does not match');
    });

    it('a tampered size is detected at authentication time (AAD binds committed size)', async () => {
      const { bytes, hash, keypair, fingerprint, enc } = await roundTrip();
      const envelope = exportArtifact(enc.encryptedArtifact);
      const tamperedEnvelope = withField(envelope, 4, String(bytes.length + 7));
      const tamperedArtifact = importArtifact(tamperedEnvelope);
      // An attacker who tampers the committed size and feeds it into AAD
      // reconstruction cannot pass: the reconstructed AAD no longer matches
      // the AAD used during encryption → AES-GCM authentication fails.
      await expect(
        decryptPrivateContent({
          hashDropId: 'hd_t1',
          encryptedArtifact: tamperedArtifact,
          encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
          mlKemCiphertext: enc.mlKemCiphertext,
          mlKemSecretKey: keypair.secretKey,
          keyFingerprint: fingerprint,
          expectedHash: hash,
          expectedSize: tamperedArtifact.contentSize, // tampered value flows into AAD
          contentType: 'image/png',
        })
      ).rejects.toThrow();
      void bytes;
    });

    it('a tampered ciphertext / auth tag fails decryption', async () => {
      const { bytes, hash, keypair, fingerprint, enc } = await roundTrip();
      const tampered = enc.encryptedArtifact.ciphertext.slice();
      tampered[tampered.length - 1] ^= 0xff; // corrupt the GCM tag
      await expect(
        decryptPrivateContent({
          hashDropId: 'hd_t1',
          encryptedArtifact: { ...enc.encryptedArtifact, ciphertext: tampered },
          encryptedKeyEnvelope: enc.encryptedKeyEnvelope,
          mlKemCiphertext: enc.mlKemCiphertext,
          mlKemSecretKey: keypair.secretKey,
          keyFingerprint: fingerprint,
          expectedHash: hash,
          expectedSize: bytes.length,
          contentType: 'image/png',
        })
      ).rejects.toThrow('Decryption failed');
    });
  });
});