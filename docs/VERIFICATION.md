# Verification

A HashDrop is VERIFIED ON-CHAIN only when:

1. Transaction is fetched from Solana by transaction signature;
2. Transaction contains a valid Memo instruction from the SPL Memo program;
3. Memo content contains a valid HashDrop payload;
4. The client recomputes the protocol-defined cryptographic hash;
5. The recomputed value exactly matches the memo payload.

Verification must be understandable without trusting a HashDrop backend.

If any check fails, show a verification failure rather than a best-effort preview.

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

## Memo Drop Verification

For Memo Drop publications, verification works as follows:

```
Transaction Signature
           ↓
      Fetch Transaction
           ↓
      Find Memo Instruction
           ↓
      Decode HashDrop Payload
           ↓
      Recompute Content Hash
           ↓
      Verify Hash Match
           ↓
      ✅ VERIFIED
```

HashDrop Protocol v3 supports three modes:

**PUBLIC** (content published on-chain):
`HASHDROP|v3|PUBLIC|hashDropId|sha256|mimeType|contentSize|base64Content`

**PROOF** (only cryptographic proof published):
`HASHDROP|v3|PROOF|hashDropId|sha256|contentSize`

**PRIVATE** (commitment on-chain, encrypted content off-chain):
`HASHDROP|v3|PRIVATE|hashDropId|sha256|contentSize|mimeType|cryptoVersion|keyFingerprint|encryptedKeyIv|encryptedKey`

Connection to the Solana network is required for verification. The transaction signature serves as the HashDrop identifier.

## Transaction Version Support

The verification engine supports:

- **Legacy transactions**: Version undefined
- **v0 transactions**: Version 0
- **v1 transactions**: Version 1 (ready)

### RPC Message Shapes

The memo-extraction step handles every shape `getTransaction()` returns:

| Transaction version | Account keys | Instructions |
|---------------------|--------------|--------------|
| legacy (json)       | `message.accountKeys` | `message.instructions` |
| v0 / v1 (json)      | `message.staticAccountKeys` | `message.compiledInstructions` |
| jsonParsed          | `message.accountKeys` (parsed keys) | `message.instructions` |

All retrieval paths (`verifyBySignature`, `verifyProofDrop`, `verifyPrivateDrop`) read
`message.instructions || message.compiledInstructions` and
`message.accountKeys || message.staticAccountKeys`, resolving program IDs via
`programIdIndex` when needed. Real Devnet/Mainnet v0 responses carry ONLY
`staticAccountKeys` + `compiledInstructions` (with Buffer instruction data).

## Transaction Signature Validation (Viewer)

The Viewer validates user-entered signatures canonically before retrieval
(`src/lib/signature.ts`, `normalizeTransactionSignature()`):

1. Trim the input (handles pasted whitespace/newlines)
2. Base58 decode (rejects invalid characters: `0`, `O`, `I`, `l`, symbols)
3. Require **exactly 64 decoded bytes** (`SIGNATURE_BYTE_LENGTH`)
4. Use the normalized signature for RPC retrieval and Explorer links

This is network-independent. Base58 of a 64-byte ed25519 signature is
**87 or 88 characters** — a hard-coded textual length such as `length < 88`
wrongly rejects valid Mainnet signatures.

## V3 PUBLIC Verification Process

1. Fetch transaction from Solana by signature
2. Find the SPL Memo Instruction in the transaction
3. Decode the memo data
4. Parse the V3 PUBLIC payload format
5. Decode the base64 content
6. Calculate SHA-256 hash of the decoded content
7. Compare with the on-chain hash

If all checks pass, the HashDrop is verified as authentic.

## V3 PROOF Verification Process

1. Fetch transaction from Solana by signature
2. Find the SPL Memo Instruction in the transaction
3. Decode the memo data
4. Parse the V3 PROOF payload format
5. User supplies the original content
6. Calculate SHA-256 hash of the supplied content
7. Calculate UTF-8 byte length of the supplied content
8. Compare both hash and size with on-chain commitment

If both match, the proof is VERIFIED.

## V3 PRIVATE Verification Process

1. Fetch transaction from Solana by signature
2. Find the SPL Memo Instruction in the transaction
3. Decode the memo data
4. Parse the V3 PRIVATE payload format
5. Import the encrypted artifact (user-controlled/off-chain) — paste the canonical
   `HASHDROP-PRIVATE-BLOB|v1|…` string or import the downloaded
   `hashdrop-private-<hashDropId>.hdp` file (read locally as text; never uploaded)
6. Verify artifact metadata matches transaction metadata:
   - hashDropId
   - sha256
   - contentSize
   - mimeType
   - cryptoVersion
   - keyFingerprint
7. If metadata does not match: NOT VERIFIED ("Artifact does not belong to this HashDrop")
8. Import the ML-KEM secret key — paste the `HASHDROP-KEY|v1|ML-KEM-768|…` envelope or
   import the exported `hashdrop-mlkem-768-private-key-<keyFingerprint>.txt` file (read locally)
9. Decapsulate ML-KEM ciphertext with secret key → shared secret
10. Derive KEK via HKDF-SHA-256 from shared secret
11. Reconstruct exact key-envelope AAD
12. Unwrap encrypted AES key with KEK (with AAD)
13. Reconstruct exact content AAD
14. Decrypt AES-GCM ciphertext with AES key (with AAD)
15. Verify GCM authentication
16. Verify plaintext byte length matches contentSize
17. Verify plaintext SHA-256 matches on-chain sha256

If all checks pass, the private content is VERIFIED.

**Important distinctions:**
- **DECRYPTED** means AES-GCM authentication succeeded
- **VERIFIED** means AES-GCM authentication + byte length + SHA-256 + metadata matching all pass

## Verification Result

When verified successfully, displays:

- ✅ VERIFIED
- HashDrop ID
- Content
- SHA-256 hash
- MIME type
- Content size
- Transaction signature
- Transaction version (legacy/v0/v1)

## Network-Specific Verification

### Devnet

- Uses default Solana Devnet RPC
- No API key required
- Test transactions for verification

### Mainnet

- Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` to be configured
- Uses Helius, QuickNode, or other RPC provider
- Real on-chain transactions for verification