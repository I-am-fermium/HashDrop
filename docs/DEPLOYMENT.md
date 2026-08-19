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

### Required

- `NEXT_PUBLIC_RPC_URL`: Solana RPC endpoint

### Optional

- `NEXT_PUBLIC_PROGRAM_ID`: HashDrop program ID

## Configuration

### Network Endpoints

- Devnet: `https://api.devnet.solana.com`
- Mainnet: `https://api.mainnet-beta.solana.com`

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