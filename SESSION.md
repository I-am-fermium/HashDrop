# Session

## Purpose

This file records the current state of AI-assisted development so Cline can continue work without guessing.

## Current Status

Phase 0 — Specification complete. Phase 1 (Static UI) complete. Phase 2 (Local Content Engine) complete. Phase 3 (Wallet Integration) complete. Phase 4 (Memo Drop) complete. Phase 5 (Testing & Verification) complete. Phase 6 (RPC Migration) complete.

**Recent Updates (2026-09-06):**
- ✅ Implemented real HashDrop platform fee: publish transactions include a `SystemProgram.transfer` (0.001 SOL / 1,000,000 lamports) from the user's wallet to `Amy4Tej83vsnCdFbBtfWmQrEdRLVF4AVAvZupyka8qQT`
- ✅ Added single source of truth constants: `HASHDROP_PLATFORM_FEE_LAMPORTS`, `HASHDROP_PLATFORM_FEE_SOL`, `HASHDROP_FEE_WALLET` in `src/lib/constants.ts`
- ✅ Fixed confirmation-modal cost double-count (0.001005 → previously 0.001010 SOL)
- ✅ Added transaction-builder test suite (`src/lib/transactions.test.ts`)
- ✅ Added production favicon `src/app/icon.svg` (red "H" on dark square)
- ✅ Updated Tailwind v4 preflight in `src/styles/globals.css` (`@import "tailwindcss"`)
- ✅ Fixed viewer (retrieve) page mobile layout in `src/app/viewer/page.tsx`

**Previous Updates (2026-08-22):**
- ✅ Migrated RPC layer to Solana Kit (getLatestBlockhash, etc.)
- ✅ Created RPC factory pattern in `src/lib/rpc/`
- ✅ Implemented network-specific RPC configuration
- ✅ Updated `transactions.ts` to use Solana Kit RPC
- ✅ Updated `page.tsx` to use Solana Kit RPC
- ✅ Fixed hydration mismatch in network state
- ✅ Fixed Mainnet RPC 403 error by requiring explicit configuration
- ✅ Updated documentation files (README.md, ARCHITECTURE.md, WALLET.md, SOLANA_KIT_MIGRATION.md)

## Key Findings

### Solana v1 Transaction Support
- **SDK Support**: ✅ Available (web3.js 1.98.4, Kit 7.1.1)
- **Wallet Support**: ⚠️ Phantom does NOT fully support v1 transaction signing
- **Network Support**: ✅ Devnet supports v1 transactions
- **Current Implementation**: v0 transactions (1232-byte limit)
- **Target Implementation**: v1 transactions (4096-byte limit) when Phantom adds support

### RPC Architecture (COMPLETED)

**Hybrid Architecture:**
- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

**RPC Factory Pattern:**
- `createRpc()` - Returns the appropriate Solana Kit RPC client
- `createConnection()` - Returns the appropriate web3.js Connection for Phantom

### Transaction Building
- Currently uses `compileToV0Message()` for Phantom compatibility
- Code has `compileToV1Message()` support ready in SDK
- Transaction size validation uses actual serialization
- UI displays transaction version dynamically

### Verification
- Supports legacy, v0, and v1 transactions
- Uses `maxSupportedTransactionVersion: 1` for retrieval
- All 44 tests passing (44/44)

## Files Modified

### Code
- `src/lib/rpc/devnet.ts` - Created Devnet RPC configuration
- `src/lib/rpc/mainnet.ts` - Created Mainnet RPC configuration
- `src/lib/network.ts` - Updated with RPC factory pattern
- `src/hooks/useWallet.ts` - Fixed hydration mismatch
- `src/hooks/useWalletKit.ts` - Updated for network changes
- `src/lib/transactions.ts` - Migrated to Solana Kit RPC
- `src/app/page.tsx` - Migrated to Solana Kit RPC
- `src/lib/solana/transactionCapabilities.ts` - Updated to use getRpcUrl()
- `src/lib/solana/networkCost.ts` - Updated RPC usage

### Documentation
- `README.md` - Updated with RPC architecture and environment configuration
- `ARCHITECTURE.md` - Updated with RPC layer details
- `WALLET.md` - Updated with RPC configuration and error handling
- `SOLANA_KIT_MIGRATION.md` - Updated with completed migration status
- `.env.example` - Updated with Mainnet configuration requirements

## Files Modified (2026-09-06)

### Code
- `src/lib/constants.ts` - Added `HASHDROP_PLATFORM_FEE_LAMPORTS`, `HASHDROP_PLATFORM_FEE_SOL`, `HASHDROP_FEE_WALLET`
- `src/lib/transactions.ts` - Added `SystemProgram.transfer` platform fee instruction
- `src/app/page.tsx` - Fixed confirmation modal double-count
- `src/components/CostSummary.tsx` - Uses shared platform-fee constant
- `src/hooks/useCostEstimate.ts` - Uses shared platform-fee constant
- `src/hooks/usePublish.ts` - Updated dead code to use shared constants and include transfer
- `src/app/icon.svg` - Added production favicon
- `src/styles/globals.css` - Fixed Tailwind v4 preflight
- `src/app/viewer/page.tsx` - Fixed mobile layout (signature box overflow)
- `src/lib/transactions.test.ts` - Added transaction-builder platform-fee tests

## Testing Status

- ✅ All 44 tests passing (including 6 new transaction-builder tests)
- ✅ TypeScript compilation clean
- ✅ Build successful

## Next Steps

### Immediate (Human Required)
- [ ] Install Solana CLI (requires admin rights)
- [ ] Build and deploy Solana program: `cd contracts && cargo build-sbf`
- [ ] Update PROGRAM_ID in `src/lib/constants.ts`
- [ ] Test end-to-end publishing with Phantom wallet on devnet
- [ ] Test Mainnet publishing with Helius RPC

### Future (When Phantom adds v1 support)
- [ ] Update transaction builder to use `compileToV1Message()`
- [ ] Test v1 transactions on Devnet
- [ ] Update UI to display v1 transaction info
- [ ] Verify 4096-byte transaction limit works

## Current Transaction Limits

| Version | Max Size | Effective Content |
|---------|----------|-------------------|
| v0      | 1232 B   | ~800 B (base64)   |
| v1      | 4096 B   | ~2800 B (base64)  |

## Memo Drop Format

```
HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>
```

## Known Issues

1. Phantom wallet does not fully support v1 transaction signing
2. Content limit is ~800 bytes (v0 transaction limit)
3. Devnet deployment pending human approval
4. Mainnet requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` to be configured

## RPC Configuration

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
// Get Solana Kit RPC client for RPC operations
const rpc = createRpc();

// Get web3.js Connection for Phantom compatibility
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