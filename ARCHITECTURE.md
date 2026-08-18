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
          V2 Memo Drop
                  |
          Solana Devnet
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

## Frontend

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

## Solana

Solana holds the canonical ON-CHAIN record.

The SPL Memo program stores the content directly in the transaction instruction.

## Verification

A HashDrop is VERIFIED ON-CHAIN only when:

1. Transaction is fetched from Solana by transaction signature;
2. Transaction contains a valid Memo instruction from the SPL Memo program;
3. Memo content contains a valid HashDrop payload;
4. The client recomputes the protocol-defined cryptographic hash;
5. The recomputed value exactly matches the memo payload.

Verification must be understandable without trusting a HashDrop backend.

If any check fails, show a verification failure rather than a best-effort preview.

## Memo Drop Protocol

Content is published using Solana transactions with the SPL Memo program:

```text
Content
   ↓
SHA-256
   ↓
HashDrop ID
   ↓
V2 Memo Drop
   ↓
Solana transaction
   ↓
Transaction Signature
```

The memo payload format is:
`HASHDROP|v2|MEMO|hashDropId|sha256|mimeType|length|base64Content`

No storage accounts are created. No chunking is needed. The transaction itself is the publication record.