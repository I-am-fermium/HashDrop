/**
 * HashDrop Verification Module
 *
 * Provides client-side reconstruction and verification of on-chain content
 * Supports V3 PUBLIC and PROOF modes via transaction signature
 * Supports legacy, v0, and v1 transactions
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { calculateHash, stringToBytes } from './content';
import { decodePublicPayload, decodeProofPayload, decodePrivatePayload, isValidPublicPayload, isValidProofPayload, isValidPrivatePayload, MEMO_PROGRAM_ID, HASHDROP_VERSION, ProofPayload, PublicPayload, PrivatePayload } from './memo';
import { base64ToUtf8, utf8ToBytes, base64ToBytes } from './encoding';
import { getNetworkDisplay, getCurrentNetwork } from './network';

// Handle bs58 v6+ API change - decode is now on default export
const bs58Decode = (bs58 as any).default?.decode || (bs58 as any).decode;

/**
 * Public Drop verification result
 */
export interface PublicVerificationResult {
  verified: boolean;
  content: string;
  hash: string;
  hashDropId: string;
  contentHash: string;
  contentType: string;
  contentSize: number;
  signature: string;
  signer?: string; // Fee payer / publisher wallet address (base58)
  error: string | null;
  version?: string;
  mode?: string;
  cryptoVersion?: string; // PRIVATE mode: crypto construction version (e.g., "HD-P1")
  keyFingerprint?: string; // PRIVATE mode: ML-KEM public key fingerprint
  transactionVersion?: 'legacy' | 'v0' | 'v1';
  needsContent?: boolean;
}

/**
 * Proof Drop verification result
 *
 * For Proof Drops the original content is not stored on-chain, so
 * verification requires the user to supply the original content. The
 * verifier independently recomputes the SHA-256 hash and byte length
 * and compares them against the on-chain commitment.
 */
export interface ProofVerificationResult {
  verified: boolean;
  hashDropId: string;
  contentHash: string;
  contentSize: number;
  calculatedHash: string;
  calculatedSize: number;
  signature: string;
  signer?: string; // Fee payer / publisher wallet address (base58)
  error: string | null;
  version: string;
  mode: string;
  transactionVersion?: 'legacy' | 'v0' | 'v1';
}

/**
 * Private Drop verification result
 *
 * For Private Drops the content is encrypted on-chain. Verification requires:
 * 1. Decapsulating the AES key using ML-KEM-768 secret key
 * 2. Decrypting the content using AES-256-GCM
 * 3. Verifying plaintext byte length
 * 4. Verifying plaintext SHA-256
 */
export interface PrivateVerificationResult {
  verified: boolean;
  hashDropId: string;
  contentHash: string;
  contentSize: number;
  calculatedHash: string;
  calculatedSize: number;
  contentType: string;
  plaintext: string | null; // Decrypted plaintext (only if verified)
  signature: string;
  signer?: string; // Fee payer / publisher wallet address (base58)
  error: string | null;
  version: string;
  mode: string;
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
 * Extract a base58 address from a transaction message account key entry.
 * Handles the different shapes returned by the RPC depending on encoding:
 * - PublicKey instance (has toBase58())
 * - plain string
 * - parsed key object ({ pubkey: string, signer, writable, source })
 */
function extractAccountAddress(key: unknown): string | undefined {
  if (!key) return undefined;
  if (typeof key === 'string') return key;
  const k = key as Record<string, unknown>;
  if (typeof k.toBase58 === 'function') {
    return (key as { toBase58: () => string }).toBase58();
  }
  if (typeof k.pubkey === 'string') {
    return k.pubkey;
  }
  return undefined;
}

/**
 * Verify Public Drop from transaction (V3 only)
 * Supports legacy, v0, and v1 transactions
 */
export async function verifyPublicDrop(
  connection: Connection,
  signature: string,
  expectedHashDropId?: string
): Promise<PublicVerificationResult> {
  try {
    console.log('[HashDrop Retrieve] Signature:', signature);

    // Fetch transaction - use maxSupportedTransactionVersion: 1 to support v1
    // This allows retrieval of both v0 and v1 transactions from the network
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 1,
    });
    
