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
4. Select a publish method:
   - **Memo Drop** for small content (< 1KB) - no storage account needed
   - **Storage Drop** for larger content - creates on-chain storage accounts
5. Click **Publish**
6. A confirmation dialog will show:
   - Method selected
   - Content size
   - Protocol Fee
   - Storage Funding (for Storage Drop)
   - Network Fee
   - Total cost
7. Click **Confirm & Sign** to sign the transaction in Phantom
8. Wait for the transaction to complete

## Step 5: Verify Publication

After publishing:
- Check the transaction signature in the UI
- View on Solana Explorer: https://explorer.solana.com/?tx=<signature>&cluster=devnet

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

## Expected Costs

### Memo Drop
- Protocol Fee: 0.001 SOL
- Network Fee: ~0.000005 SOL
- **Total: ~0.001005 SOL**

### Storage Drop (for 1KB content)
- Protocol Fee: 0.001 SOL
- Storage Funding: ~0.0018 SOL (for metadata + 1 chunk account)
- Network Fee: ~0.000005 SOL
- **Total: ~0.002805 SOL**

## Content Size Limits

- **Memo Drop**: Content must fit in a single Solana transaction memo (< 800 bytes recommended)
- **Storage Drop**: Up to 10KB per drop, automatically chunked into 890-byte pieces