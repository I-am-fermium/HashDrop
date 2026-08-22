# Build Instructions

## Current Status

**Phase 6 Complete**: RPC Migration to Solana Kit finished

## Prerequisites

- Node.js 18+
- npm 9+
- Solana CLI (for program deployment)

## Build Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## Build Output

```
.next/
├── server/
├── static/
└── cache/
```

## Current Build Status

✅ Build successful
✅ Tests passing (30/30)
✅ TypeScript compilation clean
✅ ESLint passing

## Environment Configuration

### Required for Mainnet

Create a `.env.local` file in the project root:

```bash
# Mainnet RPC URL (REQUIRED for Mainnet)
NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Devnet RPC URL (optional, defaults to Solana Devnet)
NEXT_PUBLIC_SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

**Important:** The application will NOT fall back to the public Solana Mainnet RPC if `NEXT_PUBLIC_SOLANA_MAINNET_RPC` is not configured. You must provide a valid RPC endpoint.

### RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**RPC Factory Pattern:**
- `createRpc()` - Returns the appropriate Solana Kit RPC client
- `createConnection()` - Returns the appropriate web3.js Connection for Phantom

## Deployment

### Frontend

The frontend is a static Next.js application that can be deployed to:

- Vercel (recommended)
- Netlify
- AWS S3 + CloudFront
- Any static hosting provider

### Solana Program

The Solana program requires:

1. Solana CLI installed
2. Rust toolchain
3. Build with `cargo build-sbf`
4. Deploy with `solana program deploy`

## Current Transaction Limits

| Version | Max Size | Effective Content |
|---------|----------|-------------------|
| v0      | 1232 B   | ~800 B (base64)   |
| v1      | 4096 B   | ~2800 B (base64)  |

## Next Steps

1. Install Solana CLI
2. Build and deploy Solana program
3. Update PROGRAM_ID in constants.ts
4. Test end-to-end publishing on devnet
5. Test Mainnet publishing with Helius RPC