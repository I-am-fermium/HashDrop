# HashDrop Protocol Specification

This document is the canonical protocol contract.

## Record states

A record may transition through:

```text
OPEN -> FINALIZING -> FINALIZED
```

Failed or interrupted client operations may leave an OPEN record that can be resumed, subject to protocol rules.

FINALIZED is terminal for HashDrop mutations.

## Publication Method

HashDrop uses the SPL Memo program for all publications:

- Uses Solana's SPL Memo program
- No storage account required
- Content stored in transaction memo
- Lower cost (only protocol fee + network fee)

## Protocol Version

HashDrop Protocol v3 is the current and only supported protocol version.

Supported modes:
- **PUBLIC** - Content is published on-chain
- **PROOF** - Only the cryptographic proof is published; original content remains private
- **PRIVATE** - Content is encrypted locally before publication; only the key holder can decrypt

## Metadata account

The metadata account must contain, at minimum:

- protocol version
- HashDrop ID / deterministic identifier
- creator/publication wallet
- content hash
- content type
- language metadata when applicable
- content byte length
- chunk count
- creation slot/timestamp reference
- status
- version number

The exact serialization must be defined in the implementation and kept backward-compatible once deployed.

## Instructions

### create_drop

Creates the metadata and required storage state.

Responsibilities:

- validate requested record parameters
- establish creator authority
- establish deterministic identifiers
- allocate required storage state

### write_chunk

Writes a bounded content chunk.

Rules:

- only authorized creator can write while record is mutable
- chunk index must be valid
- written bytes must not exceed the defined chunk capacity
- repeated writes must be deterministic/idempotent or explicitly rejected

### finalize_drop

Finalizes the publication.

It must verify at least:

- expected byte length
- expected chunk count/state
- authorization
- completion state
- stored content hash or a protocol-defined equivalent verification path

On success, status becomes FINALIZED.

### verify_drop

Optional helper instruction. Client-side verification remains mandatory for the product experience.

## V3 PUBLIC Format

The Public mode payload format is:

```
HASHDROP|v3|PUBLIC|<hashDropId>|<sha256>|<mimeType>|<contentSize>|<base64Content>
```

Where:
- `v3` - Protocol version
- `PUBLIC` - Mode identifier (content published on-chain)
- `<hashDropId>` - Deterministic identifier
- `<sha256>` - SHA-256 hash of content
- `<mimeType>` - Content type (e.g., text/plain)
- `<contentSize>` - Content length in bytes
- `<base64Content>` - Base64-encoded content

## V3 PROOF Format

The Proof mode payload format is:

```
HASHDROP|v3|PROOF|<hashDropId>|<sha256>|<contentSize>
```

Where:
- `v3` - Protocol version
- `PROOF` - Mode identifier (only cryptographic commitment published)
- `<hashDropId>` - Deterministic identifier
- `<sha256>` - SHA-256 hash of exact UTF-8 content bytes
- `<contentSize>` - Exact UTF-8 byte length

Note: Proof mode does NOT store the original content, mimeType, or any timestamp/slot/blockTime.
The original content never leaves the browser.

## V3 PRIVATE Format

The Private mode payload format is:

```
HASHDROP|v3|PRIVATE|<hashDropId>|<sha256>|<contentSize>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<encryptedKeyIv>|<encryptedKey>
```

Where:
- `v3` - Protocol version
- `PRIVATE` - Mode identifier (commitment + encrypted key envelope on-chain)
- `<hashDropId>` - Deterministic identifier
- `<sha256>` - SHA-256 hash of original plaintext (hex)
- `<contentSize>` - Original UTF-8 byte length
- `<mimeType>` - MIME type of original content
- `<cryptoVersion>` - Cryptographic construction version (e.g., `HD-P1`)
- `<keyFingerprint>` - ML-KEM-768 public key fingerprint (first 16 hex chars of SHA-256)
- `<encryptedKeyIv>` - IV for encrypted AES key envelope (Base64, 16 chars)
- `<encryptedKey>` - Encrypted AES-256 key envelope (Base64, 64 chars for 48 bytes)

Note: Private mode does NOT store the original content, AES ciphertext, AES key, or ML-KEM secret key on-chain.
The encrypted content artifact is user-controlled/off-chain.

## Private Mode Cryptography

### Hybrid Encryption Architecture

Private mode uses hybrid encryption combining classical and post-quantum cryptography:

1. **AES-256-GCM** - Symmetric encryption for content
   - 256-bit key generated per drop (CSPRNG)
   - 96-bit IV/nonce generated per encryption operation
   - GCM mode provides authenticated encryption (confidentiality + integrity)
   - Key and IV are never reused
   - AAD binds encryption to HashDrop metadata

2. **ML-KEM-768** - Post-quantum key encapsulation (FIPS 203)
   - Protects the AES-256 key
   - NIST Level 3 security (~192-bit post-quantum security)
   - Public key: 1184 bytes, Secret key: 2400 bytes, Ciphertext: 1088 bytes

3. **HKDF-SHA-256** - Key derivation
   - Derives key-encryption key (KEK) from ML-KEM shared secret
   - Domain-separated salt and info construction
   - 32-byte output

