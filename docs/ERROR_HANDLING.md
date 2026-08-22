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

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

### RPC Error Handling

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

### RPC 403/401 Errors

When the Mainnet RPC returns 403 or 401 errors:

```text
RPC Access Forbidden

The configured Mainnet RPC endpoint rejected the request.

Please verify:
1. NEXT_PUBLIC_SOLANA_MAINNET_RPC is set in your environment
2. Your RPC API key is valid
3. Your RPC provider account is active

For Devnet, no configuration is required.
```

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

### RPC Configuration Error

```text
RPC not configured

Mainnet requires NEXT_PUBLIC_SOLANA_MAINNET_RPC to be set.

For Devnet, no configuration is needed.
```

## Error Handling Flow

1. Catch error from wallet/RPC
2. Classify error type
3. Show user-friendly message
4. Preserve transaction state
5. Allow retry or cancel

## Network-Specific Errors

### Devnet

- Uses default Solana Devnet RPC
- No API key required
- Test SOL for transactions

### Mainnet

- Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` to be configured
- Uses Helius, QuickNode, or other RPC provider
- Real SOL transactions
- API key must be valid

If Mainnet RPC returns 403/401:

1. Check that `NEXT_PUBLIC_SOLANA_MAINNET_RPC` is set
2. Verify the API key is valid
3. Check the RPC provider's dashboard for issues