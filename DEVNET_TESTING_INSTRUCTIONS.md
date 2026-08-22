# Devnet Testing Instructions

## Prerequisites
- You have 5 SOL in your WSL Solana devnet account
- Solana CLI is installed in WSL

## Step 1: Build and Deploy Solana Program

Open WSL terminal and run:

```bash
# Navigate to the contracts directory
cd /mnt/d/VSCode/HashDrop/contracts

# Build the Solana program
cargo build-sbf

# Deploy to devnet
solana program deploy target/deploy/hashdrop.so
```

## Step 2: Update PROGRAM_ID

After deployment, you'll get a program ID. Update it in `src/lib/constants.ts`:

```typescript
export const PROGRAM_ID = 'YOUR_NEW_PROGRAM_ID_HERE';
```

## Step 3: Start the Development Server

In a new terminal (PowerShell or WSL):

```bash
cd d:\VSCode\HashDrop
npm run dev
```

## Step 4: Test the Application

1. Open http://localhost:3000 in your browser
2. Connect your Phantom wallet (make sure it's set to devnet)
3. Enter content in the editor
4. Click **Publish**
5. A confirmation dialog will show:
   - Method: HashDrop Memo Drop
   - Content size
   - Protocol Fee: 0.001 SOL
   - Network Fee: ~0.000005 SOL
   - Total cost: ~0.001005 SOL
   - Transaction version: v0 (1232-byte limit)
6. Click **Confirm & Sign** to sign the transaction in Phantom
7. Wait for the transaction to complete

## Step 5: Verify Publication

After publishing:
- Check the transaction signature in the UI
- View on Solana Explorer: https://explorer.solana.com/?tx=<signature>&cluster=devnet

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Devnet RPC Configuration:**
- Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- No API key required
- No environment variable needed

## Transaction Version Notes

### Current Implementation (v0)
- **Max Transaction Size**: 1232 bytes
- **Effective Content**: ~800 bytes (after base64 encoding)
- **Wallet Support**: Phantom, Brave

### Target Implementation (v1)
- **Max Transaction Size**: 4096 bytes
- **Effective Content**: ~2800 bytes (after base64 encoding)
- **Wallet Support**: Pending Phantom v1 signing support

## Expected Costs

### Memo Drop
- Protocol Fee: 0.001 SOL
- Network Fee: ~0.000005 SOL
- **Total: ~0.001005 SOL**

## Content Size Limits

### Memo Drop (Current - v0)
- **Max Transaction Size**: 1232 bytes
- **Effective Content**: ~800 bytes (after base64 encoding)
- **Recommendation**: Keep content under 700 bytes for safety

### Memo Drop (Target - v1)
- **Max Transaction Size**: 4096 bytes
- **Effective Content**: ~2800 bytes (after base64 encoding)
- **Status**: Ready when Phantom adds v1 support

## Troubleshooting

### "Insufficient funds for rent-exempt balance"
- Get more devnet SOL: `solana airdrop 2`

### "Transaction failed"
- Check wallet has enough SOL
- Verify network is set to devnet in Phantom wallet
- Check transaction details in Solana Explorer

### Program not found
- Make sure you updated the PROGRAM_ID in constants.ts
- Restart the dev server after updating

### "signTransaction is not a function"
- Ensure you're using the latest Phantom wallet
- The app uses `window.solana.signTransaction()` for v0 transactions

## Testing Content Sizes

Test with various content sizes:
- 100 bytes - Should publish
- 500 bytes - Should publish
- 800 bytes - Should publish (near v0 limit)
- 1000 bytes - Should fail (exceeds v0 limit)

## Verification

After publishing:
1. Copy the transaction signature
2. Go to https://explorer.solana.com/?tx=<signature>&cluster=devnet
3. Find the Memo instruction in the transaction
4. Verify the content matches what you published