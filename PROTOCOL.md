# HashDrop Protocol Specification

This document is the canonical protocol contract.

## Record states

A record may transition through:

```text
OPEN -> FINALIZING -> FINALIZED
```

Failed or interrupted client operations may leave an OPEN record that can be resumed, subject to protocol rules.

FINALIZED is terminal for HashDrop mutations.

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

## Data accounts

Data is divided into deterministic bounded chunks.

Each chunk must contain only the metadata needed to associate it with the correct HashDrop and chunk position plus the actual bytes.

Finalized chunk data must not be modifiable through HashDrop.

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