### Cryptographic Construction

```
random AES-256 content key (32 bytes, CSPRNG)
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

### AAD Construction

**Key-envelope AAD:**
```
HASHDROP-PRIVATE-KEY|v1|<hashDropId>|<sha256>|<contentSize>|<mimeType>|<cryptoVersion>|<keyFingerprint>
```

**Content-artifact AAD:**
```
HASHDROP-PRIVATE-BLOB|v1|<hashDropId>|<sha256>|<contentSize>|<mimeType>|<cryptoVersion>|<keyFingerprint>
```

### HKDF Construction

```
salt = utf8ToBytes('HashDrop-Private-HKDF-Salt-v1')
info = utf8ToBytes('HASHDROP-PRIVATE-KEK|v1|' + keyFingerprint)
KEK = HKDF-SHA256(ikm=sharedSecret, salt=salt, info=info, length=32)
```

### Key Lifecycle

1. Generate random AES-256 content key (independently random)
2. Generate random 96-bit content IV
3. Encrypt content with AES-256-GCM (with AAD) → encrypted artifact
4. Encapsulate with ML-KEM-768 public key → shared secret
5. Derive KEK via HKDF-SHA-256 from shared secret
6. Wrap random AES key with KEK (with AAD) → encrypted key envelope
7. Store on-chain: commitment + encrypted key envelope
8. Store off-chain: encrypted artifact

### Decryption

1. Verify artifact metadata matches transaction metadata
2. Decapsulate ML-KEM ciphertext with secret key → shared secret
3. Derive KEK via HKDF-SHA-256 from shared secret
4. Reconstruct exact key-envelope AAD
5. Unwrap encrypted AES key with KEK (with AAD)
6. Reconstruct exact content AAD
7. Decrypt AES-GCM ciphertext with AES key (with AAD)
8. Verify plaintext byte length
9. Verify plaintext SHA-256

### Size Analysis

Private mode on-chain overhead:
- Protocol prefix: ~18 bytes
- HashDrop ID: ~20 bytes
- SHA-256: 64 bytes
- Metadata: ~25 bytes
- Crypto version: ~4 bytes
- Key fingerprint: ~16 bytes
- Encrypted key IV (Base64): ~24 bytes
- Encrypted key (Base64): ~64 bytes
- Pipe separators: ~10 bytes
- **Total: ~255 bytes**

Serialized transaction size: **492 bytes** (measured)
Current Solana limit: **1232 bytes**
Remaining headroom: **740 bytes**

### Encrypted Artifact Format

```
HASHDROP-PRIVATE-BLOB|v1|<hashDropId>|<sha256>|<contentSize>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<base64-mlkem-ct>|<base64-iv>|<base64-ciphertext>
```

### Key Export/Import Format

```
Secret: HASHDROP-KEY|v1|ML-KEM-768|<base64-secret-key>
Public: HASHDROP-PUBKEY|v1|ML-KEM-768|<base64-public-key>
```

### Fingerprint Construction

```
keyFingerprint = SHA256(publicKey).slice(0, 16)
```

First 16 hex characters (8 bytes) of SHA-256 of ML-KEM-768 public key. NOT a secret - used as identifier.

### Library

- ML-KEM-768: `mlkem` npm package (https://www.npmjs.com/package/mlkem)
  - Standards-compliant FIPS 203 implementation
  - Pure TypeScript, browser-compatible
  - No peer dependencies

### Key Loss Warning

Private content can only be decrypted with the required ML-KEM secret key.
HashDrop cannot recover lost private keys.
Users must securely store their secret keys.

### Wallet Integration

The Solana wallet is ONLY responsible for transaction signing.
ML-KEM keys are managed entirely outside the wallet.
Do NOT derive AES keys from wallet public keys.

## Immutability rules

After FINALIZED:

- content cannot be edited through HashDrop;
- metadata that would change the content meaning cannot be edited;
- the record cannot be deleted through HashDrop.

## Determinism

PDA seeds and HashDrop identifiers must be deterministic and collision-resistant.

The protocol must define byte ordering and serialization precisely. Never rely on JavaScript object property order for cryptographic identifiers.

## Canonical integrity rule

A valid ON-CHAIN HashDrop must satisfy:

1. Metadata identifies the content hash.
2. The browser retrieves all required chunks from Solana.
3. The browser reconstructs the bytes.
4. The browser computes the cryptographic hash using the exact protocol algorithm.
5. The resulting hash matches metadata.

Only then may the client display VERIFIED ON-CHAIN.

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

## Transaction Version Support

| Version | Max Size | Effective Content | Wallet Support |
|---------|----------|-------------------|----------------|
| v0      | 1232 B   | ~800 B (base64)   | Phantom, Brave |
| v1      | 4096 B   | ~2800 B (base64)  | Pending Phantom |

## Memo Drop Transaction Flow

```text
Connect Wallet
       ↓
Build transaction
       ↓
Get latest blockhash (Solana Kit RPC)
       ↓
Sign with Phantom (web3.js)
       ↓
Send transaction (Solana Kit RPC)
       ↓
Confirm on-chain
       ↓
Show signature