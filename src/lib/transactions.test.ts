/**
 * Tests for HashDrop Transaction Builder — platform fee (SystemProgram.transfer)
 *
 * Verifies that the publish transaction encoded by buildV1Transaction:
 * 1. Contains a SystemProgram.transfer instruction (platform fee)
 * 2. Transfer destination is HASHDROP_FEE_WALLET
 * 3. Transfer amount is 1,000,000 lamports (0.001 SOL)
 * 4. Still contains the SPL Memo instruction
 * 5. Remains a v0 transaction (compileToV0Message)
 * 6. Contains NO ComputeBudget priority-fee instruction
 * 7. The platform fee is actually encoded in the instructions (not just displayed)
 */

import { PublicKey, SystemProgram, ComputeBudgetProgram, VersionedTransaction } from '@solana/web3.js';
import { buildV1Transaction } from './transactions';
import { HASHDROP_FEE_WALLET, HASHDROP_PLATFORM_FEE_LAMPORTS, HASHDROP_PLATFORM_FEE_SOL } from './constants';
import { MEMO_PROGRAM_ID } from './memo';

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
const MEMO_PAYLOAD = 'HASHDROP|v3|PUBLIC|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8sIFdvcmxk';

/** Build the transaction exactly as the publish path does (v0, no RPC). */
function buildTx(): VersionedTransaction {
  return buildV1Transaction(MEMO_PAYLOAD, FEE_PAYER.toBase58(), BLOCKHASH, BigInt(0));
}

/** Read a SystemProgram.transfer instruction's lamports from its data. */
function readTransferLamports(data: Uint8Array): bigint {
  const buf = Buffer.from(data);
  // SystemProgram.Transfer instruction data = u32 tag (2) + u64 lamports
  expect(buf.readUInt32LE(0)).toBe(2); // SystemInstruction.Transfer = 2
  return buf.readBigUInt64LE(4);
}

