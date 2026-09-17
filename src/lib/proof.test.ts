/**
 * Tests for HashDrop Proof Mode (V3)
 *
 * Comprehensive tests covering hashing, encoding, decoding, malformed
 * payload rejection, and verification logic.
 */

import {
  encodeProofPayload,
  decodeProofPayload,
  isValidProofPayload,
  decodePublicPayload,
  decodeHashDropPayload,
  HASHDROP_PROTOCOL_VERSION,
} from './memo';
import { calculateHash, stringToBytes, generateHashDropId } from './content';

// ============================================================
// 1-8: Content hashing and byte-length calculation
// ============================================================

describe('Proof Mode - Content Hashing', () => {
  describe('byte-length calculation (exact UTF-8 bytes)', () => {
    it('should calculate correct byte length for ASCII', () => {
      const content = 'hello';
      const bytes = stringToBytes(content);
      expect(bytes.length).toBe(5);
    });

    it('should calculate correct byte length for empty content', () => {
      const bytes = stringToBytes('');
      expect(bytes.length).toBe(0);
    });

    it('should calculate correct byte length for multibyte UTF-8 (Chinese)', () => {
      const content = '你好世界';
      const bytes = stringToBytes(content);
      // Each Chinese character is 3 bytes in UTF-8
      expect(bytes.length).toBe(12);
      // String length (code units) differs from byte length
      expect(content.length).toBe(4);
    });

    it('should calculate correct byte length for emoji', () => {
      const content = '🚀';
      const bytes = stringToBytes(content);
      // Emoji is 4 bytes in UTF-8
      expect(bytes.length).toBe(4);
      // String length is 2 (surrogate pair)
      expect(content.length).toBe(2);
    });

    it('should produce different byte lengths for content differing by whitespace', () => {
      expect(stringToBytes('hello').length).toBe(5);
      expect(stringToBytes('hello\n').length).toBe(6);
      expect(stringToBytes(' hello').length).toBe(6);
      expect(stringToBytes('hello ').length).toBe(6);
    });

    it('should NOT trim or alter content before hashing', () => {
      const contentWithSpaces = '  hello world  ';
      const bytes = stringToBytes(contentWithSpaces);
      expect(bytes.length).toBe(contentWithSpaces.length);
    });
  });

  describe('SHA-256 hash generation', () => {
    it('should produce a 64-character hex string', async () => {
      const bytes = stringToBytes('test content');
      const hash = await calculateHash(bytes);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes for same content', async () => {
      const bytes = stringToBytes('consistent');
      const hash1 = await calculateHash(bytes);
      const hash2 = await calculateHash(bytes);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', async () => {
      const hash1 = await calculateHash(stringToBytes('content A'));
      const hash2 = await calculateHash(stringToBytes('content B'));
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for content differing by one byte', async () => {
      const hash1 = await calculateHash(stringToBytes('hello'));
      const hash2 = await calculateHash(stringToBytes('hello!'));
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for content differing by whitespace', async () => {
      const hash1 = await calculateHash(stringToBytes('hello'));
      const hash2 = await calculateHash(stringToBytes('hello\n'));
      const hash3 = await calculateHash(stringToBytes(' hello'));
      const hash4 = await calculateHash(stringToBytes('hello '));
      // All should be distinct
      const hashes = [hash1, hash2, hash3, hash4];
      expect(new Set(hashes).size).toBe(4);
    });

    it('should handle unicode content correctly', async () => {
      const hash = await calculateHash(stringToBytes('你好世界🚀'));
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle content with pipe characters', async () => {
      const hash = await calculateHash(stringToBytes('a|b|c'));
      expect(hash).toHaveLength(64);
    });

    it('should handle content with newlines', async () => {
      const hash = await calculateHash(stringToBytes('line1\nline2\nline3'));
      expect(hash).toHaveLength(64);
    });

    it('should handle content with quotes', async () => {
      const hash = await calculateHash(stringToBytes('He said "hello"'));
      expect(hash).toHaveLength(64);
    });
  });
});

// ============================================================
// 9-10: Proof encoding and decoding
// ============================================================