    if (!tx) {
      const networkDisplay = getNetworkDisplay();
      return {
        verified: false,
        content: '',
        hash: '',
        hashDropId: '',
        contentHash: '',
        contentType: '',
        contentSize: 0,
        signature,
        error: `Transaction not found on Solana ${networkDisplay}.`,
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
    let signer: string | undefined;
    
    // Access transaction message
    const txAny: any = tx;
    const transaction = txAny.transaction;
    
    if (transaction && transaction.message) {
      const message = transaction.message;
      // v0 transactions use staticAccountKeys, legacy uses accountKeys
      const accountKeys = message.accountKeys || message.staticAccountKeys;
      
      // The fee payer (publisher) is always the first account key
      signer = extractAccountAddress(accountKeys?.[0]);
      
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
        signer,
        error: 'No HashDrop Memo found in this transaction.',
      };
    }
    
    console.log('[HashDrop Retrieve] Decoded Memo:', memoData);

    // Detect Proof Mode (V3) payload first
    if (isValidProofPayload(memoData)) {
      const proofPayload = decodeProofPayload(memoData);

      if (!proofPayload) {
        return {
          verified: false,
          content: '',
          hash: '',
          hashDropId: '',
          contentHash: '',
          contentType: '',
          contentSize: 0,
          signature,
          signer,
          error: 'Invalid HashDrop V3 Proof payload.',
        };
      }

      console.log('[HashDrop Retrieve] Parsed V3 PROOF:', proofPayload);

      // Proof Drops do not store the original content on-chain.
      // Signal to the caller that the user must supply the original content.
      return {
        verified: false,
        content: '',
        hash: '',
        hashDropId: proofPayload.hashDropId,
        contentHash: proofPayload.contentHash,
        contentType: '',
        contentSize: proofPayload.contentSize,
        signature,
        signer,
        error: 'This is a Proof Drop. The original content is not stored on-chain. Supply the original content to verify.',
        version: proofPayload.version,
        mode: proofPayload.mode,
        needsContent: true,
        transactionVersion,
      };
    }

    // Detect Private Mode (V3) payload
    if (isValidPrivatePayload(memoData)) {
      const privatePayload = decodePrivatePayload(memoData);
      if (privatePayload) {
        console.log('[HashDrop Retrieve] Detected V3 PRIVATE payload');
        return {
          verified: false,
          content: '',
          hash: '',
          hashDropId: privatePayload.hashDropId,
          contentHash: privatePayload.contentHash,
          contentType: privatePayload.contentType,
          contentSize: privatePayload.contentSize,
          signature,
          signer,
          error: 'This is a Private Drop. The content is encrypted. Supply the ML-KEM secret key to decrypt.',
          version: privatePayload.version,
          mode: privatePayload.mode,
          cryptoVersion: privatePayload.cryptoVersion,
          keyFingerprint: privatePayload.keyFingerprint,
          needsContent: true,
          transactionVersion,
        };
      }
    }

    // Validate Public payload format (V3)
    if (!isValidPublicPayload(memoData)) {
      return {
        verified: false,
        content: '',
        hash: '',
        hashDropId: '',
        contentHash: '',
        contentType: '',
        contentSize: 0,
        signature,
        signer,
        error: 'Invalid HashDrop payload. This transaction does not contain a valid V3 PUBLIC, PROOF, or PRIVATE payload.',
        version: HASHDROP_VERSION,
      };
    }

    // Decode Public payload (V3)
    const payload = decodePublicPayload(memoData);
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
        signer,
        error: 'Invalid HashDrop V3 PUBLIC payload.',
        version: HASHDROP_VERSION,
        mode: 'PUBLIC',
      };
    }

    console.log('[HashDrop Retrieve] Parsed V3 PUBLIC:', payload);
    
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
        signer,
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
          signer,
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
        signer,
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
        signer,
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
      signer,
      error: null,
      version: payload.version,
      mode: payload.mode,
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
 * Verify HashDrop by signature (Public Drop)
 */
export async function verifyBySignature(
  connection: Connection,
  signature: string,
  expectedHashDropId?: string
): Promise<PublicVerificationResult> {
  return verifyPublicDrop(connection, signature, expectedHashDropId);
}

