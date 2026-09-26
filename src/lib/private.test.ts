/**
 * Tests for HashDrop V3 PRIVATE Mode Protocol
 */

import {
  encodePrivatePayload,
  decodePrivatePayload,
  isValidPrivatePayload,
  decodeHashDropPayload,
  detectObsoletePrivatePayload,
  obsoletePrivateProtocolError,
  HASHDROP_PROTOCOL_VERSION,
  HASHDROP_PRIVATE_CRYPTO_VERSION,
  HASHDROP_OBSOLETE_PRIVATE_CRYPTO_VERSIONS,
} from './memo';

describe('V3 PRIVATE Mode Protocol', () => {
  describe('encodePrivatePayload', () => {
    it('should encode a valid V3 PRIVATE payload', () => {
      const hash = 'a'.repeat(64);
      const iv = 'base64iv';
      const encKey = 'base64enckey';

      const result = encodePrivatePayload('hd_abc12345', hash, 100, 'text/plain', 'aabbccdd11223344', iv, encKey);

      expect(result).toBe(`HASHDROP|v3|PRIVATE|hd_abc12345|${hash}|100|text/plain|HD-P2|aabbccdd11223344|${iv}|${encKey}`);
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
      const payload = `HASHDROP|v3|PRIVATE|hd_abc12345|${hash}|100|text/plain|HD-P2|aabbccdd11223344|ivbase64|enckeybase64`;

      const result = decodePrivatePayload(payload);

      expect(result).not.toBeNull();
      expect(result?.protocol).toBe('HASHDROP');
      expect(result?.version).toBe('v3');
      expect(result?.mode).toBe('PRIVATE');
      expect(result?.hashDropId).toBe('hd_abc12345');
      expect(result?.contentHash).toBe(hash);
      expect(result?.contentSize).toBe(100);
      expect(result?.contentType).toBe('text/plain');
      expect(result?.cryptoVersion).toBe('HD-P2');
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
      const payload = 'HASHDROP|v3|PRIVATE|hd_abc|notahexhash|100|text/plain|HD-P2|aabbccdd11223344|iv|enckey';
      expect(decodePrivatePayload(payload)).toBeNull();
    });

    it('should reject negative content size', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PRIVATE|hd_abc|${hash}|-1|text/plain|HD-P2|aabbccdd11223344|iv|enckey`;
      expect(decodePrivatePayload(payload)).toBeNull();
    });
  });

  describe('isValidPrivatePayload', () => {
    it('should validate correct V3 PRIVATE payload', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PRIVATE|hd_abc12345|${hash}|100|text/plain|HD-P2|aabbccdd11223344|ivbase64|enckeybase64`;
      expect(isValidPrivatePayload(payload)).toBe(true);
    });

    it('should reject invalid payload', () => {
      expect(isValidPrivatePayload('invalid')).toBe(false);
    });
  });

  describe('strict crypto version (HD-P2 only)', () => {
    const hash = 'a'.repeat(64);

    function privateMemo(version: string): string {
      return `HASHDROP|v3|PRIVATE|hd_abc12345|${hash}|100|text/plain|${version}|aabbccdd11223344|ivbase64|enckeybase64`;
    }

    it('accepts exactly the canonical protocol version (the exported constant)', () => {
      expect(HASHDROP_PRIVATE_CRYPTO_VERSION).toBe('HD-P2');
      const decoded = decodePrivatePayload(privateMemo(HASHDROP_PRIVATE_CRYPTO_VERSION));
      expect(decoded).not.toBeNull();
      expect(decoded?.cryptoVersion).toBe('HD-P2');
      expect(isValidPrivatePayload(privateMemo('HD-P2'))).toBe(true);
    });

    it('rejects other, older, newer and unknown versions', () => {
      for (const version of ['HD-P1', 'HD-P3', 'HD-X', 'HD', 'P2', 'HD-P22', 'HD-P', 'version2', 'HD-P2-P2']) {
        expect(decodePrivatePayload(privateMemo(version))).toBeNull();
        expect(isValidPrivatePayload(privateMemo(version))).toBe(false);
      }
    });

    it('rejects an empty version', () => {
      expect(decodePrivatePayload(privateMemo(''))).toBeNull();
      expect(isValidPrivatePayload(privateMemo(''))).toBe(false);
    });

    it('rejects whitespace and case variants without trimming or folding', () => {
      for (const version of ['HD-P2 ', ' HD-P2', 'HD- P2', 'hd-p2', 'HD-p2', 'hd-P2', 'HD\tP2']) {
        expect(decodePrivatePayload(privateMemo(version))).toBeNull();
      }
    });

    it('a modified crypto version cannot reach decryption (unified decoder rejects it)', () => {
      // The Viewer dispatches through decodeHashDropPayload; a tampered version
      // fails at PARSE time, long before any ML-KEM/AES-GCM operation runs.
      expect(decodeHashDropPayload(privateMemo('HD-P1'))).toBeNull();
      expect(decodeHashDropPayload(privateMemo('HD-P3'))).toBeNull();
    });
  });

  describe('obsolete PRIVATE constructions (HD-P1)', () => {
    const hash = 'a'.repeat(64);

    function privateMemo(version: string): string {
      return `HASHDROP|v3|PRIVATE|hd_abc12345|${hash}|100|text/plain|${version}|aabbccdd11223344|ivbase64|enckeybase64`;
    }

    it('declares HD-P1 as the only obsolete construction', () => {
      expect(HASHDROP_OBSOLETE_PRIVATE_CRYPTO_VERSIONS).toEqual(['HD-P1']);
    });

    it('detects HD-P1 so retrieval can reject it explicitly', () => {
      expect(detectObsoletePrivatePayload(privateMemo('HD-P1'))).toBe('HD-P1');
    });

    it('does not flag HD-P2 (or any other version) as obsolete', () => {
      expect(detectObsoletePrivatePayload(privateMemo('HD-P2'))).toBeNull();
      expect(detectObsoletePrivatePayload(privateMemo('HD-P3'))).toBeNull();
      expect(detectObsoletePrivatePayload(privateMemo(''))).toBeNull();
    });

    it('does not flag non-PRIVATE or malformed payloads as obsolete', () => {
      // PUBLIC/PROOF are not PRIVATE payloads at all.
      expect(
        detectObsoletePrivatePayload(`HASHDROP|v3|PUBLIC|hd_x|${hash}|text/plain|1|QUJD`)
      ).toBeNull();
      expect(
        detectObsoletePrivatePayload(`HASHDROP|v3|PROOF|hd_x|${hash}|1|text/plain|`)
      ).toBeNull();
      // Non-V3, wrong field count, and empty memos are never "obsolete PRIVATE".
      expect(
        detectObsoletePrivatePayload(
          `HASHDROP|v2|PRIVATE|hd_x|${hash}|100|text/plain|HD-P1|aabbccdd11223344|iv|key`
        )
      ).toBeNull();
      expect(
        detectObsoletePrivatePayload(
          `HASHDROP|v3|PRIVATE|hd_x|${hash}|100|text/plain|HD-P1|aabbccdd11223344|iv`
        )
      ).toBeNull();
      expect(detectObsoletePrivatePayload('')).toBeNull();
    });

    it('produces an explicit unsupported-protocol message (never "valid")', () => {
      const message = obsoletePrivateProtocolError('HD-P1');
      expect(message).toContain('HD-P1');
      expect(message).toContain('obsolete');
      expect(message).toContain('HD-P2');
      expect(message).toContain('cannot be decrypted or verified');
    });
  });

  describe('canonical size parsing (PRIVATE)', () => {
    const hash = 'a'.repeat(64);

    function privateMemo(size: string): string {
      return `HASHDROP|v3|PRIVATE|hd_abc12345|${hash}|${size}|text/plain|HD-P2|aabbccdd11223344|ivbase64|enckeybase64`;
    }

    it('accepts canonical decimal sizes', () => {
      for (const [text, value] of [['0', 0], ['1', 1], ['10', 10], ['100', 100], ['1000', 1000]] as const) {
        expect(decodePrivatePayload(privateMemo(text))?.contentSize).toBe(value);
      }
    });

    it('accepts the largest valid safe integer', () => {
      expect(decodePrivatePayload(privateMemo('9007199254740991'))?.contentSize).toBe(9007199254740991);
    });

    it('rejects non-canonical representations', () => {
      for (const size of ['00', '01', '0100', '+100', '-1', '1.0', '100abc', 'abc100', ' 100', '100 ', '\t100', '']) {
        expect(decodePrivatePayload(privateMemo(size))).toBeNull();
      }
    });

    it('rejects unsafe integers (outside the safe integer range)', () => {
      for (const size of ['9007199254740992', '9007199254740993', '10000000000000000000000']) {
        expect(decodePrivatePayload(privateMemo(size))).toBeNull();
      }
    });
  });

  describe('required-field strictness (PRIVATE)', () => {
    const hash = 'a'.repeat(64);

    it('rejects an empty hashDropId', () => {
      const memo = `HASHDROP|v3|PRIVATE||${hash}|100|text/plain|HD-P2|aabbccdd11223344|ivbase64|enckeybase64`;
      expect(decodePrivatePayload(memo)).toBeNull();
    });

    it('rejects an empty contentType', () => {
      const memo = `HASHDROP|v3|PRIVATE|hd_abc|${hash}|100||HD-P2|aabbccdd11223344|ivbase64|enckeybase64`;
      expect(decodePrivatePayload(memo)).toBeNull();
    });

    it('rejects uppercase hex commitments (canonical lowercase only)', () => {
      const memo = `HASHDROP|v3|PRIVATE|hd_abc|${'A'.repeat(64)}|100|text/plain|HD-P2|aabbccdd11223344|ivbase64|enckeybase64`;
      expect(decodePrivatePayload(memo)).toBeNull();
    });

    it('rejects uppercase hex fingerprints (canonical lowercase only)', () => {
      const memo = `HASHDROP|v3|PRIVATE|hd_abc|${hash}|100|text/plain|HD-P2|AABBCCDD11223344|ivbase64|enckeybase64`;
      expect(decodePrivatePayload(memo)).toBeNull();
    });

    it('rejects non-hex and wrong-length fingerprints', () => {
      for (const fp of ['aabbccdd1122334', 'aabbccdd1122334455', 'gg', 'zz'.repeat(8)]) {
        const memo = `HASHDROP|v3|PRIVATE|hd_abc|${hash}|100|text/plain|HD-P2|${fp}|ivbase64|enckeybase64`;
        expect(decodePrivatePayload(memo)).toBeNull();
      }
    });
  });

  describe('unified decoder (decodeHashDropPayload)', () => {
    it('should decode V3 PUBLIC payload', () => {
      const payload = `HASHDROP|v3|PUBLIC|hd_abc|${'a'.repeat(64)}|text/plain|100|SGVsbG8=`;
      const result = decodeHashDropPayload(payload);
      expect(result).not.toBeNull();
      expect(result?.mode).toBe('PUBLIC');
    });

    it('should decode V3 PROOF payload', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PROOF|hd_abc|${hash}|100|text/plain|`;
      const result = decodeHashDropPayload(payload);
      expect(result).not.toBeNull();
      expect(result?.mode).toBe('PROOF');
    });

    it('should decode V3 PRIVATE payload', () => {
      const hash = 'a'.repeat(64);
      const payload = `HASHDROP|v3|PRIVATE|hd_abc|${hash}|100|text/plain|HD-P2|aabbccdd11223344|iv|enckey`;
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
