# Architecture

## System model

```text
               HashDrop
                     |
              Content
                     |
              SHA-256
                     |
            HashDrop ID
                     |
            V3 PUBLIC/PROOF
                     |
            Solana Network (SPL Memo)
                     |
          Transaction Signature
                     |
                Retrieval
                     |
            Content Verification
                     |
                ✅ VERIFIED
```

No Storage Drop.
No storage accounts.
No chunking.
No storage funding.
No backend.

The application is a Memo-only, zero-backend protocol.

## Frontend Architecture

### RPC Layer (Solana Kit Primary)

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

**RPC Factory Pattern:**
- `createRpc()` - Returns the appropriate Solana Kit RPC client
- `createConnection()` - Returns the appropriate web3.js Connection for Phantom

### Frontend

The frontend is a client, not a canonical database.

Responsibilities:

- editor/file input
- byte encoding and counting
- hashing
- content validation
- content type detection
- HashDrop ID calculation
- network fee estimation
- wallet interaction
- transaction orchestration
- progress display
- reconstruction
- client-side verification

Temporary browser memory is permitted while creating a drop.

## Media Content (PROOF / PRIVATE)

HashDrop supports PHOTO / VIDEO / VOICE (audio) objects in PROOF and PRIVATE
modes through a unified content abstraction (`src/lib/media.ts`). PUBLIC mode
remains TEXT ONLY and is byte-compatible.

```
PUBLIC  -> TEXT ONLY (existing implementation unchanged)
PROOF   -> TEXT + PHOTO + VIDEO + VOICE
PRIVATE -> TEXT + PHOTO + VIDEO + VOICE
```

Content descriptor per media object:

```text
contentKind  (IMAGE | VIDEO | AUDIO)
mimeType     (validated against magic bytes — never trusted from the client)
filename     (sanitized, no '|')
size         (exact byte length)
sha256       (SHA-256 of the EXACT original bytes)
```

- Hashes are always `SHA-256(original bytes)`. No previews, transcodes,
  recompressions, or Base64/JSON wrappers are hashed.
- MIME types are validated against file signatures (JPEG/PNG/WebP/GIF, MP4/
  WebM/QuickTime, OGG/WAV/MP3/WebM-audio). Cross-kind spoofing is rejected.
- `MAX_MEDIA_FILE_BYTES = 100 MB` (configurable) — files above the cap fail
  cleanly before hashing.
- Large media never enters a Solana memo.

**PROOF media** uses the unified memo
(`...PROOF|hashDropId|sha256|size|contentType|filename`) carrying only the
commitment + type + artifact reference; the same shape is used for TEXT (with
`text/plain` + `''`). The original file stays with the user.

**PRIVATE media** reuses the exact AES-256-GCM + ML-KEM-768 + HKDF-SHA-256
architecture with an unchanged 11-field memo. The encrypted artifact envelope
is a single canonical 13-field format carrying an explicit object `type`
(`TEXT | IMAGE | VIDEO | AUDIO`) alongside filename/MIME/size; the artifact
**version** (`v1`, the schema) is independent of the object **type**. The
object type is authenticated via AAD, and filenames are sanitized at import —
there is no v1/v2 split.

## Solana

Solana holds the canonical ON-CHAIN record.

The SPL Memo program stores the content directly in the transaction instruction.

### Transaction Types

- **v0 transactions** (current): 1232-byte limit, used for Phantom wallet compatibility
- **v1 transactions** (ready): 4096-byte limit, SDK support available, wallet support pending

### Transaction Building

1. Build TransactionMessage with memo instruction
2. Compile to v0 message (current) or v1 message (target)
3. Create VersionedTransaction
4. Serialize and validate size
5. Sign with wallet
6. Send to Solana network

### RPC Operations

All RPC operations use Solana Kit:

- `getLatestBlockhash()` - Via `rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()`
- `getBalance()` - Via Kit RPC
- `getTransaction()` - Via Kit RPC
- `simulateTransaction()` - Via Kit RPC

### Transaction Signing

Transaction signing uses web3.js for Phantom compatibility:

- Build VersionedTransaction using web3.js
- Sign via `wallet.signTransaction()` (Phantom)
- Send via `connection.sendRawTransaction()` (web3.js Connection)

## Verification

A HashDrop is VERIFIED ON-CHAIN only when:

1. Transaction is fetched from Solana by transaction signature;
2. Transaction contains a valid Memo instruction from the SPL Memo program;
3. Memo content contains a valid HashDrop payload;
4. The client recomputes the protocol-defined cryptographic hash;
5. The recomputed value exactly matches the memo payload.

Verification must be understandable without trusting a HashDrop backend.

If any check fails, show a verification failure rather than a best-effort preview.

### Memo Instruction Extraction

`getTransaction()` returns different message shapes per transaction version:

- legacy (json): `message.accountKeys` + `message.instructions`
- v0/v1 (json): `message.staticAccountKeys` + `message.compiledInstructions`
- jsonParsed: `message.accountKeys` (parsed keys) + `message.instructions`

All retrieval paths read both variants (`instructions || compiledInstructions`,
`accountKeys || staticAccountKeys`) and resolve program IDs via `programIdIndex`.
Real Devnet/Mainnet v0 responses carry ONLY `staticAccountKeys` +
`compiledInstructions` (with Buffer instruction data).

### Signature Validation

User-entered signatures are validated canonically before retrieval
(`src/lib/signature.ts`): trim → Base58 decode → exactly 64 bytes. Base58 of a
64-byte ed25519 signature is 87 or 88 characters, so a hard-coded textual
length would reject valid Mainnet signatures. Validation is network-independent.