/**
 * Verify a Proof Drop by transaction signature and original content.
 *
 * Proof Drops do NOT store the original content on-chain. The user must supply
 * the original content. This function independently recomputes the SHA-256 hash
 * and UTF-8 byte length of the supplied content and compares them against the
 * on-chain commitment recorded in the Solana transaction memo.
 *
 * @param connection - Solana connection
 * @param signature - The Solana transaction signature
 * @param originalContent - The original content to verify against the on-chain commitment
 * @param expectedHashDropId - Optional HashDrop ID to validate against
 * @returns ProofVerificationResult with verified/not-verified status
 */
export async function verifyProofDrop(
  connection: Connection,
  signature: string,
  originalContent: string,
  expectedHashDropId?: string
): Promise<ProofVerificationResult> {
  try {
    // Stage 1: Fetch the transaction
    console.log('[HashDrop Proof] Fetching transaction:', signature);

    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        signature,
        error: 'Transaction not found.',
        version: HASHDROP_VERSION,
        mode: 'PROOF',
      };
    }

    // Determine transaction version
    const transactionVersion = getTransactionVersionFromRpc(tx);

    // Stage 2: Locate the HashDrop Memo instruction
    //
    // The RPC response shape differs by transaction version:
    // - legacy (json):   message.accountKeys + message.instructions
    // - v0/v1 (json):    message.staticAccountKeys + message.compiledInstructions
    // - jsonParsed:      message.accountKeys (parsed keys) + message.instructions
    // A REAL Devnet v0 response carries staticAccountKeys + compiledInstructions
    // and NO message.instructions field, so read from whichever are present.
    const txAny: any = tx;
    const message = txAny?.transaction?.message;
    const accountKeys = message?.accountKeys || message?.staticAccountKeys;
    const instructions: any[] = message?.instructions || message?.compiledInstructions || [];

    if (!instructions || instructions.length === 0) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        signature,
        error: 'No instructions found in transaction.',
        version: HASHDROP_VERSION,
        mode: 'PROOF',
      };
    }

    // Resolve account keys from various formats:
    // - strings (legacy json)
    // - PublicKey instances (v0 staticAccountKeys deserialized by web3.js)
    // - parsed keys ({ pubkey, signer, writable, source }) from jsonParsed
    let resolvedAccountKeys: string[] = [];
    if (accountKeys) {
      resolvedAccountKeys = accountKeys.map((key: any) => {
        if (typeof key === 'string') return key;
        if (key.toBase58) return key.toBase58();
        if (key._bn) return new PublicKey(key).toBase58();
        if (key.pubkey) return String(key.pubkey);
        return String(key);
      });
    }

    // Find the memo instruction
    let memoData: string | null = null;

    for (const instruction of instructions) {
      let resolvedProgramId: string | null = null;

      if (instruction.programId) {
        if (typeof instruction.programId === 'string') {
          resolvedProgramId = instruction.programId;
        } else if (instruction.programId.toBase58) {
          resolvedProgramId = instruction.programId.toBase58();
        }
      } else if (instruction.programIdIndex !== undefined && resolvedAccountKeys[instruction.programIdIndex]) {
        resolvedProgramId = resolvedAccountKeys[instruction.programIdIndex];
      }

      if (resolvedProgramId === MEMO_PROGRAM_ID) {
        memoData = decodeInstructionData(instruction.data);
        break;

      }
    }

    if (!memoData) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        signature,
        error: 'No HashDrop Memo found in this transaction.',
        version: HASHDROP_VERSION,
        mode: 'PROOF',
      };
    }

    // Fee payer / publisher wallet address
    const signer = extractAccountAddress(accountKeys?.[0]);

    // Stage 3: Decode the memo and detect V3 PROOF
    console.log('[HashDrop Proof] Decoded Memo:', memoData);

    if (!isValidProofPayload(memoData)) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        signature,
        error: 'Not a valid HashDrop Proof Drop.',
        version: HASHDROP_VERSION,
        mode: 'PROOF',
      };
    }

    // Stage 4: Parse the proof fields
    const proofPayload = decodeProofPayload(memoData);
    if (!proofPayload) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        signature,
        error: 'Invalid HashDrop V3 Proof payload.',
        version: HASHDROP_VERSION,
        mode: 'PROOF',
      };
    }

    console.log('[HashDrop Proof] Parsed V3 PROOF:', proofPayload);

    // Validate HashDrop ID if provided
    if (expectedHashDropId && proofPayload.hashDropId !== expectedHashDropId) {
      return {
        verified: false,
        hashDropId: proofPayload.hashDropId,
        contentHash: proofPayload.contentHash,
        contentSize: proofPayload.contentSize,
        calculatedHash: '',
        calculatedSize: 0,
        signature,
        signer,
        error: 'HashDrop ID does not match the transaction.',
        version: proofPayload.version,
        mode: proofPayload.mode,
        transactionVersion,
      };
    }

    // Stage 5 + 6: Calculate SHA-256 and UTF-8 byte length of supplied content
    const contentBytes = stringToBytes(originalContent);
    const calculatedHash = await calculateHash(contentBytes);
    const calculatedSize = contentBytes.length;

    console.log('[HashDrop Proof] Verification:', {
      calculatedHash,
      onChainHash: proofPayload.contentHash,
      hashMatch: calculatedHash === proofPayload.contentHash,
      calculatedSize,
      onChainSize: proofPayload.contentSize,
      sizeMatch: calculatedSize === proofPayload.contentSize,
      transactionVersion,
    });

    // Stage 7: Compare both hash and size
    const hashMatch = calculatedHash === proofPayload.contentHash;
    const sizeMatch = calculatedSize === proofPayload.contentSize;
    const verified = hashMatch && sizeMatch;

    if (!verified) {
      const errors: string[] = [];
      if (!hashMatch) errors.push('content hash does not match');
      if (!sizeMatch) errors.push('content size does not match');

      return {
        verified: false,
        hashDropId: proofPayload.hashDropId,
        contentHash: proofPayload.contentHash,
        contentSize: proofPayload.contentSize,
        calculatedHash,
        calculatedSize,
        signature,
        signer,
        error: `PROOF NOT VERIFIED — The supplied content does not match the on-chain commitment (${errors.join(', ')}).`,
        version: proofPayload.version,
        mode: proofPayload.mode,
        transactionVersion,
      };
    }

    return {
      verified: true,
      hashDropId: proofPayload.hashDropId,
      contentHash: proofPayload.contentHash,
      contentSize: proofPayload.contentSize,
      calculatedHash,
      calculatedSize,
      signature,
      signer,
      error: null,
      version: proofPayload.version,
      mode: proofPayload.mode,
      transactionVersion,
    };
  } catch (error) {
    console.error('[HashDrop Proof] Error:', error);
    return {
      verified: false,
      hashDropId: '',
      contentHash: '',
      contentSize: 0,
      calculatedHash: '',
      calculatedSize: 0,
      signature,
      error: error instanceof Error ? error.message : 'Unknown error during proof verification.',
      version: HASHDROP_VERSION,
      mode: 'PROOF',
    };
  }
}

