/**
 * Primitive-level known-answer test for the HashDrop HKDF-SHA-256 wrapper.
 *
 * Protocol round-trip tests prove the wrapper is self-consistent (encrypt →
 * decrypt with the same inputs); this test proves it computes textbook
 * RFC 5869 HKDF-SHA-256 against a PUBLISHED vector — catching any accidental
 * parameter drift, salt/info mishandling, or refactor error inside the
 * in-repo extract/expand implementation that round-trip tests cannot detect.
 */

import { hkdfSha256 } from './hkdf';

describe('HKDF-SHA-256 primitive (RFC 5869 known-answer)', () => {
  it('matches RFC 5869 test case 1 (SHA-256, extract+expand, L=42)', async () => {
    // RFC 5869 Appendix A, Test Case 1 (SHA-256), inputs in hex:
    const ikm = new Uint8Array(Buffer.from('0b'.repeat(22), 'hex'));
    const salt = new Uint8Array(Buffer.from('000102030405060708090a0b0c', 'hex'));
    const info = new Uint8Array(Buffer.from('f0f1f2f3f4f5f6f7f8f9', 'hex'));

    const okm = await hkdfSha256(ikm, salt, info, 42);

    const expected = Buffer.from(
      '3cb25f25faacd57a90434f64d0362f2a' +
      '2d2d0a90cf1a5a4c5db02d56ecc4c5bf' +
      '34007208d5b887185865',
      'hex'
    );

    expect(okm.length).toBe(42);
    expect(Buffer.from(okm).equals(expected)).toBe(true);
  });
});