# Error Handling

Every user-visible blockchain error should preserve enough context to explain the state of the publication.

## Categories

- wallet rejection
- insufficient balance
- RPC failure
- transaction expiration
- invalid transaction format
- memo instruction missing or malformed
- content too large for Memo Drop
- verification mismatch
- transaction not found

## Memo Drop Specific

### Content Too Large

When content exceeds the Memo Drop size limits, show:

```text
Content too large for HashDrop Memo Drop.

HashDrop currently supports small on-chain content only.
```

### Transaction Size Validation

Before submitting, validate that the complete serialized transaction fits within Solana's limits. Do not attempt to fall back to storage.

## Required Behavior

Never reset the UI to a blank state after an error.

After an error, the transaction signature should be preserved for retry or verification purposes.

Retries must be safe and must not silently create duplicate publications.