/**
 * Verify a Private Drop by transaction signature and ML-KEM secret key.
 *
 * Private Drops store a commitment on-chain and encrypted content off-chain.
 * Verification requires:
 * 1. Fetch the Solana transaction
 * 2. Locate the HashDrop Memo instruction
 * 3. Decode the memo and detect HASHDROP|v3|PRIVATE|...
 * 4. Parse the private payload fields
 * 5. Import the encrypted artifact (off-chain)
 * 6. Decapsulate ML-KEM ciphertext with secret key → shared secret
 * 7. Derive KEK via HKDF-SHA-256 from shared secret
 * 8. Unwrap encrypted AES key with KEK → random AES content key
 * 9. Decrypt AES-GCM ciphertext with AES key → plaintext
 * 10. Verify GCM authentication
 * 11. Verify plaintext byte length and SHA-256
 *
 * @param connection - Solana connection
 * @param signature - The Solana transaction signature
 * @param mlKemSecretKey - Recipient's ML-KEM-768 secret key
 * @param encryptedArtifact - The encrypted content artifact (off-chain)
 * @param mlKemCiphertext - ML-KEM-768 ciphertext (needed for decapsulation)
 * @param expectedHashDropId - Optional HashDrop ID to validate against
 * @returns PrivateVerificationResult with verified/not-verified status
 */
