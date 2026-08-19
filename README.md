# HashDrop

A decentralized on-chain content publishing application built on Solana.

## Overview

HashDrop is a browser-native decentralized publishing application that follows the core model: **Browser + Wallet + Solana**.

Users can publish small text and source-code assets without creating an account, connect a Solana wallet, see transparent costs, publish bytes into Solana accounts, finalize the record, and later reconstruct and verify the exact same bytes directly from Solana.

## Features

- **No accounts**: Publish directly with your Solana wallet
- **Transparent pricing**: See storage and fee costs before signing
- **On-chain storage**: Content is stored directly in Solana transaction memos
- **Cryptographic verification**: Verify content hash matches published data
- **Memo Drop**: For small content, uses SPL Memo program, no storage account needed

## Publication Method

### Memo Drop

- Best for small content (under 800 bytes)
- Uses Solana's SPL Memo program
- No storage account required
- Lower cost (only protocol fee + network fee)
- Content stored in transaction memo

**Transaction Limits:**
- **v0 (current)**: 1232 bytes max, ~800 bytes effective content
- **v1 (target)**: 4096 bytes max, ~2800 bytes effective content (pending Phantom wallet support)

## Architecture

### Frontend (TypeScript/React/Next.js)

- **`src/app/`** - Next.js App Router (page.tsx, layout.tsx, viewer.tsx)
- **`src/components/`** - React components (WalletConnect, ContentEditor, PublishButton, CostSummary)
- **`src/hooks/`** - React hooks (useWallet, useCostEstimate, usePublish)
- **`src/lib/`** - Utilities
  - `content.ts` - Content processing, SHA-256 hashing, HashDrop ID generation
  - `memo.ts` - Memo Drop encoding/decoding
  - `transactions.ts` - Transaction builders
  - `verification.ts` - On-chain verification logic
  - `constants.ts` - Program IDs, network endpoints, sizes
  - `solana/networkCost.ts` - Network-authoritative cost calculation via RPC

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
│   ├── components/    # React components
│   ├── hooks/         # React hooks
│   ├── lib/           # Utilities and types
│   │   ├── content.ts    # Content engine
│   │   ├── memo.ts       # Memo Drop utilities
│   │   ├── transactions.ts # Transaction builders
│   │   └── verification.ts # Verification utilities
│   └── styles/      # Tailwind CSS
└── docs/            # Documentation
```

## Memo Drop Format

```
HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>
```

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
✅ Tests passing (30/30)
✅ Memo Drop feature complete
✅ Wallet integration working
✅ v1 SDK support available
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

This project is open source and provided as-is for educational and development purposes.