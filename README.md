# HashDrop

A decentralized on-chain content publishing application built on Solana.

## Overview

HashDrop is a browser-native decentralized publishing application that follows the core model: **Browser + Wallet + Solana**.

Users can publish small text and source-code assets without creating an account, connect a Solana wallet, see transparent costs, publish bytes into Solana accounts, finalize the record, and later reconstruct and verify the exact same bytes directly from Solana.

## Features

- **No accounts**: Publish directly with your Solana wallet
- **Transparent pricing**: See storage and fee costs before signing
- **On-chain storage**: Content is stored directly on Solana
- **Cryptographic verification**: Verify content hash matches published data
- **Dual publication methods**:
  - **Memo Drop**: For small content (< 1KB), uses SPL Memo program, no storage account needed
  - **Storage Drop**: For larger content, uses account-backed storage

## Publication Methods

### Memo Drop

- Best for small content (under 1KB)
- Uses Solana's SPL Memo program
- No storage account required
- Lower cost (only protocol fee + network fee)
- Content stored in transaction memo

### Storage Drop

- Best for larger content (1KB+)
- Uses HashDrop on-chain storage accounts
- Requires rent-funded storage accounts
- Higher cost (protocol fee + storage rent + network fee)
- Content stored in chunk accounts

## Architecture

### Frontend (TypeScript/React/Next.js)

- **`src/app/`** - Next.js App Router (page.tsx, layout.tsx, viewer.tsx)
- **`src/components/`** - React components (WalletConnect, ContentEditor, PublishButton, CostSummary)
- **`src/hooks/`** - React hooks (useWallet, useCostEstimate, usePublish)
- **`src/lib/`** - Utilities
  - `content.ts` - Content processing, SHA-256 hashing, HashDrop ID generation
  - `memo.ts` - Memo Drop encoding/decoding
  - `transactions.ts` - Transaction builders for Storage and Memo Drop
  - `verification.ts` - On-chain verification logic
  - `constants.ts` - Program IDs, network endpoints, sizes
  - `solana/networkCost.ts` - Network-authoritative cost calculation via RPC

### Smart Contract (Rust/Solana)

- `contracts/src/lib.rs` - Program entry point with instruction routing
- `contracts/src/instruction.rs` - Binary serialization for instructions
- `contracts/src/state.rs` - Account structures (MetadataAccount: 1101 bytes, ChunkAccount: variable)

## Wallet Integration

Uses direct `window.solana` API for compatibility with Phantom/br wallets, bypassing `@solana/wallet-adapter-react` which has SSR issues with Next.js.

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
│   ├── components/  # React components
│   ├── hooks/         # React hooks
│   ├── lib/           # Utilities and types
│   │   ├── content.ts    # Content engine
│   │   ├── memo.ts       # Memo Drop utilities
│   │   ├── transactions.ts # Transaction builders
│   │   └── verification.ts # Verification utilities
│   └── styles/      # Tailwind CSS
└── docs/            # Documentation
```

## Protocol

The HashDrop protocol supports:
- `create_drop` - Initialize a new publication
- `write_chunk` - Write content chunks
- `finalize_drop` - Finalize and seal the publication
- `verify_drop` - Verify publication integrity

## V1 Scope

- Plain text and source code assets
- Maximum 10KB content size
- SHA-256 content hashing
- Deterministic HashDrop ID generation
- Memo Drop for small content
- Storage Drop for larger content

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Configuration

### Network Endpoints

- Devnet: `https://api.devnet.solana.com`
- Mainnet: `https://api.mainnet-beta.solana.com`

### Program IDs

- HashDrop Program: Configured in `src/lib/constants.ts`
- SPL Memo Program: `Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH`

## Current Status

✅ Build successful
✅ Tests passing (30/30)
✅ Memo Drop feature complete
✅ Storage Drop feature complete
✅ Wallet integration working

## License

This project is open source and provided as-is for educational and development purposes.