export async function verifyPrivateDrop(
  connection: Connection,
  signature: string,
  mlKemSecretKey: Uint8Array,
  encryptedArtifact: {
    hashDropId: string;
    contentHash: string;
    contentSize: number;
    contentType: string;
    keyFingerprint: string;
    mlKemCiphertext: Uint8Array;
    iv: Uint8Array;
    ciphertext: Uint8Array;
  },
  mlKemCiphertext: Uint8Array,
  expectedHashDropId?: string
): Promise<PrivateVerificationResult> {
  try {
    // Stage 1: Fetch the transaction
    console.log('[HashDrop Private] Fetching transaction:', signature);

    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        contentType: '',
        plaintext: null,
        signature,
        error: 'Transaction not found.',
        version: HASHDROP_VERSION,
        mode: 'PRIVATE',
      };
    }

    // Determine transaction version
    const transactionVersion = getTransactionVersionFromRpc(tx);

    // Stage 2: Locate the HashDrop Memo instruction
    //
    // The RPC response shape differs by transaction version:
    // - legacy (json):   message.accountKeys + message.instructions
    // - v0/v1 (json):    message.staticAccountKeys + message.compiledInstructions
    // - jsonParsed:      message.accountKeys (parsed keys) + message.instructions
    // A REAL Devnet v0 response carries staticAccountKeys + compiledInstructions
    // and NO message.instructions field, so read from whichever are present.
    const txAny: any = tx;
    const message = txAny?.transaction?.message;
    const accountKeys = message?.accountKeys || message?.staticAccountKeys;
    const instructions: any[] = message?.instructions || message?.compiledInstructions || [];

    if (!instructions || instructions.length === 0) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        contentType: '',
        plaintext: null,
        signature,
        error: 'No instructions found in transaction.',
        version: HASHDROP_VERSION,
        mode: 'PRIVATE',
      };
    }

    // Resolve account keys from various formats:
    // - strings (legacy json)
    // - PublicKey instances (v0 staticAccountKeys deserialized by web3.js)
    // - parsed keys ({ pubkey, signer, writable, source }) from jsonParsed
    let resolvedAccountKeys: string[] = [];
    if (accountKeys) {
      resolvedAccountKeys = accountKeys.map((key: any) => {
        if (typeof key === 'string') return key;
        if (key.toBase58) return key.toBase58();
        if (key._bn) return new PublicKey(key).toBase58();
        if (key.pubkey) return String(key.pubkey);
        return String(key);
      });
    }

    // Find the memo instruction
    let memoData: string | null = null;

    for (const instruction of instructions) {
      let resolvedProgramId: string | null = null;

      if (instruction.programId) {
        if (typeof instruction.programId === 'string') {
          resolvedProgramId = instruction.programId;
        } else if (instruction.programId.toBase58) {
          resolvedProgramId = instruction.programId.toBase58();
        }
      } else if (instruction.programIdIndex !== undefined && resolvedAccountKeys[instruction.programIdIndex]) {
        resolvedProgramId = resolvedAccountKeys[instruction.programIdIndex];
      }

      if (resolvedProgramId === MEMO_PROGRAM_ID) {
        memoData = decodeInstructionData(instruction.data);
        break;
      }
    }

    if (!memoData) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        contentType: '',
        plaintext: null,
        signature,
        error: 'No HashDrop Memo found in this transaction.',
        version: HASHDROP_VERSION,
        mode: 'PRIVATE',
      };
    }

    // Stage 3: Decode the memo and detect V3 PRIVATE
    console.log('[HashDrop Private] Decoded Memo:', memoData);

    if (!isValidPrivatePayload(memoData)) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        contentType: '',
        plaintext: null,
        signature,
        error: 'Not a valid HashDrop Private Drop.',
        version: HASHDROP_VERSION,
        mode: 'PRIVATE',
      };
    }

    // Stage 4: Parse the private payload
    const privatePayload = decodePrivatePayload(memoData);
    if (!privatePayload) {
      return {
        verified: false,
        hashDropId: '',
        contentHash: '',
        contentSize: 0,
        calculatedHash: '',
        calculatedSize: 0,
        contentType: '',
        plaintext: null,
        signature,
        error: 'Invalid HashDrop V3 PRIVATE payload.',
        version: HASHDROP_VERSION,
        mode: 'PRIVATE',
      };
    }

    console.log('[HashDrop Private] Parsed V3 PRIVATE:', privatePayload);

    // Fee payer / publisher wallet address
    const signer = extractAccountAddress(accountKeys?.[0]);

    // Validate HashDrop ID if provided
    if (expectedHashDropId && privatePayload.hashDropId !== expectedHashDropId) {
      return {
        verified: false,
        hashDropId: privatePayload.hashDropId,
        contentHash: privatePayload.contentHash,
        contentSize: privatePayload.contentSize,
        calculatedHash: '',
        calculatedSize: 0,
        contentType: privatePayload.contentType,
        plaintext: null,
        signature,
        signer,
        error: 'HashDrop ID does not match the transaction.',
        version: privatePayload.version,
        mode: privatePayload.mode,
        transactionVersion,
      };
    }

    // Stage 5: Verify artifact matches transaction
    // Compare immutable metadata between transaction and artifact
    if (encryptedArtifact.hashDropId !== privatePayload.hashDropId ||
        encryptedArtifact.contentHash !== privatePayload.contentHash ||
        encryptedArtifact.contentSize !== privatePayload.contentSize ||
        encryptedArtifact.contentType !== privatePayload.contentType ||
        encryptedArtifact.keyFingerprint !== privatePayload.keyFingerprint) {
      return {
        verified: false,
        hashDropId: privatePayload.hashDropId,
        contentHash: privatePayload.contentHash,
        contentSize: privatePayload.contentSize,
        calculatedHash: '',
        calculatedSize: 0,
        contentType: privatePayload.contentType,
        plaintext: null,
        signature,
        signer,
        error: 'Artifact does not belong to this HashDrop.',
        version: privatePayload.version,
        mode: privatePayload.mode,
        transactionVersion,
      };
    }

    // Stage 6: Decrypt the content
    const { decryptPrivateContent } = require('./crypto/privateDrop');
    
    // Decode the encrypted key envelope from the payload
    // The envelope IV and wrapped key are raw binary (not UTF-8 text), so they
    // must be decoded byte-exactly with the binary-safe Base64 helpers.
    const encryptedKeyIv = base64ToBytes(privatePayload.encryptedKeyIv);
    const encryptedKey = base64ToBytes(privatePayload.encryptedKey);
    const encryptedKeyEnvelope = { iv: encryptedKeyIv, encryptedKey };
    
    // The ML-KEM ciphertext is part of the encrypted artifact (off-chain)
    const mlKemCiphertext = encryptedArtifact.mlKemCiphertext;

    let decryptionResult;
    try {
      decryptionResult = await decryptPrivateContent({
        hashDropId: privatePayload.hashDropId,
        encryptedArtifact,
        encryptedKeyEnvelope,
        mlKemCiphertext,
        mlKemSecretKey,
        keyFingerprint: privatePayload.keyFingerprint,
        expectedHash: privatePayload.contentHash,
        expectedSize: privatePayload.contentSize,
        contentType: privatePayload.contentType,
      });
    } catch (e: any) {
      return {
        verified: false,
        hashDropId: privatePayload.hashDropId,
        contentHash: privatePayload.contentHash,
        contentSize: privatePayload.contentSize,
        calculatedHash: '',
        calculatedSize: 0,
        contentType: privatePayload.contentType,
        plaintext: null,
        signature,
        signer,
        error: `Decryption failed: ${e.message}`,
        version: privatePayload.version,
        mode: privatePayload.mode,
        transactionVersion,
      };
    }

    return {
      verified: true,
      hashDropId: privatePayload.hashDropId,
      contentHash: privatePayload.contentHash,
      contentSize: privatePayload.contentSize,
      calculatedHash: decryptionResult.hash,
      calculatedSize: decryptionResult.size,
      contentType: privatePayload.contentType,
      plaintext: new TextDecoder().decode(decryptionResult.plaintext),
      signature,
      signer,
      error: null,
      version: privatePayload.version,
      mode: privatePayload.mode,
      transactionVersion,
    };
  } catch (error) {
    console.error('[HashDrop Private] Error:', error);
    return {
      verified: false,
      hashDropId: '',
      contentHash: '',
      contentSize: 0,
      calculatedHash: '',
      calculatedSize: 0,
      contentType: '',
      plaintext: null,
      signature,
      error: error instanceof Error ? error.message : 'Unknown error during private verification.',
      version: HASHDROP_VERSION,
      mode: 'PRIVATE',
    };
  }
}