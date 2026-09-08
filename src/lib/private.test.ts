/**
 * Tests for HashDrop V3 PRIVATE Mode Protocol
 */

import {
  encodePrivatePayload,
  decodePrivatePayload,
  isValidPrivatePayload,
  encodePublicPayload,
  encodeProofPayload,
  decodeHashDropPayload,
  HASHDROP_PROTOCOL_VERSION,
} from './memo';

describe('V3 PRIVATE Mode Protocol', () => {
  describe('encodePrivatePayload', () => {
    it('should encode a valid V3 PRIVATE payload', () => {
      const hash = 'a'.repeat(64);
      const iv = 'base64iv';
      const encKey = 'base64enckey';

      const result = encodePrivatePayload('hd_abc12345', hash, 100, 'text/plain', 'aabbccdd11223344', iv, encKey);

      expect(result).toBe(`HASHDROP|v3|PRIVATE|hd_abc12345|${hash}|100|text/plain|HD-P1|aabbccdd11223344|${iv}|${encKey}`);
    });

    it('should NOT include original content in the payload', () => {
      const hash = 'a'.repeat(64);
      const result = encodePrivatePayload('hd_abc', hash, 100, 'text/plain', 'aabbccdd11223344', 'iv', 'enckey');
      expect(result).not.toContain('secret content');
    });
  });

  describe('decodePrivatePayload', () => {
    it('should decode a valid V3 PRIVATE payload', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PRIVATE|hd_abc12345|${hash}|100|text/plain|HD-P1|aabbccdd11223344|ivbase64|enckeybase64`;

      const result = decodePrivatePayload(payload);

      expect(result).not.toBeNull();
      expect(result?.protocol).toBe('HASHDROP');
      expect(result?.version).toBe('v3');
      expect(result?.mode).toBe('PRIVATE');
      expect(result?.hashDropId).toBe('hd_abc12345');
      expect(result?.contentHash).toBe(hash);
      expect(result?.contentSize).toBe(100);
      expect(result?.contentType).toBe('text/plain');
      expect(result?.cryptoVersion).toBe('HD-P1');
      expect(result?.keyFingerprint).toBe('aabbccdd11223344');
      expect(result?.encryptedKeyIv).toBe('ivbase64');
      expect(result?.encryptedKey).toBe('enckeybase64');
    });

    it('should return null for invalid payload', () => {
      expect(decodePrivatePayload('invalid')).toBeNull();
    });

    it('should reject V2 payload', () => {
      const payload = 'HASHDROP|v2|MEMO|hd_abc|hash|text/plain|100|SGVsbG8=';
      expect(decodePrivatePayload(payload)).toBeNull();
    });

    it('should reject wrong field count', () => {
      const payload = 'HASHDROP|v3|PRIVATE|hd_abc|hash|100';
      expect(decodePrivatePayload(payload)).toBeNull();
    });

    it('should reject invalid hash format', () => {
      const payload = 'HASHDROP|v3|PRIVATE|hd_abc|notahexhash|100|text/plain|HD-P1|aabbccdd11223344|iv|enckey';
      expect(decodePrivatePayload(payload)).toBeNull();
    });

    it('should reject negative content size', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PRIVATE|hd_abc|${hash}|-1|text/plain|HD-P1|aabbccdd11223344|iv|enckey`;
      expect(decodePrivatePayload(payload)).toBeNull();
    });
  });

  describe('isValidPrivatePayload', () => {
    it('should validate correct V3 PRIVATE payload', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PRIVATE|hd_abc12345|${hash}|100|text/plain|HD-P1|aabbccdd11223344|ivbase64|enckeybase64`;
      expect(isValidPrivatePayload(payload)).toBe(true);
    });

    it('should reject invalid payload', () => {
      expect(isValidPrivatePayload('invalid')).toBe(false);
    });
  });

  describe('unified decoder (decodeHashDropPayload)', () => {
    it('should decode V3 PUBLIC payload', () => {
      const payload = 'HASHDROP|v3|PUBLIC|hd_abc|hash|text/plain|100|SGVsbG8=';
      const result = decodeHashDropPayload(payload);
      expect(result).not.toBeNull();
      expect(result?.mode).toBe('PUBLIC');
    });

    it('should decode V3 PROOF payload', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|100`;
      const result = decodeHashDropPayload(payload);
      expect(result).not.toBeNull();
      expect(result?.mode).toBe('PROOF');
    });

    it('should decode V3 PRIVATE payload', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PRIVATE|hd_abc|${hash}|100|text/plain|HD-P1|aabbccdd11223344|iv|enckey`;
      const result = decodeHashDropPayload(payload);
      expect(result).not.toBeNull();
      expect(result?.mode).toBe('PRIVATE');
    });

    it('should reject V2 payload', () => {
      const payload = 'HASHDROP|v2|MEMO|hd_abc|hash|text/plain|100|SGVsbG8=';
      expect(decodeHashDropPayload(payload)).toBeNull();
    });

    it('should reject unknown mode', () => {
      const payload = 'HASHDROP|v3|UNKNOWN|hd_abc|hash|text/plain|100';
      expect(decodeHashDropPayload(payload)).toBeNull();
    });

    it('should reject unknown version', () => {
      const payload = 'HASHDROP|v4|PUBLIC|hd_abc|hash|text/plain|100|SGVsbG8=';
      expect(decodeHashDropPayload(payload)).toBeNull();
    });
  });

  describe('protocol version', () => {
    it('should have correct version', () => {
      expect(HASHDROP_PROTOCOL_VERSION).toBe('v3');
    });
  });
});