## HashDrop Protocol v3

Content is published using Solana transactions with the SPL Memo program.

### PUBLIC Mode

```text
Content
   ↓
SHA-256 + Base64
   ↓
HashDrop ID
   ↓
V3 PUBLIC payload
   ↓
Solana transaction (SPL Memo instruction)
   ↓
Transaction Signature
```

Payload format:
`HASHDROP|v3|PUBLIC|hashDropId|sha256|mimeType|contentSize|base64Content`

### PROOF Mode

```text
Content
   ↓
SHA-256 (exact UTF-8 bytes)
   ↓
HashDrop ID
   ↓
V3 PROOF payload (hash + size only)
   ↓
Solana transaction (SPL Memo instruction)
   ↓
Transaction Signature
```

Payload format:
`HASHDROP|v3|PROOF|hashDropId|sha256|contentSize`

### PRIVATE Mode

```text
Content
   │
   ├── SHA-256 → plaintext hash (on-chain commitment)
   │
   └── random AES-256 key (independently generated)
          │
          ├───────────────┐
          │               │
          ▼               ▼
     AES-256-GCM      ML-KEM-768
          │               │
          ▼               ▼
     ciphertext      ML-KEM shared secret
     (in artifact)        │
                          ▼
                     HKDF-SHA-256
                          │
                          ▼
                     key-encryption key (KEK)
                          │
                          ▼
                     AES-256-GCM wrapping
                          │
                          ▼
                     encrypted AES-key envelope
                     (on-chain)
```

Payload format:
`HASHDROP|v3|PRIVATE|hashDropId|sha256|contentSize|mimeType|cryptoVersion|keyFingerprint|encryptedKeyIv|encryptedKey`

Cryptography:
- **AES-256-GCM**: Symmetric encryption for content (Web Crypto API)
- **ML-KEM-768**: Post-quantum key encapsulation (FIPS 203, mlkem npm package)
- **HKDF-SHA-256**: Key derivation from ML-KEM shared secret
- Key lifecycle: Generate random AES key → AES-GCM encrypt content → ML-KEM encapsulate → HKDF derive KEK → AES-GCM wrap AES key
- On-chain size: ~255 bytes (fits within current 1232-byte Solana limit)
- Serialized transaction: 492 bytes (measured)

The encrypted content artifact is user-controlled/off-chain. The publish result
UI exports the exact publish-time artifacts client-side (`src/lib/download.ts`,
Blob downloads — no server):

| File | Content |
|------|---------|
| `hashdrop-private-<hashDropId>.hdp` | canonical `HASHDROP-PRIVATE-BLOB\|v1\|…` artifact envelope |
| `hashdrop-mlkem-768-private-key-<keyFingerprint>.txt` | `HASHDROP-KEY\|v1\|ML-KEM-768\|…` |
| `hashdrop-mlkem-768-public-key-<keyFingerprint>.txt` | `HASHDROP-PUBKEY\|v1\|ML-KEM-768\|…` |

The Viewer accepts the `.hdp` file (paste or file import) together with the key
`.txt` for DECRYPT & VERIFY. HashDrop never stores either file.

No storage accounts are created. No chunking is needed. The transaction itself is the publication record.

## Transaction Version Support

### Current Implementation

- **Version**: v0
- **Max Size**: 1232 bytes
- **Wallet Support**: Phantom, Brave (via signTransaction)
- **RPC Layer**: Solana Kit

### Target Implementation

- **Version**: v1
- **Max Size**: 4096 bytes
- **Wallet Support**: Pending Phantom v1 signing support
- **RPC Layer**: Solana Kit

### Version Detection

The application detects transaction capabilities at runtime:
- Checks for `compileToV1Message()` in web3.js
- Checks for `compileTransactionMessage()` in Kit
- Falls back to v0 if v1 not supported by wallet

## Content Size Limits

| Transaction Version | Max Size | Effective Content |
|---------------------|----------|-------------------|
| legacy              | 1232 B   | ~800 B (base64)   |
| v0                  | 1232 B   | ~800 B (base64)   |
| v1                  | 4096 B   | ~2800 B (base64)  |

## Wallet Integration

Uses direct `window.solana` API for compatibility with Phantom/Brave wallets.

### Supported Operations
- `connect()` - Connect wallet
- `disconnect()` - Disconnect wallet
- `signTransaction()` - Sign VersionedTransaction
- `sendRawTransaction()` - Send serialized transaction

### Wallet States
- disconnected
- connecting
- connected
- network switching/selecting
- transaction awaiting approval
- transaction submitted
- confirmation pending
- confirmed
- rejected
- expired
- insufficient funds
- RPC failure

## Network Configuration

### Environment Variables

- `NEXT_PUBLIC_SOLANA_DEVNET_RPC` - Devnet RPC URL (optional, defaults to Solana Devnet)
- `NEXT_PUBLIC_SOLANA_MAINNET_RPC` - Mainnet RPC URL (REQUIRED for Mainnet)

### Network Selection

Users can switch networks via:
- URL parameter `?network=mainnet`
- Network selector in the UI
- localStorage setting

### RPC Factory

```typescript
// Get Solana Kit RPC client
const rpc = createRpc();

// Get web3.js Connection for Phantom
const connection = createConnection();
```

## Error Handling

RPC errors are captured and logged with safe information:

```typescript
console.error('[HashDrop] getLatestBlockhash failed:', {
  operation: 'getLatestBlockhash',
  network,
  provider,
  message: error?.message,
  code: error?.code,
});
```

Never logs:
- API keys
- Full RPC URLs with credentials
- Query parameters
- Authorization headers