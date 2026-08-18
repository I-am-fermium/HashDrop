# Verification

A HashDrop is VERIFIED ON-CHAIN only when:

1. Transaction is fetched from Solana by transaction signature;
2. Transaction contains a valid Memo instruction from the SPL Memo program;
3. Memo content contains a valid HashDrop payload;
4. The client recomputes the protocol-defined cryptographic hash;
5. The recomputed value exactly matches the memo payload.

Verification must be understandable without trusting a HashDrop backend.

If any check fails, show a verification failure rather than a best-effort preview.

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
`HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>`

Connection to the Solana network is required for verification. The transaction signature served as the HashDrop identifier.

## V2 Verification Process

1. Fetch transaction from Solana by signature
2. Find the Memo Instruction in the transaction
3. Decode the memo data from Base58
4. Parse the V2 payload format
5. Decode the base64 content
6. Calculate SHA-256 hash of the decoded content
7. Compare with the on-chain hash

If all checks pass, the HashDrop is verified as authentic.