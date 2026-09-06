# Changelog

All notable project changes are recorded here.

## Unreleased

### Added
- **V3 PRIVATE publish recovery exports**: after a successful PRIVATE publication the UI shows a dedicated "🔐 Private Drop Published" section with client-side Blob downloads of the exact publish-time artifacts — `hashdrop-private-<hashDropId>.hdp` (canonical `HASHDROP-PRIVATE-BLOB|v1|…` envelope, `application/octet-stream`), `hashdrop-mlkem-768-private-key-<keyFingerprint>.txt` (`HASHDROP-KEY|v1|ML-KEM-768|…`) and optionally `hashdrop-mlkem-768-public-key-<keyFingerprint>.txt` (`HASHDROP-PUBKEY|v1|ML-KEM-768|…`). Implemented in `src/app/page.tsx` with the new `src/lib/download.ts` helper — no backend, no external storage; the secret key is never rendered or logged.
- **V3 Viewer result UI** (`src/app/viewer/page.tsx`): mode-specific PUBLIC / PROOF / PRIVATE result sections render after retrieval. The PRIVATE commitment (HashDrop ID, SHA-256, content size, MIME type, HD-P1, key fingerprint, Transaction Signature) is displayed immediately after retrieval — before any decryption attempt — together with Encrypted Artifact / ML-KEM-768 Private Key inputs (paste + file import) and the DECRYPT & VERIFY flow ending in a DECRYPTED/VERIFIED panel.
- **Canonical transaction-signature validation** (`src/lib/signature.ts`): `normalizeTransactionSignature()` — trim → Base58 decode → require exactly 64 bytes. Network-independent; used by all Viewer retrieval handlers and Explorer links (`src/app/viewer/page.tsx`).
- **Client-side download helper** `src/lib/download.ts` (`downloadTextFile()` via Blob + object URL; no network requests).
- **Real HashDrop platform-fee transfer**: publish transactions now include a `SystemProgram.transfer` instruction that sends 0.001 SOL (1,000,000 lamports) from the user's wallet to the HashDrop fee wallet (`Amy4Tej83vsnCdFbBtfWmQrEdRLVF4AVAvZupyka8qQT`).
- Shared platform-fee constants in `src/lib/constants.ts`: `HASHDROP_PLATFORM_FEE_LAMPORTS`, `HASHDROP_PLATFORM_FEE_SOL`, `HASHDROP_FEE_WALLET` (single source of truth; old `PROTOCOL_FEE` placeholder removed).
- Transaction-builder test suite `src/lib/transactions.test.ts` verifying the fee transfer, memo instruction, v0 version, single signer, and absence of ComputeBudget priority fees.
- Production favicon `src/app/icon.svg` — red "H" on a dark rounded square, served automatically via the App Router file-based icon convention.

### Changed
- Viewer "Import Artifact File" input now accepts HashDrop's own downloaded artifacts: `accept=".hdp,.txt,.json,application/octet-stream,text/plain"` (previously `.txt,.json`, which greyed out `.hdp` files in the file picker).
- Accurate PRIVATE mode copy: the transaction stores the cryptographic commitment and encrypted key envelope on-chain; the encrypted content stays in the local `.hdp` artifact the user must save (replaces the outdated "requires the 4096-byte transaction format" note).
- `buildV1Transaction()` in `src/lib/transactions.ts` now packages the platform-fee transfer as the **first** instruction, followed by the SPL Memo instruction. Transaction still compiles via `compileToV0Message()` (v0).
- `CostSummary.tsx` and `useCostEstimate.ts` now derive the displayed platform fee from the shared `HASHDROP_PLATFORM_FEE_*` constants.

### Fixed
- **v0 transaction retrieval in `verifyPrivateDrop()` / `verifyProofDrop()`** (`src/lib/verification.ts`): the memo-extraction step now reads `message.instructions || message.compiledInstructions` and `message.accountKeys || message.staticAccountKeys`. Real Devnet/Mainnet v0 RPC responses expose only `compiledInstructions`/`staticAccountKeys`, which previously triggered the misleading "No instructions found in transaction." during DECRYPT & VERIFY. Verified live against real Devnet and Mainnet transactions.
- **Viewer signature validation rejected valid 87-character Mainnet signatures** (`signature.length < 88`). Replaced with canonical Base58 validation decoding to exactly 64 bytes (`src/lib/signature.ts`); verified live on Mainnet.
- `keyManager.validateKeyPair()` always returned `false`: it array-destructured the `{ ciphertext, sharedSecret }` object returned by `encapsulate()`.
- Viewer error section now renders whenever an error exists — input-validation errors (e.g. malformed signature) were previously invisible because the section was gated on `status === 'FAILED'`.
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
✅ Tests passing (193/193 across 15 suites)
✅ Memo Drop feature complete
✅ Wallet integration working
✅ Real platform fee (0.001 SOL) transferred on-chain to HashDrop fee wallet
✅ Production favicon (src/app/icon.svg)
✅ v1 SDK support available
✅ Solana Kit RPC migration complete
✅ V3 PUBLIC / PROOF / PRIVATE publish + retrieval complete
✅ PRIVATE publish exports the .hdp artifact + ML-KEM-768 key files client-side
✅ Viewer retrieval verified against real Devnet and Mainnet v0 transactions
⚠️ v1 wallet support pending (Phantom)
⏳ Devnet deployment pending human approval