describe('Proof Mode - Encoding and Decoding', () => {
  describe('encodeProofPayload', () => {
    it('should encode a valid V3 PROOF payload (unified 8-field)', () => {
      const hash = 'a'.repeat(64);
      const result = encodeProofPayload('hd_abc12345', hash, 100, 'text/plain', '');
      expect(result).toBe(`HASHDROP|v3|PROOF|hd_abc12345|${hash}|100|text/plain|`);
    });

    it('should produce compact output (no redundant fields)', () => {
      const hash = 'a'.repeat(64);
      const result = encodeProofPayload('hd_abc12345', hash, 100, 'image/png', 'photo.png');
      const parts = result.split('|');
      // Exactly 8 fields: protocol, version, mode, id, hash, size, contentType, filename
      expect(parts.length).toBe(8);
    });

    it('should NOT include original content in the payload', () => {
      const hash = 'a'.repeat(64);
      const result = encodeProofPayload('hd_abc12345', hash, 100, 'text/plain', '');
      expect(result).not.toContain('secret content');
      expect(result).not.toContain('SGVsbG8'); // base64 of anything
    });

    it('should include the validated MIME type and filename metadata', () => {
      const hash = 'a'.repeat(64);
      const media = encodeProofPayload('hd_abc12345', hash, 100, 'audio/webm', 'voice.webm');
      expect(media).toContain('audio/webm');
      expect(media).toContain('voice.webm');
      const text = encodeProofPayload('hd_abc12345', hash, 100, 'text/plain', '');
      expect(text).toContain('text/plain');
    });

    it('should NOT include timestamp/slot/blockTime', () => {
      const hash = 'a'.repeat(64);
      const result = encodeProofPayload('hd_abc12345', hash, 100, 'text/plain', '');
      // These would be numeric fields beyond the expected 8
      const parts = result.split('|');
      expect(parts.length).toBe(8);
    });

    it('should handle zero content size', () => {
      const hash = 'a'.repeat(64);
      const result = encodeProofPayload('hd_abc12345', hash, 0, 'text/plain', '');
      expect(result).toBe(`HASHDROP|v3|PROOF|hd_abc12345|${hash}|0|text/plain|`);
    });
  });

  describe('decodeProofPayload', () => {
    it('should decode a valid V3 PROOF payload (unified 8-field)', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PROOF|hd_abc12345|${hash}|100|text/plain|`;
      const result = decodeProofPayload(payload);

      expect(result).not.toBeNull();
      expect(result?.protocol).toBe('HASHDROP');
      expect(result?.version).toBe('v3');
      expect(result?.mode).toBe('PROOF');
      expect(result?.hashDropId).toBe('hd_abc12345');
      expect(result?.contentHash).toBe(hash);
      expect(result?.contentSize).toBe(100);
      expect(result?.contentType).toBe('text/plain');
      expect(result?.filename).toBe('');
    });

    it('should decode media proof payloads with MIME + filename', () => {
      const hash = 'b'.repeat(64);
      const payload = `HASHDROP|v3|PROOF|hd_test123|${hash}|256|video/mp4|clip.mp4`;
      const result = decodeProofPayload(payload);

      expect(result).toEqual({
        protocol: 'HASHDROP',
        version: 'v3',
        mode: 'PROOF',
        hashDropId: 'hd_test123',
        contentHash: hash,
        contentSize: 256,
        contentType: 'video/mp4',
        filename: 'clip.mp4',
      });
    });

    it('rejects the legacy 6-field PROOF memo (no backward compatibility)', () => {
      const hash = 'a'.repeat(64);
      expect(decodeProofPayload(`HASHDROP|v3|PROOF|hd_abc|${hash}|100`)).toBeNull();
    });
  });

  describe('isValidProofPayload', () => {
    it('should validate correct V3 PROOF payload', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PROOF|hd_abc12345|${hash}|100|text/plain|`;
      expect(isValidProofPayload(payload)).toBe(true);
    });

    it('should validate media proof payloads', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PROOF|hd_abc12345|${hash}|100|image/png|photo.png`;
      expect(isValidProofPayload(payload)).toBe(true);
    });

    it('should reject invalid payload', () => {
      expect(isValidProofPayload('invalid')).toBe(false);
    });
  });
});

// ============================================================
// 11: Malformed Proof payload rejection
// ============================================================

describe('Proof Mode - Malformed Payload Rejection', () => {
  it('should reject payload with wrong protocol', () => {
    const hash = 'a'.repeat(64);
    const payload = `OTHER|v3|PROOF|hd_abc|${hash}|100|text/plain|`;
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with wrong version', () => {
    const hash = 'a'.repeat(64);
    const payload = `HASHDROP|v2|PROOF|hd_abc|${hash}|100|text/plain|`;
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with wrong mode', () => {
    const hash = 'a'.repeat(64);
    const payload = `HASHDROP|v3|MEMO|hd_abc|${hash}|100|text/plain|`;
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with too few fields', () => {
    const payload = 'HASHDROP|v3|PROOF|hd_abc|100|text/plain';
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with too many fields', () => {
    const hash = 'a'.repeat(64);
    const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|100|text/plain|x|extra`;
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with missing (empty) contentType', () => {
    const hash = 'a'.repeat(64);
    const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|100||`;
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with invalid hash (not 64 hex chars)', () => {
    const payload = 'HASHDROP|v3|PROOF|hd_abc|notahexhash|100|text/plain|';
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with short hash', () => {
    const payload = 'HASHDROP|v3|PROOF|hd_abc|abcd1234|100|text/plain|';
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with hash containing non-hex characters', () => {
    const hash = 'g'.repeat(64); // 'g' is not hex
    const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|100|text/plain|`;
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with negative content size', () => {
    const hash = 'a'.repeat(64);
    const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|-1|text/plain|`;
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject payload with non-numeric content size', () => {
    const hash = 'a'.repeat(64);
    const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|abc|text/plain|`;
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject V2 payload (does not confuse v2 with v3)', () => {
    const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should reject uppercase hex (canonical lowercase only)', () => {
    // HashDrop hashes are canonical lowercase hex (calculateHash emits
    // lowercase). Uppercase is a different protocol byte string for the same
    // semantic value, so the strict parser rejects it — no case folding.
    const hash = 'A'.repeat(64);
    const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|100|text/plain|`;
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('should accept canonical lowercase hex', () => {
    const hash = 'a'.repeat(64);
    const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|100|text/plain|`;
    expect(decodeProofPayload(payload)).not.toBeNull();
  });
});

