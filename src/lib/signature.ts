/**
 * HashDrop Transaction Signature Utilities
 *
 * Canonical, network-independent validation of user-entered Solana
 * transaction signatures.
 *
 * A Solana transaction signature is the Base58 encoding of a 64-byte
 * ed25519 signature. Base58 encoding of 64 bytes yields 87 OR 88 characters
 * (the leading digit is dropped when the numeric value is small enough), so
 * a hard-coded textual length such as `length < 88` wrongly rejects
 * perfectly valid signatures (e.g. real Mainnet transactions).
 *
 * Canonical validation:
 *   1. trim user input (handles pasted whitespace/newlines)
 *   2. Base58 decode (throws on invalid Base58 characters: 0, O, I, l, ...)
 *   3. require exactly 64 decoded bytes
 *   4. return the normalized (trimmed) signature for RPC retrieval
 *
 * This validation is network-independent: a signature's validity has nothing
 * to do with Devnet vs. Mainnet.
 */

import * as bs58 from 'bs58';

// bs58 v6+ exposes decode on the default export (same compat shim as
// src/lib/verification.ts)
const bs58Decode = ((bs58 as any).default?.decode || (bs58 as any).decode) as (
  value: string
) => Uint8Array;

/** Exact byte length of a Solana (ed25519) transaction signature. */
export const SIGNATURE_BYTE_LENGTH = 64;

/**
 * Validate and normalize a user-entered Solana transaction signature.
 *
 * @param input - Raw user input (may contain surrounding whitespace/newlines)
 * @returns The trimmed signature if it is valid Base58 decoding to exactly
 *          64 bytes; otherwise null.
 */
export function normalizeTransactionSignature(input: string): string | null {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  try {
    const decoded = bs58Decode(trimmed);
    if (decoded.length !== SIGNATURE_BYTE_LENGTH) {
      return null;
    }
    return trimmed;
  } catch {
    // Invalid Base58 characters (0, O, I, l, symbols, inner whitespace, ...)
    return null;
  }
}
