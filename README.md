# HashDrop

A decentralized on-chain content publishing application built on Solana.

## Overview

HashDrop is a browser-native decentralized publishing application that follows the core model: **Browser + Wallet + Solana**.

Users can publish small text and source-code assets without creating an account, connect a Solana wallet, see transparent costs, publish bytes into Solana accounts, finalize the record, and later reconstruct and verify the exact same bytes directly from Solana.

**Proof and Private modes also support PHOTO, VIDEO and VOICE (audio) media.**
Public mode remains TEXT ONLY (unchanged). See [docs/MEDIA.md](docs/MEDIA.md)
for the full media architecture.

## Features

- **No accounts**: Publish directly with your Solana wallet
- **Transparent pricing**: See storage and fee costs before signing
- **On-chain storage**: Content is stored directly in Solana transaction memos
- **Cryptographic verification**: Verify content hash matches published data
- **Memo Drop**: For small content, uses SPL Memo program, no storage account needed
- **Media support (Proof/Private)**: Photo (JPEG/PNG/WebP/GIF), Video (MP4/WebM/QuickTime), Voice/audio (WebM/OGG/WAV/MP3/MP4) — hashed from the exact original bytes, kept off-chain
- **Voice recording**: Browser MediaRecorder for Proof/Private voice notes
- **Real platform fee**: 0.001 SOL is transferred on-chain to the HashDrop fee wallet via a `SystemProgram.transfer` instruction inside the publish transaction
- **Production favicon**: App Router `src/app/icon.svg` (red "H" brand mark)

## Publication Method

### Memo Drop

- Best for small content (under 800 bytes)
- Uses Solana's SPL Memo program
- No storage account required
- Lower cost (only protocol fee + network fee)
- Content stored in transaction memo
- Each publish transaction sends the HashDrop platform fee (0.001 SOL) to the HashDrop fee wallet via `SystemProgram.transfer`

**Transaction Limits:**
- **v0 (current)**: 1232 bytes max, ~800 bytes effective content
- **v1 (target)**: 4096 bytes max, ~2800 bytes effective content (pending Phantom wallet support)

## Architecture

### Frontend (TypeScript/React/Next.js)

- **`src/app/`** - Next.js App Router (page.tsx, layout.tsx, viewer.tsx)
- **`src/components/`** - React components (WalletConnect, ContentEditor, PublishButton, CostSummary)
- **`src/hooks/`** - React hooks (useWallet, useCostEstimate)
- **`src/lib/`** - Utilities
  - `content.ts` - Content processing, SHA-256 hashing, HashDrop ID generation
  - `memo.ts` - Memo Drop encoding/decoding
  - `transactions.ts` - Transaction builders
  - `verification.ts` - On-chain verification logic
  - `crypto/` - PRIVATE mode cryptography (AES-256-GCM, ML-KEM-768, HKDF-SHA-256, key manager, encrypted artifact)
  - `signature.ts` - Canonical Solana transaction-signature validation (Base58 → 64 bytes)
  - `download.ts` - Client-side file downloads (Blob/object URL, no server)
  - `constants.ts` - Program IDs, network endpoints, sizes
  - `solana/networkCost.ts` - Network-authoritative cost calculation via RPC
  - `network.ts` - Network configuration and RPC factory
  - `rpc/devnet.ts` - Devnet RPC configuration
  - `rpc/mainnet.ts` - Mainnet RPC configuration

### RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations (getLatestBlockhash, etc.)
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable (e.g., Helius, QuickNode, Alchemy)

**RPC Factory Pattern:**
- `createRpc()` - Returns the appropriate Solana Kit RPC client for the current network
- `createConnection()` - Returns the appropriate web3.js Connection for Phantom compatibility
- Network selection is centralized in `src/lib/network.ts`

### Transaction Format

- **Current**: v0 transactions (1232-byte limit)
- **Target**: v1 transactions (4096-byte limit) when Phantom adds support
- **SDK Support**: ✅ Available (web3.js 1.98.4, Kit 7.1.1)
- **Wallet Support**: ⚠️ Phantom v1 signing pending

## Wallet Integration

Uses direct `window.solana` API for compatibility with Phantom/br wallets.

## Development

### Prerequisites

- Node.js 18+
- Rust 1.60+
- Solana CLI 1.16+

### Setup

```bash
# Clone the repository
cd HashDrop

# Install npm dependencies
npm install

# Build the frontend
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

### Environment Configuration

For Mainnet deployment, create a `.env.local` file:

```bash
# Mainnet RPC URL (REQUIRED for Mainnet)
NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Devnet RPC URL (optional, defaults to Solana Devnet)
NEXT_PUBLIC_SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

**Important:** The application will NOT fall back to the public Solana Mainnet RPC if `NEXT_PUBLIC_SOLANA_MAINNET_RPC` is not configured. You must provide a valid RPC endpoint.

### Project Structure

