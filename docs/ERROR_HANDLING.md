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

### Transaction Version Limits

| Version | Max Size | Error Message |
|---------|----------|---------------|
| v0      | 1232 B   | "Transaction too large for v0" |
| v1      | 4096 B   | "Transaction too large for v1" |

## Required Behavior

Never reset the UI to a blank state after an error.

After an error, the transaction signature should be preserved for retry or verification purposes.

Retries must be safe and must not silently create duplicate publications.

## Error Messages

### Wallet Rejection
```text
Transaction rejected

Your wallet rejected the transaction. No funds were spent.
```

### Insufficient Funds
```text
Insufficient funds

Your wallet doesn't have enough SOL for this transaction.
```

### RPC Failure
```text
Network error

Unable to reach Solana network. Please try again.
```

### Transaction Expired
```text
Transaction expired

The transaction blockhash has expired. Please try again.
```

### Content Too Large
```text
Content too large

The content exceeds the Memo Drop size limit.
```

## Error Handling Flow

1. Catch error from wallet/RPC
2. Classify error type
3. Show user-friendly message
4. Preserve transaction state
5. Allow retry or cancel