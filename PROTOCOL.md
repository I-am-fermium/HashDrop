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

HashDrop uses Memo Drop for all publications:

- Uses Solana's SPL Memo program
- No storage account required
- Content stored in transaction memo
- Lower cost (only protocol fee + network fee)

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

## Memo Drop Format

The memo payload format is:

```
HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>
```

Where:
- `v2` - Protocol version
- `MEMO` - Publication method identifier
- `<hashDropId>` - Deterministic identifier
- `<sha256>` - SHA-256 hash of content
- `<mimeType>` - Content type (e.g., text/plain)
- `<length>` - Content length in bytes
- `<base64Content>` - Base64-encoded content

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