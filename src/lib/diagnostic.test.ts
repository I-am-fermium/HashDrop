/**
 * HashDrop Legacy V2 Retrieval Diagnostic Test
 *
 * Inspects a historical on-chain V2 transaction fetched from Devnet.
 * Legacy V2 is NOT the current protocol — the active protocol is V3
 * (HASHDROP|v3|…) and V2 payloads are rejected by the decoders. This test
 * exists purely to diagnose the runtime shape of the old Solana
 * transaction object.
 *
 * DO NOT make any fixes - this is for diagnostics only.
 */

import { Connection } from '@solana/web3.js';
import * as bs58 from 'bs58';

// Known-good transaction from the task
const KNOWN_GOOD_TX = '5QSigbpsA4siqaTpGza3Q4kMFrwSzUKXn5TSkzJFyLxy8EdARYgwhFaMw69cGD3x1DruTZt2GweRB65c3GXCsyYg';
const MEMO_PROGRAM_ID = 'Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH';

describe('HashDrop Legacy V2 Retrieval Diagnostic', () => {
  it('should run full diagnostic on known-good transaction', async () => {
    console.log('='.repeat(80));
    console.log('HASHDROP LEGACY V2 RETRIEVAL DIAGNOSTIC');
    console.log('='.repeat(80));
    console.log('');

    // Create connection to Solana Devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // STEP 1: Fetch the known-good transaction
    console.log('[STEP 1] Fetching known-good transaction...');
    console.log(`[HD DEBUG] Transaction signature: ${KNOWN_GOOD_TX}`);

    const tx = await connection.getTransaction(KNOWN_GOOD_TX, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    // STEP 2: Print the actual runtime shape
    console.log('');
    console.log('[STEP 2] Printing actual runtime shape...');

    console.log('[HD DEBUG] tx exists:', !!tx);

    console.log(
      '[HD DEBUG] message:',
      tx?.transaction.message
    );

    // Cast to any to avoid TypeScript issues with VersionedMessage
    const txAny: any = tx;
    const instructions = txAny?.transaction?.message?.instructions;
    const accountKeys = txAny?.transaction?.message?.accountKeys;

    console.log(
      '[HD DEBUG] instructions:',
      instructions
    );

    console.log(
      '[HD DEBUG] instruction count:',
      instructions?.length
    );

    // Log EVERY instruction
    console.log('');
    console.log('[STEP 2b] Detailed instruction inspection...');

    instructions?.forEach((instruction: any, index: number) => {
      console.log(`[HD DEBUG] instruction ${index}`, {
        constructor: instruction?.constructor?.name,
        keys: Object.keys(instruction ?? {}),
        programId:
          instruction?.programId?.toBase58?.() ??
          instruction?.programId ??
          null,
        programIdIndex:
          instruction?.programIdIndex ??
          null,
        data:
          instruction?.data ??
          null,
        dataType:
          typeof instruction?.data,
        dataConstructor:
          instruction?.data?.constructor?.name ??
          null,
        parsed:
          instruction?.parsed ??
          null,
        program:
          instruction?.program ??
          null,
      });
    });

    // STEP 3: Determine which fields are available
    console.log('');
    console.log('[STEP 3] Field availability check...');

    if (instructions?.length > 0) {
      const firstInstruction = instructions[0];
      console.log('[HD DEBUG] First instruction keys:', Object.keys(firstInstruction));
      console.log('[HD DEBUG] Has programId:', 'programId' in firstInstruction);
      console.log('[HD DEBUG] Has programIdIndex:', 'programIdIndex' in firstInstruction);
      console.log('[HD DEBUG] Has data:', 'data' in firstInstruction);
      console.log('[HD DEBUG] Has parsed:', 'parsed' in firstInstruction);
      console.log('[HD DEBUG] Has program:', 'program' in firstInstruction);
      console.log('[HD DEBUG] Has accounts:', 'accounts' in firstInstruction);
    }

    // STEP 4: Determine the actual memo program ID
    console.log('');
    console.log('[STEP 4] Memo program ID resolution...');

    console.log('[HD DEBUG] Expected MEMO_PROGRAM_ID:', MEMO_PROGRAM_ID);
    console.log('[HD DEBUG] Account keys:', accountKeys?.map((k: any) => k?.toBase58?.() ?? k));

    // STEP 5: Add a temporary raw match test - WITH programIdIndex resolution
    console.log('');
    console.log('[STEP 5] Raw memo instruction match test (with programIdIndex resolution)...');

    const memoInstruction = instructions?.find((instruction: any) => {
      // First try: instruction.programId?.toBase58()
      let resolvedProgramId: string | null = null;
      
      if (instruction?.programId) {
        if (typeof instruction.programId === 'string') {
          resolvedProgramId = instruction.programId;
        } else if (instruction.programId.toBase58) {
          resolvedProgramId = instruction.programId.toBase58();
        }
      }
      
      // Second try: resolve via programIdIndex
      if (!resolvedProgramId && 'programIdIndex' in instruction && instruction.programIdIndex !== undefined && accountKeys) {
        const key = accountKeys[instruction.programIdIndex];
        if (key && key.toBase58) {
          resolvedProgramId = key.toBase58();
        } else if (key) {
          resolvedProgramId = String(key);
        }
      }
      
      console.log(`[HD DEBUG] Instruction ${instructions.indexOf(instruction)} resolvedProgramId:`, resolvedProgramId);
      
      return resolvedProgramId === MEMO_PROGRAM_ID;
    });

    console.log('[HD DEBUG] MEMO INSTRUCTION:', memoInstruction);

    if (!memoInstruction) {
      console.log('[HD DEBUG] ERROR: Memo instruction not found!');
      console.log('[HD DEBUG] Available instructions:', instructions?.length);
      return;
    }

    // STEP 6: Decode only after memo is found
    console.log('');
    console.log('[STEP 6] Memo data inspection...');

    console.log('[HD DEBUG] Memo data:', {
      value: memoInstruction.data,
      type: typeof memoInstruction.data,
      constructor: memoInstruction.data?.constructor?.name,
    });

    let memoText = '';

    if (typeof memoInstruction.data === 'string') {
      // If it's a string, try Base58 decode
      console.log('[HD DEBUG] Data is a string, attempting Base58 decode...');
      try {
        const memoBytes = bs58.decode(memoInstruction.data);
        memoText = new TextDecoder().decode(memoBytes);
        console.log('[HD DEBUG] Base58 decode successful');
        console.log('[HD DEBUG] Decoded bytes length:', memoBytes.length);
      } catch (e) {
        console.log('[HD DEBUG] Base58 decode failed:', e);
        // Use string directly
        memoText = memoInstruction.data;
      }
    } else if (memoInstruction.data instanceof Uint8Array) {
      // If it's already bytes
      console.log('[HD DEBUG] Data is Uint8Array, decoding directly...');
      memoText = new TextDecoder().decode(memoInstruction.data);
    } else if (Buffer.isBuffer(memoInstruction.data)) {
      console.log('[HD DEBUG] Data is Buffer, decoding directly...');
      memoText = new TextDecoder().decode(memoInstruction.data);
    } else if (memoInstruction.data && typeof memoInstruction.data === 'object') {
      // If it's an object, inspect it
      console.log('[HD DEBUG] Data is object, inspecting...');
      console.log('[HD DEBUG] Data object keys:', Object.keys(memoInstruction.data));
      console.log('[HD DEBUG] Data object:', memoInstruction.data);
    }

    console.log('');
    console.log('[HD DEBUG] Decoded Memo:');
    console.log(memoText);

    // STEP 7: Verify the decoded memo
    console.log('');
    console.log('[STEP 7] Verification of decoded memo...');

    const expectedMemo = 'HASHDROP|v2|MEMO|hd_e0ba1ac4_Amy4Tej8_g|e0ba1ac4b690b9dbd655be81caf5cebec06f2644681c4cf6ff774bec72c683e3|text/plain|16|SGVsbG8sIEhhc2hEcm9wIQ==';

    if (memoText === expectedMemo) {
      console.log('[HD DEBUG] ✓ Decoded memo matches expected value!');
    } else {
      console.log('[HD DEBUG] ✗ Decoded memo does NOT match expected value!');
      console.log('[HD DEBUG] Expected:', expectedMemo);
      console.log('[HD DEBUG] Got:', memoText);
    }

    // STEP 8: Parse legacy V2 and verify
    console.log('');
    console.log('[STEP 8] Legacy V2 parsing and verification...');

    const parts = memoText.split('|');
    console.log('[HD DEBUG] Memo parts:', parts);

    if (parts.length === 8) {
      const [protocol, version, type, hashDropId, contentHash, contentType, contentSizeStr, base64Content] = parts;

      console.log('[HD DEBUG] Protocol:', protocol);
      console.log('[HD DEBUG] Version:', version);
      console.log('[HD DEBUG] Type:', type);
      console.log('[HD DEBUG] HashDrop ID:', hashDropId);
      console.log('[HD DEBUG] Content Hash (SHA-256):', contentHash);
      console.log('[HD DEBUG] Content Type:', contentType);
      console.log('[HD DEBUG] Content Size:', contentSizeStr);
      console.log('[HD DEBUG] Base64 Content:', base64Content);

      // Decode Base64 content
      console.log('[HD DEBUG] Decoding Base64 content...');
      try {
        const contentBytes = decodeBase64(base64Content);
        const decodedContent = new TextDecoder().decode(contentBytes);
        console.log('[HD DEBUG] Decoded content:', decodedContent);
        console.log('[HD DEBUG] Content bytes length:', contentBytes.length);
        console.log('[HD DEBUG] Expected content length:', contentSizeStr);

        if (contentBytes.length === parseInt(contentSizeStr, 10)) {
          console.log('[HD DEBUG] ✓ Content length matches!');
        } else {
          console.log('[HD DEBUG] ✗ Content length mismatch!');
        }
      } catch (e) {
        console.log('[HD DEBUG] Base64 decode error:', e);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(80));

    // Basic assertion - transaction should exist
    expect(tx).not.toBeNull();
  }, 30000); // 30 second timeout for network request
});

/**
 * Decode Base64 content (browser-compatible)
 */
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}