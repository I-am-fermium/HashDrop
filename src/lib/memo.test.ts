/**
 * Tests for HashDrop Protocol Module (V3 only)
 */

import {
  encodePublicPayload,
  decodePublicPayload,
  isValidPublicPayload,
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
    it('should decode valid V3 PUBLIC payload', () => {
      const payload = 'HASHDROP|v3|PUBLIC|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8sIFdvcmxk';
      const result = decodePublicPayload(payload);

      expect(result).not.toBeNull();
      expect(result?.protocol).toBe('HASHDROP');
      expect(result?.version).toBe('v3');
      expect(result?.mode).toBe('PUBLIC');
      expect(result?.hashDropId).toBe('hd_abc12345');
      expect(result?.contentHash).toBe('hash1234567890abcdef');
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
      const payload = 'HASHDROP|v3|PUBLIC|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
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