describe('HashDrop Transaction Builder platform fee', () => {
  it('should encode a SystemProgram.transfer to the HashDrop fee wallet for 0.001 SOL', () => {
    const tx = buildTx();
    const keys = tx.message.staticAccountKeys;
    const ix = tx.message.compiledInstructions;

    // Find the transfer instruction by program id
    const transferIx = ix.find(
      (ci) => keys[ci.programIdIndex].toBase58() === SystemProgram.programId.toBase58()
    );

    expect(transferIx).toBeDefined();
    if (!transferIx) return;

    // fromPubkey = payer (index 0), toPubkey = fee wallet
    expect(transferIx.accountKeyIndexes.length).toBe(2);
    expect(keys[transferIx.accountKeyIndexes[0]].toBase58()).toBe(FEE_PAYER.toBase58());
    expect(keys[transferIx.accountKeyIndexes[1]].toBase58()).toBe(HASHDROP_FEE_WALLET);

    // Amount = 1,000,000 lamports (0.001 SOL)
    expect(readTransferLamports(transferIx.data)).toBe(BigInt(HASHDROP_PLATFORM_FEE_LAMPORTS));
    expect(Number(readTransferLamports(transferIx.data))).toBe(1_000_000);
    expect(HASHDROP_PLATFORM_FEE_SOL).toBe(0.001);
  });

  it('should still contain the SPL Memo instruction with the original payload', () => {
    const tx = buildTx();
    const keys = tx.message.staticAccountKeys;
    const ix = tx.message.compiledInstructions;

    const memoIx = ix.find(
      (ci) => keys[ci.programIdIndex].toBase58() === MEMO_PROGRAM_ID
    );

    expect(memoIx).toBeDefined();
    if (!memoIx) return;

    expect(memoIx.accountKeyIndexes.length).toBe(0);
    expect(Buffer.from(memoIx.data).toString('utf8')).toBe(MEMO_PAYLOAD);
  });

  it('should have exactly two instructions: transfer first, memo second', () => {
    const tx = buildTx();
    const keys = tx.message.staticAccountKeys;
    const ix = tx.message.compiledInstructions;

    expect(ix.length).toBe(2);
    expect(keys[ix[0].programIdIndex].toBase58()).toBe(SystemProgram.programId.toBase58());
    expect(keys[ix[1].programIdIndex].toBase58()).toBe(MEMO_PROGRAM_ID);
  });

  it('should remain a v0 transaction with a single signer (the user wallet)', () => {
    const tx = buildTx();

    expect(tx.message.version).toBe(0);
    expect(tx.signatures.length).toBe(1);
    // The only signer must be the fee payer (user wallet) — no second signer for the fee wallet
    const keys = tx.message.staticAccountKeys;
    const feePayerIndex = tx.message.header.numRequiredSignatures;
    expect(keys.slice(0, feePayerIndex).map((k) => k.toBase58())).toEqual([FEE_PAYER.toBase58()]);
  });

  it('should NOT contain any ComputeBudget priority-fee instruction', () => {
    const tx = buildTx();
    const keys = tx.message.staticAccountKeys;
    const ix = tx.message.compiledInstructions;

    const computeBudgetProgramId = ComputeBudgetProgram.programId.toBase58();
    const hasComputeBudget = ix.some(
      (ci) => keys[ci.programIdIndex].toBase58() === computeBudgetProgramId
    );

    expect(hasComputeBudget).toBe(false);
    // Nor in the full account-key list (no setComputeUnitPrice/setComputeUnitLimit programs)
    expect(keys.some((k) => k.toBase58() === computeBudgetProgramId)).toBe(false);
  });

  it('should encode the platform fee amount exactly as the shared constant (1,000,000 lamports)', () => {
    expect(HASHDROP_PLATFORM_FEE_LAMPORTS).toBe(1_000_000);
    expect(HASHDROP_FEE_WALLET).toBe('Amy4Tej83vsnCdFbBtfWmQrEdRLVF4AVAvZupyka8qQT');

    const tx = buildTx();
    const keys = tx.message.staticAccountKeys;
    const transferIx = tx.message.compiledInstructions.find(
      (ci) => keys[ci.programIdIndex].toBase58() === SystemProgram.programId.toBase58()
    );

    // The fee is encoded in the transaction instructions — NOT merely displayed
    expect(transferIx).toBeDefined();
    if (transferIx) {
      expect(Number(readTransferLamports(transferIx.data))).toBe(HASHDROP_PLATFORM_FEE_LAMPORTS);
    }
  });
});

// ============================================================
// Proof Mode (V3) Transaction Construction Tests
// ============================================================

import { encodeProofPayload } from './memo';

const PROOF_PAYLOAD = 'HASHDROP|v3|PROOF|hd_abc12345|' + 'a'.repeat(64) + '|100';

/** Build a Proof Mode transaction exactly as the proof publish path does. */
function buildProofTx(): VersionedTransaction {
  return buildV1Transaction(PROOF_PAYLOAD, FEE_PAYER.toBase58(), BLOCKHASH, BigInt(0));
}

