/**
 * Regression tests: transaction retrieval against the REAL Devnet v0
 * response shape returned by getTransaction() (default json encoding,
 * deserialized by @solana/web3.js).
 *
 * Real transaction (Devnet):
 *   4n8Uibg92YushsYrVzczCXuursWwkG3rbwBMKiZ7U9T7UTDQVseASVmbiFoj51KdZTrSiJitRZu4C6aRkvjNMcCn
 *
 * That response contains a v0 message shaped as:
 *   message.staticAccountKeys     (PublicKey[])      - NOT message.accountKeys
 *   message.compiledInstructions  (programIdIndex /  - NOT message.instructions
 *                                   accountKeyIndexes / Buffer data)
 *   meta.loadedAddresses          (empty — no address lookup tables used)
 *
 * verifyPrivateDrop / verifyProofDrop previously read only
 * message.instructions and failed with the misleading
 * "No instructions found in transaction." even though the V3 PRIVATE
 * memo (fee transfer + SPL Memo) was present on-chain.
 *
 * These tests reproduce that EXACT shape and assert full retrieval,
 * memo extraction, and (for PRIVATE) real crypto decryption.
 */

import { PublicKey, SystemProgram } from '@solana/web3.js';
import {
  verifyBySignature,
  verifyPrivateDrop,
  verifyProofDrop,
  PrivateVerificationResult,
  ProofVerificationResult,
} from './verification';
import { processContent } from './content';
import { generateRecipientKeypair, encryptPrivateContent } from './crypto/privateDrop';
import { calculateKeyFingerprint } from './crypto/keyManager';
import { encodePrivatePayload, encodeProofPayload, MEMO_PROGRAM_ID } from './memo';
import { bytesToBase64 } from './encoding';

// The REAL Devnet signature that exposed the parser gap
const SIGNATURE =
  '4n8Uibg92YushsYrVzczCXuursWwkG3rbwBMKiZ7U9T7UTDQVseASVmbiFoj51KdZTrSiJitRZu4C6aRkvjNMcCn';
const PUBLISHER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const PLAINTEXT = 'Real Devnet v0 shape!';

const mockGetTransaction = jest.fn();
const fakeConnection = {
  getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
} as unknown as import('@solana/web3.js').Connection;

/**
 * Reproduces the EXACT structure of the real Devnet getTransaction() response:
 * a v0 transaction (System platform-fee transfer + SPL Memo instruction)
 * where the message exposes staticAccountKeys + compiledInstructions only.
 */
function devnetV0Transaction(memoData: string) {
  return {
    version: 0,
    slot: 494119827,
    blockTime: 1789000000,
    transactionIndex: 0,
    meta: {
      computeUnitsConsumed: 12345,
      costUnits: 12345,
      err: null,
      fee: 5000,
      innerInstructions: [],
      loadedAddresses: { readonly: [], writable: [] },
      logMessages: [
        'Program 11111111111111111111111111111111 invoke [1]',
        'Program log: Instruction: Transfer',
        'Program 11111111111111111111111111111111 success',
        `Program ${MEMO_PROGRAM_ID} invoke [1]`,
        `Program ${MEMO_PROGRAM_ID} success`,
      ],
      postBalances: [499999995000, 1, 1],
      preBalances: [500000000000, 1, 1],
      preTokenBalances: [],
      postTokenBalances: [],
      rewards: [],
      status: { Ok: null },
    },
    transaction: {
      message: {
        header: {
          numRequiredSignatures: 1,
          numReadonlySignedAccounts: 0,
          numReadonlyUnsignedAccounts: 2,
        },
        // [fee payer, System Program, SPL Memo program] — exactly the real tx
        staticAccountKeys: [
          new PublicKey(PUBLISHER),
          SystemProgram.programId,
          new PublicKey(MEMO_PROGRAM_ID),
        ],
        recentBlockhash: '11111111111111111111111111111111',
        compiledInstructions: [
          // 1) Platform fee: System transfer of 1,000,000 lamports
          {
            programIdIndex: 1,
            accountKeyIndexes: [0, 0],
            data: Buffer.from([2, 0, 0, 0, 64, 66, 15, 0, 0, 0, 0, 0]),
          },
          // 2) SPL Memo carrying the V3 payload (memo needs no accounts)
          {
            programIdIndex: 2,
            accountKeyIndexes: [],
            data: Buffer.from(memoData, 'utf8'),
          },
        ],
        addressTableLookups: [],
      },
    },
  };
}

/** Same publish sequence as the app: ONE keypair, ONE encryption. */
async function simulatePrivatePublish() {
  const meta = await processContent(PLAINTEXT, PUBLISHER);
  const keypair = await generateRecipientKeypair();
  const keyFingerprint = await calculateKeyFingerprint(keypair.publicKey);
  const encryptionResult = await encryptPrivateContent(
    new TextEncoder().encode(PLAINTEXT),
    meta.hash,
    meta.contentType,
    keypair.publicKey,
    keyFingerprint,
    meta.hashDropId
  );
  const onChainMemo = encodePrivatePayload(
    meta.hashDropId,
    encryptionResult.plaintextHash,
    encryptionResult.plaintextSize,
    encryptionResult.contentType,
    keyFingerprint,
    bytesToBase64(encryptionResult.encryptedKeyEnvelope.iv),
    bytesToBase64(encryptionResult.encryptedKeyEnvelope.encryptedKey)
  );
  return { meta, keypair, keyFingerprint, encryptionResult, onChainMemo };
}