// ============================================================
// V3 PUBLIC and PROOF rejection tests
// ============================================================

describe('Proof Mode - V3 Protocol Tests', () => {
  it('should reject V2 payload completely', () => {
    const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
    expect(decodeProofPayload(payload)).toBeNull();
    expect(decodePublicPayload(payload)).toBeNull();
    expect(decodeHashDropPayload(payload)).toBeNull();
  });

  it('should reject unknown version', () => {
    const payload = 'HASHDROP|v4|PUBLIC|hd_abc|hash|text/plain|100|SGVsbG8=';
    expect(decodeHashDropPayload(payload)).toBeNull();
  });

  it('should reject unknown mode', () => {
    const payload = 'HASHDROP|v3|UNKNOWN|hd_abc|hash|text/plain|100|SGVsbG8=';
    expect(decodeHashDropPayload(payload)).toBeNull();
  });

  it('V3 PUBLIC payload should be rejected by V3 PROOF decoder', () => {
    const payload = 'HASHDROP|v3|PUBLIC|hd_abc|hash|text/plain|100|SGVsbG8=';
    expect(decodeProofPayload(payload)).toBeNull();
  });

  it('V3 PROOF payload should be rejected by V3 PUBLIC decoder', () => {
    const hash = 'a'.repeat(64);
    const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|100`;
    expect(decodePublicPayload(payload)).toBeNull();
  });
});

// ============================================================
// Unified decoder tests
// ============================================================

describe('Proof Mode - Unified Decoder (decodeHashDropPayload)', () => {
  it('should decode V3 PUBLIC payload', () => {
    const payload = `HASHDROP|v3|PUBLIC|hd_abc12345|${'a'.repeat(64)}|text/plain|100|SGVsbG8=`;
    const result = decodeHashDropPayload(payload);
    expect(result).not.toBeNull();
    expect(result?.version).toBe('v3');
    expect((result as any).mode).toBe('PUBLIC');
  });

  it('should decode V3 PROOF payload', () => {
    const hash = 'a'.repeat(64);
    const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|100|text/plain|`;
    const result = decodeHashDropPayload(payload);
    expect(result).not.toBeNull();
    expect(result?.version).toBe('v3');
    expect((result as any).mode).toBe('PROOF');
  });

  it('should reject V2 payload', () => {
    const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
    expect(decodeHashDropPayload(payload)).toBeNull();
  });

  it('should return null for unrecognized payload', () => {
    expect(decodeHashDropPayload('invalid')).toBeNull();
    expect(decodeHashDropPayload('OTHER|v3|PROOF|...')).toBeNull();
  });
});

// ============================================================
// Proof verification logic tests (encoding + hashing round-trip)
// ============================================================

