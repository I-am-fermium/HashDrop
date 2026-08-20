/**
 * HashDrop Verification Module
 * 
 * Provides client-side reconstruction and verification of on-chain content
 * Supports Memo Drop verification via transaction signature
 * Supports legacy, v0, and v1 transactions
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { calculateHash, stringToBytes } from './content';
import { decodeMemoPayload, isValidMemoPayload, MEMO_PROGRAM_ID, MEMO_VERSION } from './memo';
import { base64ToUtf8, utf8ToBytes } from './encoding';

// Handle bs58 v6+ API change - decode is now on default export
const bs58Decode = (bs58 as any).default?.decode || (bs58 as any).decode;

/**
 * Memo Drop verification result
 */
export interface MemoVerificationResult {
  verified: boolean;
  content: string;
  hash: string;
  hashDropId: string;
  contentHash: string;
  contentType: string;
  contentSize: number;
  signature: string;
  error: string | null;
  version?: string;
  type?: string;
  transactionVersion?: 'legacy' | 'v0' | 'v1';
}

/**
 * Decode Base64 content to Uint8Array (browser-compatible)
 * Uses the centralized encoding utility for consistency
 */
function decodeBase64(base64: string): Uint8Array {
  // Decode Base64 to string, then encode to bytes
  const decoded = base64ToUtf8(base64);
  return utf8ToBytes(decoded);
}

/**
 * Decode instruction data to string
 * Handles Base58 strings, Uint8Array, and Buffer
 */
function decodeInstructionData(data: any): string {
  console.log('[HashDrop Retrieve] Decoding data, type:', typeof data, data?.constructor?.name);
  
  if (!data) {
    return '';
  }
  
// If already a string, it's likely Base58 encoded - decode it
  if (typeof data === 'string') {
    try {
      // Try Base58 decode first
      const bytes = bs58Decode(data);
      return new TextDecoder().decode(bytes);
    } catch (e) {
      // If Base58 fails, try using the string directly
      console.log('[HashDrop Retrieve] Base58 decode failed, using string directly');
      return data;
    }
  }
  
  // If it's a Uint8Array or Buffer, decode directly
  try {
    if (data instanceof Uint8Array || Buffer.isBuffer(data)) {
      return new TextDecoder().decode(data);
    }
  } catch (e) {
    console.log('[HashDrop Retrieve] Direct decode failed:', e);
  }
  
  return '';
}

/**
 * Try to get public key from various formats
 */