describe('v0 Devnet transaction shape — PRIVATE/PROOF retrieval regression', () => {
  beforeEach(() => {
    mockGetTransaction.mockReset();
  });

  it('RETRIEVE: detects the V3 PRIVATE commitment from the real v0 shape', async () => {
    const pub = await simulatePrivatePublish();
    mockGetTransaction.mockResolvedValue(devnetV0Transaction(pub.onChainMemo));

    // verifyBySignature is what the Viewer RETRIEVE button calls
    const result = await verifyBySignature(fakeConnection, SIGNATURE);

    expect(result.verified).toBe(false);
    expect(result.needsContent).toBe(true);
    expect(result.mode).toBe('PRIVATE');
    expect(result.hashDropId).toBe(pub.meta.hashDropId);
    expect(result.contentHash).toBe(pub.meta.hash);
    expect(result.contentSize).toBe(pub.meta.size);
    expect(result.contentType).toBe(pub.meta.contentType);
    expect(result.cryptoVersion).toBe('HD-P1');
    expect(result.keyFingerprint).toBe(pub.keyFingerprint);
    expect(result.signer).toBe(PUBLISHER);
    expect(mockGetTransaction).toHaveBeenCalledTimes(1);
  });

  it('DECRYPT & VERIFY: extracts the memo from compiledInstructions and fully decrypts', async () => {
    const pub = await simulatePrivatePublish();
    mockGetTransaction.mockResolvedValue(devnetV0Transaction(pub.onChainMemo));

    // Exactly what the Viewer passes after importing .hdp + private key
    const result: PrivateVerificationResult = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      pub.keypair.secretKey,
      pub.encryptionResult.encryptedArtifact,
      pub.encryptionResult.encryptedArtifact.mlKemCiphertext
    );

    expect(result.verified).toBe(true);
    expect(result.error).toBeNull();
    expect(result.plaintext).toBe(PLAINTEXT);
    expect(result.contentHash).toBe(pub.meta.hash);
    expect(result.calculatedHash).toBe(pub.meta.hash);
    expect(result.signer).toBe(PUBLISHER);
    expect(result.transactionVersion).toBe('v0');
  });

  it('PROOF: extracts the memo from compiledInstructions and verifies the commitment', async () => {
    const meta = await processContent(PLAINTEXT, PUBLISHER);
    const proofMemo = encodeProofPayload(meta.hashDropId, meta.hash, meta.size);
    mockGetTransaction.mockResolvedValue(devnetV0Transaction(proofMemo));

    const result: ProofVerificationResult = await verifyProofDrop(
      fakeConnection,
      SIGNATURE,
      PLAINTEXT
    );

    expect(result.verified).toBe(true);
    expect(result.error).toBeNull();
    expect(result.hashDropId).toBe(meta.hashDropId);
    expect(result.contentHash).toBe(meta.hash);
    expect(result.contentSize).toBe(meta.size);
    expect(result.signer).toBe(PUBLISHER);
    expect(result.transactionVersion).toBe('v0');
  });

  it('reports accurate errors: empty instructions vs. missing memo', async () => {
    // 1) Genuinely zero instructions -> "No instructions found in transaction."
    const emptyTx = devnetV0Transaction('HASHDROP|v3|PRIVATE|unused|unused');
    emptyTx.transaction.message.compiledInstructions = [];
    mockGetTransaction.mockResolvedValue(emptyTx);
    const keypair = await generateRecipientKeypair();
    const emptyResult = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      keypair.secretKey,
      {
        hashDropId: 'x',
        contentHash: 'x',
        contentSize: 1,
        contentType: 'text/plain',
        keyFingerprint: 'aabbccddeeff0011',
        mlKemCiphertext: new Uint8Array(1088),
        iv: new Uint8Array(12),
        ciphertext: new Uint8Array(16),
      },
      new Uint8Array(1088)
    );
    expect(emptyResult.verified).toBe(false);
    expect(emptyResult.error).toBe('No instructions found in transaction.');

    // 2) Instructions exist but none is a HashDrop memo -> accurate error
    const noMemoTx = devnetV0Transaction('some unrelated memo text');
    noMemoTx.transaction.message.compiledInstructions[1].data = Buffer.from(
      'unrelated memo',
      'utf8'
    );
    mockGetTransaction.mockResolvedValue(noMemoTx);
    const noMemoResult = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      keypair.secretKey,
      {
        hashDropId: 'x',
        contentHash: 'x',
        contentSize: 1,
        contentType: 'text/plain',
        keyFingerprint: 'aabbccddeeff0011',
        mlKemCiphertext: new Uint8Array(1088),
        iv: new Uint8Array(12),
        ciphertext: new Uint8Array(16),
      },
      new Uint8Array(1088)
    );
    expect(noMemoResult.verified).toBe(false);
    // A non-HashDrop memo still yields memoData, so the flow reaches the
    // payload validator — the accurate error for this case is:
    expect(noMemoResult.error).toBe('Not a valid HashDrop Private Drop.');
  });

  it('still supports the legacy message shape (accountKeys + instructions)', async () => {
    const pub = await simulatePrivatePublish();
    const legacyTx = {
      version: undefined,
      slot: 1,
      blockTime: 1700000000,
      meta: { err: null },
      transaction: {
        message: {
          accountKeys: [PUBLISHER, MEMO_PROGRAM_ID],
          instructions: [
            { programId: MEMO_PROGRAM_ID, accounts: [], data: pub.onChainMemo },
          ],
        },
      },
    };
    mockGetTransaction.mockResolvedValue(legacyTx);

    const result: PrivateVerificationResult = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      pub.keypair.secretKey,
      pub.encryptionResult.encryptedArtifact,
      pub.encryptionResult.encryptedArtifact.mlKemCiphertext
    );

    expect(result.verified).toBe(true);
    expect(result.plaintext).toBe(PLAINTEXT);
  });
});