```
HashDrop/
├── contracts/           # Solana program (Rust)
│   ├── src/
│   │   ├── lib.rs       # Program entry point
│   │   ├── instruction.rs  # Instruction types
│   │   └── state.rs   # Account structures
│   └── Cargo.toml
├── src/               # Frontend (TypeScript/React)
│   ├── app/           # Next.js app router
│   │   ├── icon.svg   # Production favicon
│   │   ├── page.tsx   # Publish page
│   │   └── viewer/    # Retrieve page
│   ├── components/    # React components
│   ├── hooks/         # React hooks
│   ├── lib/           # Utilities and types
│   │   ├── constants.ts # Fee wallet, network endpoints, sizes
│   │   ├── content.ts    # Content engine
│   │   ├── memo.ts       # Memo Drop utilities
│   │   ├── transactions.ts # Transaction builders
│   │   ├── network.ts    # Network configuration
│   │   ├── rpc/          # RPC configuration
│   │   │   ├── devnet.ts # Devnet RPC
│   │   │   └── mainnet.ts # Mainnet RPC
│   │   ├── verification.ts # Verification utilities
│   │   ├── signature.ts    # Transaction-signature validation
│   │   ├── download.ts     # Client-side Blob downloads
│   │   └── crypto/         # PRIVATE mode crypto (aesGcm, mlKem, hkdf, keyManager, encryptedArtifact, keyWrapper, privateDrop)
│   └── styles/      # Tailwind CSS
└── docs/            # Documentation
```

## HashDrop Protocol v3

### PUBLIC Mode (content published on-chain)

```
HASHDROP|v3|PUBLIC|<hashDropId>|<sha256>|<mimeType>|<contentSize>|<base64Content>
```

### PROOF Mode (only cryptographic proof published)

```
HASHDROP|v3|PROOF|<hashDropId>|<sha256>|<contentSize>
```

### PRIVATE Mode (commitment on-chain, encrypted content off-chain)

```
HASHDROP|v3|PRIVATE|<hashDropId>|<sha256>|<contentSize>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<encryptedKeyIv>|<encryptedKey>
```

Private mode uses hybrid encryption:
- **AES-256-GCM** for content encryption
- **ML-KEM-768** (FIPS 203) for post-quantum key protection
- **HKDF-SHA-256** for key derivation

On-chain size: ~255 bytes (fits within current 1232-byte Solana limit)
Serialized transaction: 492 bytes (measured)

The encrypted content artifact is user-controlled/off-chain. After a
successful PRIVATE publish the UI provides client-side downloads of the exact
publish-time artifacts (no server involved):

- `hashdrop-private-<hashDropId>.hdp` — the canonical `HASHDROP-PRIVATE-BLOB|v1|…` envelope
- `hashdrop-mlkem-768-private-key-<keyFingerprint>.txt` — `HASHDROP-KEY|v1|ML-KEM-768|…`
- `hashdrop-mlkem-768-public-key-<keyFingerprint>.txt` — `HASHDROP-PUBKEY|v1|ML-KEM-768|…`

Both files are consumed directly by the Viewer (paste or file import) for
DECRYPT & VERIFY. HashDrop stores neither file — losing them means losing the
content.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Current Status

✅ Build successful
✅ Tests passing (193/193 across 15 suites)
✅ Memo Drop feature complete
✅ Wallet integration working
✅ Real platform fee (0.001 SOL) transferred on-chain to HashDrop fee wallet
✅ v1 SDK support available
✅ Solana Kit RPC migration complete
✅ V3 PUBLIC / PROOF / PRIVATE publish + retrieval complete
✅ PRIVATE publish exports the .hdp artifact + ML-KEM-768 key files client-side
✅ Viewer retrieval verified against real Devnet and Mainnet v0 transactions
⚠️ v1 wallet support pending (Phantom)
⏳ Devnet deployment pending human approval

## Documentation

- [README.md](README.md) - This file
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [TECH_STACK.md](TECH_STACK.md) - Technology stack
- [ROADMAP.md](ROADMAP.md) - Development roadmap
- [TESTING.md](TESTING.md) - Testing strategy
- [SESSION.md](SESSION.md) - Current session state

## License

This project is licensed under the **HashDrop Source-Available Reciprocal License (HSRL-1.0)** — a source-available reciprocal license, **not** an open-source license. See [LICENSE](LICENSE).

Key points:

- Source code is publicly available for inspection, non-commercial use, education, academic research, and security auditing.
- Modification is permitted for non-commercial purposes.
- Distribution of derivatives requires reciprocal source availability (License, Sections 6–8).
- **Commercial use requires a separate written license from HashDrop.**
- HashDrop trademarks and branding are reserved.
- Third-party dependencies and components remain governed by their own licenses.
- The software is provided "AS IS", without warranty of any kind (License, Section 21).

The HSRL-1.0 license text is a **draft for legal review** and has not been reviewed or endorsed by any legal organization.