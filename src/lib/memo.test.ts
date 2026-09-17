/**
 * Tests for HashDrop Protocol Module (V3 only)
 */

import {
  encodePublicPayload,
  decodePublicPayload,
  isValidPublicPayload,
  decodeProofPayload,
  isValidProofPayload,
  MEMO_PROGRAM_ID,
  HASHDROP_PROTOCOL_VERSION,
} from './memo';
import {
  LEGACY_TRANSACTION_MAX_BYTES,
  V1_TRANSACTION_MAX_BYTES,
} from './solana/transactionCapabilities';

describe('Protocol Module', () => {
  describe('encodePublicPayload', () => {
    it('should encode V3 PUBLIC payload correctly', () => {
      const result = encodePublicPayload(
        'hd_abc12345',
        'hash1234567890abcdef',
        'text/plain',
        100,
        'SGVsbG8sIFdvcmxk'
      );
      expect(result).toBe('HASHDROP|v3|PUBLIC|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8sIFdvcmxk');
    });

    it('should handle unicode content', () => {
      const result = encodePublicPayload(
        'hd_abc12345',
        'hash1234567890abcdef',
        'text/plain',
        10,
        'SGVsbG8sIEhhc2g=' // "Hello, Hash" in base64
      );
      expect(result).toContain('HASHDROP|v3|PUBLIC|');
    });
  });

  describe('decodePublicPayload', () => {
    const CANONICAL_HASH = 'a'.repeat(64); // canonical lowercase SHA-256

    it('should decode valid V3 PUBLIC payload', () => {
      const payload = `HASHDROP|v3|PUBLIC|hd_abc12345|${CANONICAL_HASH}|text/plain|100|SGVsbG8sIFdvcmxk`;
      const result = decodePublicPayload(payload);

      expect(result).not.toBeNull();
      expect(result?.protocol).toBe('HASHDROP');
      expect(result?.version).toBe('v3');
      expect(result?.mode).toBe('PUBLIC');
      expect(result?.hashDropId).toBe('hd_abc12345');
      expect(result?.contentHash).toBe(CANONICAL_HASH);
      expect(result?.contentType).toBe('text/plain');
      expect(result?.contentSize).toBe(100);
      expect(result?.content).toBe('SGVsbG8sIFdvcmxk');
    });

    it('should return null for invalid payload', () => {
      expect(decodePublicPayload('invalid')).toBeNull();
      expect(decodePublicPayload('HASHDROP|v2|...')).toBeNull(); // wrong version
      expect(decodePublicPayload('OTHER|v3|PUBLIC|...')).toBeNull(); // wrong protocol
    });

    it('should handle malformed size', () => {
      const payload = 'HASHDROP|v3|PUBLIC|hd_abc12345|hash1234567890abcdef|text/plain|abc|SGVsbG8=';
      expect(decodePublicPayload(payload)).toBeNull();
    });

    it('should reject V2 payload', () => {
      const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
      expect(decodePublicPayload(payload)).toBeNull();
    });
  });

  describe('isValidPublicPayload', () => {
    it('should validate correct V3 PUBLIC payload', () => {
      const payload = `HASHDROP|v3|PUBLIC|hd_abc12345|${'a'.repeat(64)}|text/plain|100|SGVsbG8=`;
      expect(isValidPublicPayload(payload)).toBe(true);
    });

    it('should reject invalid payload', () => {
      expect(isValidPublicPayload('invalid')).toBe(false);
    });

    it('should reject V2 payload', () => {
      const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
      expect(isValidPublicPayload(payload)).toBe(false);
    });
  });

  describe('canonical size & required-field strictness (PUBLIC)', () => {
    const id = 'hd_abc12345';
    const hash = 'a'.repeat(64);

    it('should accept canonical decimal sizes', () => {
      for (const [text, value] of [['0', 0], ['1', 1], ['10', 10], ['100', 100], ['1000', 1000]] as const) {
        const memo = `HASHDROP|v3|PUBLIC|${id}|${hash}|text/plain|${text}|SGVsbG8=`;
        expect(decodePublicPayload(memo)?.contentSize).toBe(value);
      }
    });

    it('should reject non-canonical size representations', () => {
      const prefix = `HASHDROP|v3|PUBLIC|${id}|${hash}|text/plain`;
      for (const size of ['00', '01', '00100', '+100', '-1', '1.0', '100abc', 'abc100', ' 100', '100 ', '\t100', '']) {
        expect(decodePublicPayload(`${prefix}|${size}|SGVsbG8=`)).toBeNull();
      }
    });

    it('should reject an unsafe integer size', () => {
      const memo = `HASHDROP|v3|PUBLIC|${id}|${hash}|text/plain|10000000000000000000000|SGVsbG8=`;
      expect(decodePublicPayload(memo)).toBeNull();
    });

    it('should reject an empty HashDrop ID', () => {
      const memo = `HASHDROP|v3|PUBLIC||${hash}|text/plain|100|SGVsbG8=`;
      expect(decodePublicPayload(memo)).toBeNull();
    });
  });

  describe('canonical SHA-256 hash validation (PUBLIC)', () => {
    const id = 'hd_abc12345';

    function publicMemoWithHash(hash: string): string {
      return `HASHDROP|v3|PUBLIC|${id}|${hash}|text/plain|100|SGVsbG8=`;
    }

    it('accepts a valid canonical lowercase 64-hex hash', () => {
      const result = decodePublicPayload(publicMemoWithHash('a'.repeat(64)));
      expect(result).not.toBeNull();
      expect(result?.contentHash).toBe('a'.repeat(64));
    });

    it('rejects an uppercase hash (canonical lowercase only)', () => {
      expect(decodePublicPayload(publicMemoWithHash('A'.repeat(64)))).toBeNull();
    });

    it('rejects a too-short hash', () => {
      expect(decodePublicPayload(publicMemoWithHash('a'.repeat(63)))).toBeNull();
    });

    it('rejects a too-long hash', () => {
      expect(decodePublicPayload(publicMemoWithHash(`${'a'.repeat(64)}00`))).toBeNull();
    });

    it('rejects a non-hex hash', () => {
      expect(decodePublicPayload(publicMemoWithHash('g'.repeat(64)))).toBeNull();
      expect(decodePublicPayload(publicMemoWithHash(`${'a'.repeat(62)}zz`))).toBeNull();
    });

    it('rejects an empty hash', () => {
      expect(decodePublicPayload(publicMemoWithHash(''))).toBeNull();
    });

    it('rejects whitespace-padded hashes (no trimming)', () => {
      expect(decodePublicPayload(publicMemoWithHash(` ${'a'.repeat(64)}`))).toBeNull();
      expect(decodePublicPayload(publicMemoWithHash(`${'a'.repeat(64)} `))).toBeNull();
    });
  });

  describe('canonical size & required-field strictness (PROOF)', () => {
    const hash = 'a'.repeat(64);

    function proofMemo(size: string, id = 'hd_abc12345'): string {
      return `HASHDROP|v3|PROOF|${id}|${hash}|${size}|text/plain|`;
    }

    it('should accept canonical decimal sizes', () => {
      expect(decodeProofPayload(proofMemo('0'))?.contentSize).toBe(0);
      expect(decodeProofPayload(proofMemo('1'))?.contentSize).toBe(1);
      expect(decodeProofPayload(proofMemo('100'))?.contentSize).toBe(100);
      expect(isValidProofPayload(proofMemo('1000'))).toBe(true);
    });

    it('should reject non-canonical size representations', () => {
      for (const size of ['00', '01', '0100', '+100', '-1', '1.0', '100abc', 'abc100', ' 100', '100 ', '\t100', '']) {
        expect(decodeProofPayload(proofMemo(size))).toBeNull();
      }
    });

    it('should reject an unsafe integer size', () => {
      expect(decodeProofPayload(proofMemo('9007199254740992'))).toBeNull();
    });

    it('should reject uppercase hex content hashes (canonical lowercase only)', () => {
      const memo = `HASHDROP|v3|PROOF|hd_abc|${'A'.repeat(64)}|100|text/plain|`;
      expect(decodeProofPayload(memo)).toBeNull();
    });

    it('should reject an empty HashDrop ID', () => {
      expect(decodeProofPayload(proofMemo('100', ''))).toBeNull();
    });
  });

  describe('protocol version', () => {
    it('should have correct version', () => {
      expect(HASHDROP_PROTOCOL_VERSION).toBe('v3');
    });
  });

  describe('constants', () => {
    it('should have correct Memo program ID', () => {
      expect(MEMO_PROGRAM_ID).toBe('Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH');
    });

    it('should have correct transaction size limits', () => {
      expect(LEGACY_TRANSACTION_MAX_BYTES).toBe(1232);
      expect(V1_TRANSACTION_MAX_BYTES).toBe(4096);
    });
  });
});