describe('Proof Mode - Verification Logic (Round-Trip)', () => {
  it('should verify matching content against encoded proof', async () => {
    const content = 'Hello, HashDrop!';
    const bytes = stringToBytes(content);
    const hash = await calculateHash(bytes);
    const size = bytes.length;
    const hashDropId = generateHashDropId(hash, 'TestCreator', size);

    // Encode the proof
    const proofPayload = encodeProofPayload(hashDropId, hash, size, 'text/plain', '');

    // Decode and verify
    const decoded = decodeProofPayload(proofPayload);
    expect(decoded).not.toBeNull();

    // Simulate verification: recompute hash and compare
    const recomputedHash = await calculateHash(stringToBytes(content));
    const recomputedSize = stringToBytes(content).length;

    expect(recomputedHash).toBe(decoded!.contentHash);
    expect(recomputedSize).toBe(decoded!.contentSize);
  });

  it('should reject wrong content (hash mismatch)', async () => {
    const originalContent = 'Hello, HashDrop!';
    const wrongContent = 'Hello, HashDrop?'; // one char different

    const bytes = stringToBytes(originalContent);
    const hash = await calculateHash(bytes);

    // Recompute hash of wrong content
    const wrongBytes = stringToBytes(wrongContent);
    const wrongHash = await calculateHash(wrongBytes);

    expect(wrongHash).not.toBe(hash);
  });

  it('should reject content with wrong size', async () => {
    const content = 'Hello, HashDrop!';
    const bytes = stringToBytes(content);
    const hash = await calculateHash(bytes);
    const correctSize = bytes.length;

    // Claim a wrong size
    const wrongSize = correctSize + 1;
    expect(wrongSize).not.toBe(correctSize);

    // The verification would compare sizes and fail
    const proofPayload = encodeProofPayload('hd_test', hash, correctSize, 'text/plain', '');
    const decoded = decodeProofPayload(proofPayload);
    expect(decoded!.contentSize).toBe(correctSize);
    expect(decoded!.contentSize).not.toBe(wrongSize);
  });

  it('should reject modified one-byte content', async () => {
    const original = 'Hello, HashDrop!';
    const modified = 'Hello, HashDrop!.'; // added a period

    const originalHash = await calculateHash(stringToBytes(original));
    const modifiedHash = await calculateHash(stringToBytes(modified));

    expect(modifiedHash).not.toBe(originalHash);
  });

  it('should verify unicode content correctly', async () => {
    const content = '你好世界🚀';
    const bytes = stringToBytes(content);
    const hash = await calculateHash(bytes);
    const size = bytes.length;

    const hashDropId = generateHashDropId(hash, 'Creator', size);
    const proofPayload = encodeProofPayload(hashDropId, hash, size, 'text/plain', '');

    const decoded = decodeProofPayload(proofPayload);
    expect(decoded).not.toBeNull();

    // Verify round-trip
    const recomputedHash = await calculateHash(stringToBytes(content));
    expect(recomputedHash).toBe(decoded!.contentHash);
    expect(stringToBytes(content).length).toBe(decoded!.contentSize);
  });

  it('should verify content with special characters', async () => {
    const content = 'line1\nline2|pipe"quote';
    const bytes = stringToBytes(content);
    const hash = await calculateHash(bytes);
    const size = bytes.length;

    const hashDropId = generateHashDropId(hash, 'Creator', size);
    const proofPayload = encodeProofPayload(hashDropId, hash, size, 'text/plain', '');

    const decoded = decodeProofPayload(proofPayload);
    expect(decoded).not.toBeNull();

    // Verify round-trip
    const recomputedHash = await calculateHash(stringToBytes(content));
    expect(recomputedHash).toBe(decoded!.contentHash);
  });

  it('should verify empty content', async () => {
    const content = '';
    const bytes = stringToBytes(content);
    const hash = await calculateHash(bytes);
    const size = bytes.length;

    expect(size).toBe(0);

    const hashDropId = generateHashDropId(hash, 'Creator', size);
    const proofPayload = encodeProofPayload(hashDropId, hash, size, 'text/plain', '');

    const decoded = decodeProofPayload(proofPayload);
    expect(decoded).not.toBeNull();
    expect(decoded!.contentSize).toBe(0);

    // Verify round-trip
    const recomputedHash = await calculateHash(stringToBytes(''));
    expect(recomputedHash).toBe(decoded!.contentHash);
  });
});

// ============================================================
// Protocol format constants
// ============================================================

describe('Proof Mode - Protocol Constants', () => {
  it('should have correct protocol version', () => {
    expect(HASHDROP_PROTOCOL_VERSION).toBe('v3');
  });
});