function getPublicKey(value: any): PublicKey | null {
  if (value === null || value === undefined) return null;
  
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

/**
 * Resolve the program ID from an instruction
 * Handles both PartiallyDecodedInstruction (with programId) and 
 * compiled instructions (with programIdIndex)
 */
function resolveProgramId(instruction: any, accountKeys: any[]): string | null {
  // Method 1: instruction.programId exists and is a valid PublicKey
  if (instruction?.programId) {
    if (typeof instruction.programId === 'string') {
      return instruction.programId;
    }
    if (instruction.programId.toBase58) {
      return instruction.programId.toBase58();
    }
    // Handle PublicKey objects that might not have toBase58 in RPC response
    if (instruction.programId._bn) {
      try {
        return new PublicKey(instruction.programId._bn).toBase58();
      } catch {
        // Ignore and try other methods
      }
    }
  }
  
  // Method 2: Resolve via programIdIndex
  if ('programIdIndex' in instruction && instruction.programIdIndex !== undefined && accountKeys) {
    const key = accountKeys[instruction.programIdIndex];
    if (key) {
      if (typeof key === 'string') {
        return key;
      }
      if (key.toBase58) {
        return key.toBase58();
      }
      // Handle PublicKey objects that might not have toBase58 in RPC response
      if (key._bn) {
        try {
          return new PublicKey(key._bn).toBase58();
        } catch {
          // Ignore and try other methods
        }
      }
    }
  }
  
  return null;
}

/**
 * Get the transaction version from an RPC transaction result
 * Handles legacy, v0, and v1 transactions
 * 
 * The RPC response from getTransaction() returns a transaction object with a
 * 'version' field that can be:
 * - undefined (legacy transaction)
 * - 0 (v0 transaction)
 * - 1 (v1 transaction)
 */
function getTransactionVersionFromRpc(tx: any): 'legacy' | 'v0' | 'v1' {
  if (!tx) return 'legacy';
  
  // Check the version field directly on the transaction object
  const version = tx.version;
  
  if (version === 0 || version === '0') {
    return 'v0';
  }
  if (version === 1 || version === '1') {
    return 'v1';
  }
  
  // If version is undefined or any other value, it's legacy
  return 'legacy';
}

/**
 * Verify Memo Drop from transaction
 * Supports legacy, v0, and v1 transactions
 */
export async function verifyMemoDrop(
  connection: Connection,
  signature: string,
  expectedHashDropId?: string
): Promise<MemoVerificationResult> {
  try {
    console.log('[HashDrop Retrieve] Signature:', signature);

    // Fetch transaction - use maxSupportedTransactionVersion: 1 to support v1
    // This allows retrieval of both v0 and v1 transactions from the network
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 1,
    });
    
    if (!tx) {
      return {
        verified: false,
        content: '',
        hash: '',
        hashDropId: '',
        contentHash: '',
        contentType: '',
        contentSize: 0,
        signature,
        error: 'Transaction not found on Solana Devnet.',
      };
    }
    
    // Determine transaction version from RPC response
    // Do NOT use instanceof - the RPC response is a plain object, not a VersionedTransaction instance
    const transactionVersion = getTransactionVersionFromRpc(tx);
    console.log('[HashDrop Retrieve] Transaction version:', transactionVersion);
    
    // Find memo instruction
    const memoProgramId = new PublicKey(MEMO_PROGRAM_ID);
    let foundMemo = false;
    let memoData = '';
    let resolvedProgramId: string | undefined;
    
    // Access transaction message
    const txAny: any = tx;
    const transaction = txAny.transaction;
    
    if (transaction && transaction.message) {
      const message = transaction.message;
      // v0 transactions use staticAccountKeys, legacy uses accountKeys
      const accountKeys = message.accountKeys || message.staticAccountKeys;
      
      console.log('[HashDrop Retrieve] Message:', message);
      
      // Handle both legacy/v0 instructions and v0 compiledInstructions
      // v0 transactions have compiledInstructions, legacy has instructions
      let instructions: any[] = [];
      
      if (message.instructions) {
        // Legacy or partially decoded instructions
        instructions = message.instructions;
        console.log('[HashDrop Retrieve] Instruction count (instructions):', instructions?.length);
      } else if (message.compiledInstructions) {
        // v0 compiled instructions - need to resolve programIdIndex
        instructions = message.compiledInstructions;
        console.log('[HashDrop Retrieve] Instruction count (compiledInstructions):', instructions?.length);
      }
      
      // Iterate through all instructions to find the Memo program
      for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        
        console.log('[HashDrop Retrieve] Instruction:', {
          index: i,
          programId: instruction?.programId,
          programIdIndex: instruction?.programIdIndex,
          dataType: typeof instruction.data,
          dataPreview: instruction.data,
        });
        
        // Resolve the program ID using the helper function
        const resolvedId = resolveProgramId(instruction, accountKeys);
        
        if (resolvedId === MEMO_PROGRAM_ID) {
          foundMemo = true;
          resolvedProgramId = resolvedId;
          console.log('[HashDrop Retrieve] Found Memo via program ID:', resolvedProgramId);
          
          memoData = decodeInstructionData(instruction.data);
          break;
        }
      }
    }
    
    console.log(
      '[HashDrop Retrieve] Memo instruction found',
      {
        resolvedProgramId,
        dataLength: memoData?.length,
        dataPreview: memoData?.substring(0, 100),
      }
    );
    
    if (!foundMemo) {
      return {
        verified: false,
        content: '',
        hash: '',
        hashDropId: '',
        contentHash: '',
        contentType: '',
        contentSize: 0,
        signature,
        error: 'No HashDrop Memo found in this transaction.',
      };
    }
    
    console.log('[HashDrop Retrieve] Decoded Memo:', memoData);
    
    // Validate memo payload format
    if (!isValidMemoPayload(memoData)) {
      return {
        verified: false,
        content: '',
        hash: '',
        hashDropId: '',
        contentHash: '',
        contentType: '',
        contentSize: 0,
        signature,
        error: 'Invalid HashDrop V2 Memo.',
      };
    }
    
    // Decode memo payload
    const payload = decodeMemoPayload(memoData);
    if (!payload) {
      return {
        verified: false,
        content: '',
        hash: '',
        hashDropId: '',
        contentHash: '',
        contentType: '',
        contentSize: 0,
        signature,
        error: 'Invalid HashDrop V2 Memo.',
      };
    }
    
    console.log('[HashDrop Retrieve] Parsed V2:', payload);
    
    // Validate HashDrop ID if provided
    if (expectedHashDropId && payload.hashDropId !== expectedHashDropId) {
      return {
        verified: false,
        content: '',
        hash: '',
        hashDropId: payload.hashDropId,
        contentHash: '',
        contentType: '',
        contentSize: 0,
        signature,
        error: 'HashDrop ID does not match the transaction.',
      };
    }
    
    // Decode Base64 content
    let content = '';
    let contentBytes: Uint8Array = new Uint8Array();
    
    if (payload.content) {
      try {
        contentBytes = decodeBase64(payload.content);
        content = new TextDecoder().decode(contentBytes);
      } catch (e) {
        return {
          verified: false,
          content: '',
          hash: '',
          hashDropId: payload.hashDropId,
          contentHash: '',
          contentType: '',
          contentSize: 0,
          signature,
          error: 'Invalid content encoding.',
        };
      }
    }
    
    // Verify content length
    if (contentBytes.length !== payload.contentSize) {
      return {
        verified: false,
        content: '',
        hash: '',
        hashDropId: payload.hashDropId,
        contentHash: '',
        contentType: '',
        contentSize: payload.contentSize,
        signature,
        error: 'Content length does not match the on-chain record.',
      };
    }
    
    // Calculate SHA-256 hash of the content
    const calculatedHash = await calculateHash(contentBytes);
    
    console.log('[HashDrop Retrieve] Verification:', {
      calculatedHash,
      onChainHash: payload.contentHash,
      match: calculatedHash === payload.contentHash,
      transactionVersion,
    });
    
    // Compare hashes
    const verified = calculatedHash === payload.contentHash;
    
    if (!verified) {
      return {
        verified: false,
        content: '',
        hash: calculatedHash,
        hashDropId: payload.hashDropId,
        contentHash: payload.contentHash,
        contentType: payload.contentType,
        contentSize: payload.contentSize,
        signature,
        error: 'CONTENT VERIFICATION FAILED\n\nThe recovered content does not match the SHA-256 recorded on Solana.',
      };
    }
    
    return {
      verified: true,
      content,
      hash: calculatedHash,
      hashDropId: payload.hashDropId,
      contentHash: payload.contentHash,
      contentType: payload.contentType,
      contentSize: payload.contentSize,
      signature,
      error: null,
      version: payload.version,
      type: payload.type,
      transactionVersion,
    };
  } catch (error) {
    console.error('[HashDrop Retrieve] Error:', error);
    return {
      verified: false,
      content: '',
      hash: '',
      hashDropId: '',
      contentHash: '',
      contentType: '',
      contentSize: 0,
      signature,
      error: error instanceof Error ? error.message : 'Unknown error during retrieval',
    };
  }
}

/**
 * Verify HashDrop by signature (Memo Drop)
 */
export async function verifyBySignature(
  connection: Connection,
  signature: string,
  expectedHashDropId?: string
): Promise<MemoVerificationResult> {
  return verifyMemoDrop(connection, signature, expectedHashDropId);
}