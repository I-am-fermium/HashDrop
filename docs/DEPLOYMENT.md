# Deployment

## Development

Use localnet/devnet while building the protocol.

## Production gate

Mainnet deployment requires explicit human approval after testing and security review.

## Frontend

The frontend may be hosted as a static web application. Hosting is not the canonical data layer.

### Deployment Options

- **Vercel**: Recommended for Next.js apps
- **Netlify**: Alternative static hosting
- **GitHub Pages**: For simple static sites
- **Custom server**: Any Node.js server

### Build Command

```bash
npm run build
```

### Output Directory

```
.next/server/
.next/static/
```

## Program

Before production:

- verify program ID;
- review authority/upgradeability configuration;
- verify treasury configuration;
- verify fee configuration;
- run end-to-end tests;
- document deployment artifacts.

### Devnet Deployment

1. Build the Solana program:
   ```bash
   cd contracts
   cargo build-sbf
   ```

2. Deploy to devnet:
   ```bash
   solana program deploy target/deploy/hashdrop.so
   ```

3. Update PROGRAM_ID in `src/lib/constants.ts`

4. Test end-to-end publishing

### Mainnet Deployment

Requires:

- Program review
- Authority review
- Deployment verification
- Fee configuration review
- Upgradeability/immutability review
- Rollback/incident plan

## Environment Variables

### Required for Mainnet

Create a `.env.local` file in the project root:

```bash
# Mainnet RPC URL (REQUIRED for Mainnet)
NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Devnet RPC URL (optional, defaults to Solana Devnet)
NEXT_PUBLIC_SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

**Important:** The application will NOT fall back to the public Solana Mainnet RPC if `NEXT_PUBLIC_SOLANA_MAINNET_RPC` is not configured. You must provide a valid RPC endpoint.

### Optional

- `NEXT_PUBLIC_PROGRAM_ID`: HashDrop program ID

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

### Network Endpoints

- Devnet: `https://api.devnet.solana.com` (default)
- Mainnet: `NEXT_PUBLIC_SOLANA_MAINNET_RPC` (required)

### Program IDs

- Memo Program: `Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH`
- HashDrop Program: Configured in `src/lib/constants.ts`

## Monitoring

- Transaction success rate
- Error rates
- Network latency
- Wallet connection success rate

## Rollback Plan

In case of issues:

1. Identify affected transactions
2. Document the issue
3. Notify users
4. Deploy fix if needed
5. Update documentation

## Security Notes

- Never commit `.env.local` to version control
- Use a reputable RPC provider for Mainnet (Helius, QuickNode, Alchemy)
- Monitor your API key usage
- Rotate keys if compromised