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

The memo payload format is:
`HASHDROP|v2|MEMO|hashDropId|sha256|mimeType|length|base64Content`

Connection to the Solana network is required for verification. The transaction signature served as the HashDrop identifier.

## Transaction Version Support

The verification engine supports:

- **Legacy transactions**: Version undefined
- **v0 transactions**: Version 0
- **v1 transactions**: Version 1 (ready)

## V2 Verification Process

1. Fetch transaction from Solana by signature
2. Find the Memo Instruction in the transaction
3. Decode the memo data from Base58
4. Parse the V2 payload format
5. Decode the base64 content
6. Calculate SHA-256 hash of the decoded content
7. Compare with the on-chain hash

If all checks pass, the HashDrop is verified as authentic.

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