/**
 * Regression tests for transaction-signature validation.
 *
 * Bug class: the Viewer previously validated user-entered signatures with a
 * hard-coded textual length (`signature.length < 88`), rejecting REAL
 * Mainnet signatures: Base58 of a 64-byte ed25519 signature is 87 OR 88
 * characters. Canonical validation (trim -> Base58 decode -> exactly 64
 * bytes) is network-independent.
 *
 * Real signatures used here (public on-chain identifiers, not secrets):
 * - Mainnet: RhpUZ6jSGfcwF8oc1PVhqLQLneDx9zsoearLCgv58f2pqi1KWWHGCBpjDRgTYpChruTVh2bqXSDXCGEqmnx381e (87 chars)
 * - Devnet:  4n8Uibg92YushsYrVzczCXuursWwkG3rbwBMKiZ7U9T7UTDQVseASVmbiFoj51KdZTrSiJitRZu4C6aRkvjNMcCn (88 chars)
 */

import {
  normalizeTransactionSignature,
  SIGNATURE_BYTE_LENGTH,
} from './signature';

const MAINNET_SIGNATURE =
  'RhpUZ6jSGfcwF8oc1PVhqLQLneDx9zsoearLCgv58f2pqi1KWWHGCBpjDRgTYpChruTVh2bqXSDXCGEqmnx381e';
const DEVNET_SIGNATURE =
  '4n8Uibg92YushsYrVzczCXuursWwkG3rbwBMKiZ7U9T7UTDQVseASVmbiFoj51KdZTrSiJitRZu4C6aRkvjNMcCn';

describe('normalizeTransactionSignature', () => {
  it('accepts the real 87-character Mainnet signature', () => {
    // 87 chars — previously rejected by the `length < 88` check
    expect(MAINNET_SIGNATURE.length).toBe(87);
    expect(normalizeTransactionSignature(MAINNET_SIGNATURE)).toBe(MAINNET_SIGNATURE);
  });

  it('accepts the real 88-character Devnet signature', () => {
    expect(DEVNET_SIGNATURE.length).toBe(88);
    expect(normalizeTransactionSignature(DEVNET_SIGNATURE)).toBe(DEVNET_SIGNATURE);
  });

  it('rejects strings containing invalid Base58 characters', () => {
    // 0, O, I, l are not in the Base58 alphabet; symbols are invalid too
    expect(normalizeTransactionSignature('0OIl' + '1'.repeat(84))).toBeNull();
    expect(normalizeTransactionSignature('not-a-signature!')).toBeNull();
    expect(normalizeTransactionSignature('abc$%')).toBeNull();
  });

  it('rejects Base58 values that do not decode to exactly 64 bytes', () => {
    // A Solana wallet address is valid Base58 but 32 bytes
    expect(normalizeTransactionSignature('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')).toBeNull();
    // 63 zero bytes ('1' = 0x00 in Base58) -> 63 decoded bytes
    expect(normalizeTransactionSignature('1'.repeat(63))).toBeNull();
    // 65 zero bytes -> 65 decoded bytes
    expect(normalizeTransactionSignature('1'.repeat(65))).toBeNull();
    // Short content
    expect(normalizeTransactionSignature('2')).toBeNull();
  });

  it('normalizes leading/trailing whitespace and newlines', () => {
    expect(normalizeTransactionSignature(`  ${MAINNET_SIGNATURE}\n`)).toBe(MAINNET_SIGNATURE);
    expect(normalizeTransactionSignature(`\t${DEVNET_SIGNATURE} `)).toBe(DEVNET_SIGNATURE);
  });

  it('rejects empty and whitespace-only input', () => {
    expect(normalizeTransactionSignature('')).toBeNull();
    expect(normalizeTransactionSignature('   ')).toBeNull();
    expect(normalizeTransactionSignature('\n\t')).toBeNull();
  });

  it('exposes the canonical signature byte length', () => {
    expect(SIGNATURE_BYTE_LENGTH).toBe(64);
  });
});
