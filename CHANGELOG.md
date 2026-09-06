# Changelog

All notable project changes are recorded here.

## Unreleased

### Added
- **Real HashDrop platform-fee transfer**: publish transactions now include a `SystemProgram.transfer` instruction that sends 0.001 SOL (1,000,000 lamports) from the user's wallet to the HashDrop fee wallet (`Amy4Tej83vsnCdFbBtfWmQrEdRLVF4AVAvZupyka8qQT`).
- Shared platform-fee constants in `src/lib/constants.ts`: `HASHDROP_PLATFORM_FEE_LAMPORTS`, `HASHDROP_PLATFORM_FEE_SOL`, `HASHDROP_FEE_WALLET` (single source of truth; old `PROTOCOL_FEE` placeholder removed).
- Transaction-builder test suite `src/lib/transactions.test.ts` verifying the fee transfer, memo instruction, v0 version, single signer, and absence of ComputeBudget priority fees.
- Production favicon `src/app/icon.svg` — red "H" on a dark rounded square, served automatically via the App Router file-based icon convention.

### Changed
- `buildV1Transaction()` in `src/lib/transactions.ts` now packages the platform-fee transfer as the **first** instruction, followed by the SPL Memo instruction. Transaction still compiles via `compileToV0Message()` (v0).
- `CostSummary.tsx` and `useCostEstimate.ts` now derive the displayed platform fee from the shared `HASHDROP_PLATFORM_FEE_*` constants.

### Fixed
- Confirmation-modal cost double-counting: `getDisplayCost()` in `src/app/page.tsx` no longer adds the base network fee a second time (estimated total is now 0.001005 SOL instead of 0.001010 SOL).

## Phase 0 - Foundation (2026-08-12)

### Added
- Next.js 16.3.1 project structure with React 19.2.8 and TypeScript 7.0.2
- Content engine with:
  - SHA-256 hashing using Web Crypto API
  - Content type detection (JavaScript, TypeScript, HTML, CSS, JSON, Markdown)
  - HashDrop ID generation algorithm
  - UTF-8 byte encoding and counting utilities
- Tailwind CSS 4 configuration with black/white/red design system
- Solana transaction helper utilities:
  - Memo Drop transaction building (v0 format)
  - Transaction size calculation and validation
  - Transaction capability detection
- Jest testing configuration with 30 tests
- Content engine unit tests
- Memo module tests
- Verification module tests

### Changed
- Updated TODO.md to reflect completed Phase 0 tasks

## Phase 1 - Static UI (2026-08-13)

### Added
- HashDrop brand shell with terminal-inspired design
- Create/drop editor with content input and size display
- HashDrop ID display area
- Cost summary placeholder
- Wallet connection UI
- Publish flow with confirmation modal
- Viewer mock for content retrieval

## Phase 2 - Local Content Engine (2026-08-14)

### Added
- Browser byte counting using TextEncoder
- Cryptographic hashing using Web Crypto API
- Content type detection for multiple formats
- HashDrop ID generation from hash, creator, and size
- Local verification utilities

## Phase 3 - Wallet Integration (2026-08-15)

### Added
- Phantom/Brave wallet connection via window.solana API
- Wallet disconnect functionality
- Transaction signing support
- Network selection (devnet/mainnet)
- Transaction approval UI with error handling

### Fixed
- Wallet disconnect issue - properly clears state and localStorage
- Transaction signing - added support for Phantom's signTransaction method
- Publish method selection - radio buttons now work correctly
- Tailwind CSS class issues (replaced `text-background` with `text-white`)

## Phase 4 - Memo Drop (2026-08-16)

### Added
- Memo Drop publishing using SPL Memo program
- V2 memo payload format: `HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>`
- Dynamic transaction size validation
- Transaction version detection (legacy/v0/v1)
- Content size limits based on transaction version

### Technical Notes
- V1 SDK support: Available (compileToV1Message in web3.js 1.98.4)
- V1 wallet support: Phantom does NOT fully support v1 transaction signing
- Current implementation: v0 transactions (1232-byte limit)
- Target implementation: v1 transactions (4096-byte limit) when wallet supports it

## Phase 5 - Testing & Verification (2026-08-17)

### Added
- All 30 tests passing
- Legacy transaction verification (verified)
- v0 transaction verification (verified)
- v1 transaction retrieval support (ready)

### Tests Performed
- Content engine tests (stringToBytes, calculateHash, detectContentType, generateHashDropId, processContent)
- Memo module tests (encodeMemoPayload, decodeMemoPayload, canFitInMemo, calculateTransactionSize)
- Verification tests (verifyMemoDrop, verifyBySignature)

## Phase 6 - RPC Migration (2026-08-22)

### Added
- RPC factory pattern with `createRpc()` and `createConnection()` functions
- Network-specific RPC configuration in `src/lib/rpc/`
- Solana Kit as primary RPC layer for all RPC operations
- Diagnostic logging for RPC operations

### Changed
- `getLatestBlockhash()` now uses Solana Kit RPC instead of web3.js Connection
- Mainnet RPC configuration now requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` to be set
- Network state initialization fixed to prevent hydration mismatch

### Fixed
- Mainnet RPC 403 error - now requires explicit RPC configuration
- Hydration mismatch in network state - initializes to 'devnet' for SSR compatibility
- RPC layer now properly separated from wallet signing layer

## Current Status

✅ Build successful
✅ Tests passing (44/44)
✅ Memo Drop feature complete
✅ Wallet integration working
✅ Real platform fee (0.001 SOL) transferred on-chain to HashDrop fee wallet
✅ Production favicon (src/app/icon.svg)
✅ v1 SDK support available
✅ Solana Kit RPC migration complete
⚠️ v1 wallet support pending (Phantom)
⏳ Devnet deployment pending human approval