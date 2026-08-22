# Technology Stack

## Frontend

### Core
- **Next.js**: 16.3.1 (App Router, React Server Components)
- **React**: 19.2.8
- **TypeScript**: 7.0.2
- **Node.js**: 18+

### Styling
- **Tailwind CSS**: 4.3.3
- **PostCSS**: 8.4.31
- **Autoprefixer**: 10.4.20

### Solana Integration
- **@solana/web3.js**: 1.98.4
- **@solana/kit**: 7.1.1
- **@solana/react**: 7.1.1
- **@solana/kit-plugin-wallet**: 0.14.0
- **@solana-program/memo**: 0.12.0
- **@solana/wallet-adapter-base**: 0.9.27
- **@solana/wallet-adapter-react**: 0.15.39
- **@solana/wallet-adapter-react-ui**: 0.9.39
- **@solana/wallet-adapter-wallets**: 0.19.38

### Utilities
- **bs58**: Base58 encoding/decoding
- **jest**: 30.4.1 (testing)
- **jest-environment-jsdom**: 30.4.1

## Blockchain

- **Solana**: Main blockchain platform
- **SPL Memo Program**: `Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH`
- **Wallet Standard**: Phantom, Brave wallet integration via `window.solana`

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

### Network Configuration
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

### RPC Factory Pattern
- `createRpc()` - Returns the appropriate Solana Kit RPC client
- `createConnection()` - Returns the appropriate web3.js Connection for Phantom

## Transaction Support

| Version | Max Size | SDK Support | Wallet Support |
|---------|----------|-------------|----------------|
| legacy  | 1232 B   | ✅          | ✅             |
| v0      | 1232 B   | ✅          | ✅ (Phantom)   |
| v1      | 4096 B   | ✅          | ⚠️ (Pending)   |

## Browser APIs

- **Web Crypto API**: SHA-256 hashing
- **TextEncoder/TextDecoder**: UTF-8 encoding
- **window.solana**: Wallet integration

## Development

- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Test**: `npm test`
- **Lint**: `npm run lint`

## Deployment

- **Frontend**: Static hosting (Vercel, Netlify, etc.)
- **Program**: Solana Devnet/Mainnet (human-approved deployment)

## Environment Configuration

For Mainnet deployment, create a `.env.local` file:

```bash
# Mainnet RPC URL (REQUIRED for Mainnet)
NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Devnet RPC URL (optional, defaults to Solana Devnet)
NEXT_PUBLIC_SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

**Important:** The application will NOT fall back to the public Solana Mainnet RPC if `NEXT_PUBLIC_SOLANA_MAINNET_RPC` is not configured. You must provide a valid RPC endpoint.