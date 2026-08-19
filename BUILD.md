# Build Instructions

## Current Status

**Phase 5 Complete**: Memo Drop implementation finished

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

## Environment Variables

### Required

- `NEXT_PUBLIC_RPC_URL`: Solana RPC endpoint (default: https://api.devnet.solana.com)

### Optional

- `NEXT_PUBLIC_PROGRAM_ID`: HashDrop program ID

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