describe('HashDrop Proof Mode Transaction Construction', () => {
  it('should contain the SPL Memo instruction with the V3 PROOF payload', () => {
    const tx = buildProofTx();
    const keys = tx.message.staticAccountKeys;
    const ix = tx.message.compiledInstructions;

    const memoIx = ix.find(
      (ci) => keys[ci.programIdIndex].toBase58() === MEMO_PROGRAM_ID
    );

    expect(memoIx).toBeDefined();
    if (!memoIx) return;

    expect(memoIx.accountKeyIndexes.length).toBe(0);
    expect(Buffer.from(memoIx.data).toString('utf8')).toBe(PROOF_PAYLOAD);
  });

  it('should contain the platform fee transfer instruction (atomic with proof memo)', () => {
    const tx = buildProofTx();
    const keys = tx.message.staticAccountKeys;
    const ix = tx.message.compiledInstructions;

    const transferIx = ix.find(
      (ci) => keys[ci.programIdIndex].toBase58() === SystemProgram.programId.toBase58()
    );

    expect(transferIx).toBeDefined();
    if (!transferIx) return;

    // Fee amount = 1,000,000 lamports
    expect(Number(readTransferLamports(transferIx.data))).toBe(HASHDROP_PLATFORM_FEE_LAMPORTS);
    // Destination = fee wallet
    expect(keys[transferIx.accountKeyIndexes[1]].toBase58()).toBe(HASHDROP_FEE_WALLET);
  });

  it('should have exactly two instructions: transfer first, memo second', () => {
    const tx = buildProofTx();
    const keys = tx.message.staticAccountKeys;
    const ix = tx.message.compiledInstructions;

    expect(ix.length).toBe(2);
    expect(keys[ix[0].programIdIndex].toBase58()).toBe(SystemProgram.programId.toBase58());
    expect(keys[ix[1].programIdIndex].toBase58()).toBe(MEMO_PROGRAM_ID);
  });

  it('should remain a v0 transaction with a single signer (the user wallet)', () => {
    const tx = buildProofTx();

    expect(tx.message.version).toBe(0);
    expect(tx.signatures.length).toBe(1);
    const keys = tx.message.staticAccountKeys;
    const feePayerIndex = tx.message.header.numRequiredSignatures;
    expect(keys.slice(0, feePayerIndex).map((k) => k.toBase58())).toEqual([FEE_PAYER.toBase58()]);
  });

  it('should NOT contain any ComputeBudget priority-fee instruction', () => {
    const tx = buildProofTx();
    const keys = tx.message.staticAccountKeys;
    const ix = tx.message.compiledInstructions;

    const computeBudgetProgramId = ComputeBudgetProgram.programId.toBase58();
    const hasComputeBudget = ix.some(
      (ci) => keys[ci.programIdIndex].toBase58() === computeBudgetProgramId
    );

    expect(hasComputeBudget).toBe(false);
    expect(keys.some((k) => k.toBase58() === computeBudgetProgramId)).toBe(false);
  });

  it('should NOT store the original content in the memo', () => {
    const tx = buildProofTx();
    const keys = tx.message.staticAccountKeys;
    const ix = tx.message.compiledInstructions;

    const memoIx = ix.find(
      (ci) => keys[ci.programIdIndex].toBase58() === MEMO_PROGRAM_ID
    );

    expect(memoIx).toBeDefined();
    if (!memoIx) return;

    const memoText = Buffer.from(memoIx.data).toString('utf8');

    // The memo should be the compact proof payload, NOT contain any original content
    expect(memoText).toBe(PROOF_PAYLOAD);
    expect(memoText).toContain('HASHDROP|v3|PROOF|');
    // Should NOT contain base64-encoded content (which V2 would have)
    expect(memoText.split('|').length).toBe(6);
  });

  it('should produce a compact memo (no base64 content blob)', () => {
    const proofTx = buildProofTx();

    const proofKeys = proofTx.message.staticAccountKeys;
    const proofIx = proofTx.message.compiledInstructions;
    const proofMemoIx = proofIx.find(
      (ci) => proofKeys[ci.programIdIndex].toBase58() === MEMO_PROGRAM_ID
    );

    if (!proofMemoIx) return;

    const memoText = Buffer.from(proofMemoIx.data).toString('utf8');

    // Proof memo has exactly 6 fields (no base64 content blob, no mimeType)
    const parts = memoText.split('|');
    expect(parts.length).toBe(6);

    // The memo should NOT contain any base64-encoded content
    // V2 memo would have 8 fields with the last being base64 content
    // V3 proof memo has only 6 fields: protocol, version, mode, id, hash, size
    expect(parts[0]).toBe('HASHDROP');
    expect(parts[1]).toBe('v3');
    expect(parts[2]).toBe('PROOF');
    expect(parts[5]).toBe('100'); // contentSize
  });
});