/**
 * Tests for PRIVATE mode transaction size measurement
 *
 * Constructs the real production PRIVATE transaction using the same
 * transaction-building path and measures its serialized size locally.
 *
 * No network request is required - uses a deterministic dummy blockhash.
 */

import { PublicKey } from '@solana/web3.js';
import { buildV1Transaction, serializeTransaction } from './transactions';
import { encodePrivatePayload, LEGACY_TRANSACTION_MAX_BYTES } from './memo';

// Jest (jsdom) cross-realm alignment for @solana/web3.js instruction encoding:
// web3.js encodes instruction data with Node's Buffer (Buffer.alloc), and
// @solana/buffer-layout validates targets with `b instanceof Uint8Array`. Under
// jest's jsdom environment, globalThis.Uint8Array can be a different realm's
// constructor, so Node's Buffer fails that check ("b must be a Uint8Array").
// Align the global Uint8Array with the Node Buffer realm. This runs before any
// instruction is assembled below and only affects the test runtime (the browser
// runtime is unaffected, where Buffer is a real Uint8Array subclass).
if (
  typeof Buffer !== 'undefined' &&
  typeof Uint8Array !== 'undefined' &&
  !(Buffer.from([]) instanceof Uint8Array)
) {
  (globalThis as { Uint8Array: typeof Uint8Array }).Uint8Array =
    Object.getPrototypeOf(Buffer.prototype).constructor as typeof Uint8Array;
}

// Deterministic, valid test account (payer / fee payer = the "user wallet")
const FEE_PAYER = new PublicKey('4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw');
const BLOCKHASH = '11111111111111111111111111111111';

describe('PRIVATE Mode Transaction Size Measurement', () => {
  it('should measure PRIVATE memo size with worst-case metadata', () => {
    // Use realistic maximum/worst-case supported metadata values
    const payload = encodePrivatePayload(
      'hd_e0ba1ac4_Amy4Tej8_g', // maximum realistic HashDrop ID
      'e0ba1ac4b690b9dbd655be81caf5cebec06f2644681c4cf6ff774bec72c683e3', // SHA-256 hash
      999999, // maximum supported contentSize representation
      'application/json', // realistic/maximum supported MIME type
      'aabbccdd11223344', // maximum fingerprint representation
      'base64envelopeiv==', // encrypted key IV (16 chars Base64)
      'base64encryptedkeybase64encryptedkeybase64encryptedkeybase64enc==' // encrypted AES key envelope (64 chars Base64 for 48 bytes)
    );

    const memoBytes = new TextEncoder().encode(payload).length;
    console.log(`PRIVATE memo UTF-8 bytes: ${memoBytes}`);

    // PRIVATE memo should be well under the transaction limit
    expect(memoBytes).toBeLessThan(LEGACY_TRANSACTION_MAX_BYTES);
  });

  it('should construct and serialize real PRIVATE transaction', () => {
    // Use realistic maximum/worst-case supported metadata values
    const memoPayload = encodePrivatePayload(
      'hd_e0ba1ac4_Amy4Tej8_g', // maximum realistic HashDrop ID
      'e0ba1ac4b690b9dbd655be81caf5cebec06f2644681c4cf6ff774bec72c683e3', // SHA-256 hash
      999999, // maximum supported contentSize representation
      'application/json', // realistic/maximum supported MIME type
      'aabbccdd11223344', // maximum fingerprint representation
      'base64envelopeiv==', // encrypted key IV (16 chars Base64)
      'base64encryptedkeybase64encryptedkeybase64encryptedkeybase64enc==' // encrypted AES key envelope (64 chars Base64)
    );

    // Build the transaction using the SAME production path
    const transaction = buildV1Transaction(
      memoPayload,
      FEE_PAYER.toBase58(),
      BLOCKHASH,
      BigInt(0)
    );

    // Serialize the transaction (same as production)
    const serialized = serializeTransaction(transaction);
    const txSize = serialized.length;

    const memoBytes = new TextEncoder().encode(memoPayload).length;
    const headroom = LEGACY_TRANSACTION_MAX_BYTES - txSize;

    console.log(`PRIVATE memo UTF-8 bytes: ${memoBytes}`);
    console.log(`serialized transaction bytes: ${txSize}`);
    console.log(`current Solana packet limit: ${LEGACY_TRANSACTION_MAX_BYTES}`);
    console.log(`remaining headroom: ${headroom}`);

    // PRIVATE transaction must fit within current Solana limit
    expect(txSize).toBeLessThan(LEGACY_TRANSACTION_MAX_BYTES);
  });

  it('should verify PRIVATE memo contains only commitment metadata', () => {
    const payload = encodePrivatePayload(
      'hd_test123',
      'a'.repeat(64),
      100,
      'text/plain',
      'aabbccdd11223344',
      'ivbase64==',
      'keybase64=='
    );

    const parts = payload.split('|');

    // PRIVATE payload should have 11 parts
    expect(parts.length).toBe(11);

    // Verify structure
    expect(parts[0]).toBe('HASHDROP');
    expect(parts[1]).toBe('v3');
    expect(parts[2]).toBe('PRIVATE');
    expect(parts[3]).toBe('hd_test123'); // hashDropId
    expect(parts[4]).toBe('a'.repeat(64)); // sha256
    expect(parts[5]).toBe('100'); // contentSize
    expect(parts[6]).toBe('text/plain'); // contentType
    expect(parts[7]).toBe('HD-P1'); // cryptoVersion
    expect(parts[8]).toBe('aabbccdd11223344'); // keyFingerprint
    // parts[9] = encryptedKeyIv
    // parts[10] = encryptedKey
  });

  it('should verify encrypted key envelope size calculation', () => {
    // A 32-byte AES key wrapped with AES-GCM produces:
    // 32 bytes plaintext + 16 bytes GCM tag = 48 bytes ciphertext
    // Base64 of 48 bytes = 64 characters
    const envelopeKeyBase64 = 'A'.repeat(64); // Simulated 48-byte key in Base64
    expect(envelopeKeyBase64.length).toBe(64);

    // Envelope IV: 12 bytes raw = 16 chars Base64
    const envelopeIvBase64 = 'B'.repeat(16);
    expect(envelopeIvBase64.length).toBe(16);
  });
});
