# HashDrop Development Tasks

## Completed Tasks

- [x] Install @types/jest for TypeScript test support
- [x] Fix wallet signing - use window.solana direct API (avoid SSR issues)
- [x] Update useWallet hook to export getConnection
- [x] Update layout.tsx - removed problematic WalletProvider (SSR issue with v0.6.0)
- [x] Fix TypeScript errors in test files
- [x] Build and verify - all builds pass
- [x] Run tests - all 30 tests pass
- [x] Create ESLint configuration (.eslintrc.json)
- [x] Update SESSION.md with current status
- [x] Update README.md with comprehensive documentation
- [x] Analyze Solana v1 readiness - SDK supports v1, wallet support pending
- [x] Update all documentation files to reflect current project state
- [x] Create RPC configuration files (devnet.ts, mainnet.ts)
- [x] Update useWalletKit.ts to handle network changes
- [x] Fix transactionCapabilities.ts to use getRpcUrl()
- [x] Fix networkCost.ts to remove unused hardcoded RPCs
- [x] Add improved error handling and logging
- [x] Update .env.example with clear instructions
- [x] Run build and verify no TypeScript errors
- [x] Fix hydration error with mounted state
- [x] Improve RPC 403 error handling in page.tsx
- [x] Migrate transactions.ts to use Solana Kit RPC
- [x] Update page.tsx to use Solana Kit RPC
- [x] Update all .md documentation files

## Architecture Summary

### Frontend (TypeScript/React/Next.js)
- `src/app/` - Next.js app router (page.tsx, layout.tsx, viewer.tsx)
- `src/components/` - React components (WalletConnect, ContentEditor, PublishButton, CostSummary)
- `src/hooks/` - React hooks (useWallet, useCostEstimate, usePublish)
- `src/lib/` - Utilities and types
  - `content.ts` - Content processing, SHA-256 hashing, HashDrop ID generation
  - `memo.ts` - Memo Drop encoding/decoding
  - `transactions.ts` - Transaction builders
  - `verification.ts` - On-chain verification logic
  - `constants.ts` - Program IDs, network endpoints, sizes
  - `solana/networkCost.ts` - Network-authoritative cost calculation via RPC
  - `network.ts` - Network configuration and RPC factory
  - `rpc/devnet.ts` - Devnet RPC configuration
  - `rpc/mainnet.ts` - Mainnet RPC configuration

### RPC Architecture

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

### Transaction Version Support

| Version | SDK Support | Wallet Support | Status |
|---------|-------------|----------------|--------|
| legacy  | ✅          | ✅             | ✅ Working |
| v0      | ✅          | ✅ (Phantom)   | ✅ Working |
| v1      | ✅          | ⚠️ (Pending)   | ⏳ Ready |

## Key Technical Decisions

1. **Wallet Integration**: Using direct `window.solana` API instead of `@solana/wallet-adapter-react` because v0.6.0 has SSR issues with Next.js.

2. **RPC Architecture**: Hybrid approach with Solana Kit as primary RPC layer and web3.js only for Phantom compatibility.

3. **Network Configuration**: 
   - Devnet: Uses default Solana Devnet RPC
   - Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

4. **Dual Publication Methods**:
   - Memo Drop: For content < 800 bytes, stores in transaction memo
   - Storage Drop: For content >= 1KB, stores in on-chain accounts

5. **Network Costs**: Calculated using RPC calls for authoritative rent exemption values (6960 lamports/byte on Solana)

6. **Transaction Version**: Currently using v0 transactions (1232-byte limit) due to Phantom wallet v1 signing limitations

## Testing

Run `npm test` to execute Jest tests for content engine and memo utilities.

**Test Results:** 30/30 tests passing

## Configuration

- ESLint: Configured in `.eslintrc.json`
- TypeScript: Compiles without errors
- Jest: Jest 30.4.1 with 30 tests

## Current Status

✅ Build successful
✅ Tests passing (30/30)
✅ TypeScript compilation clean
✅ Memo Drop feature complete
✅ Wallet integration working
✅ v1 SDK support available
✅ Solana Kit RPC migration complete
⚠️ v1 wallet support pending (Phantom)
⏳ Devnet deployment pending human approval

## Next Steps (Devnet Deployment)

1. Install Solana CLI (requires admin rights)
2. Build and deploy Solana program: `cd contracts && cargo build-sbf`
3. Update PROGRAM_ID in `src/lib/constants.ts`
4. Test end-to-end publishing with Phantom wallet

## Memo Drop Format

```
HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>
```

## Transaction Limits

| Version | Max Size | Effective Content |
|---------|----------|-------------------|
| v0      | 1232 B   | ~800 B (base64)   |
| v1      | 4096 B   | ~2800 B (base64)  |

## Environment Configuration

For Mainnet deployment, create a `.env.local` file:

```bash
# Mainnet RPC URL (REQUIRED for Mainnet)
NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Devnet RPC URL (optional, defaults to Solana Devnet)
NEXT_PUBLIC_SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

**Important:** The application will NOT fall back to the public Solana Mainnet RPC if `NEXT_PUBLIC_SOLANA_MAINNET_RPC` is not configured. You must provide a valid RPC endpoint.