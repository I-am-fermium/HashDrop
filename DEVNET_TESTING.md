# Devnet Testing Guide

## Prerequisites
- Solana CLI installed
- Phantom wallet (or other Solana wallet)
- At least 0.01 SOL for deployment fees

## Step 1: Install Solana CLI

### Windows (PowerShell as Administrator)
```powershell
curl -sSfL https://release.anza.xyz/stable/install -o install.ps1
.\install.ps1
```

### WSL (Ubuntu)
```bash
curl -sSfL https://release.anza.xyz/stable/install | sh
```

After installation, restart your terminal and add to PATH:
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

## Step 2: Configure Devnet
```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2
```

## Step 3: Build and Deploy Solana Program
```bash
cd d:\VSCode\HashDrop\contracts
cargo build-sbf
solana program deploy target/deploy/hashdrop.so
```

## Step 4: Update Program ID
Copy the program ID from the deployment output and update `src/lib/constants.ts`:
```typescript
export const PROGRAM_ID = 'YOUR_PROGRAM_ID_HERE';
```

## Step 5: Test the Application
1. Start the development server:
   ```bash
   cd d:\VSCode\HashDrop
   npm run dev
   ```

2. Open http://localhost:3000 in your browser

3. Connect your Phantom wallet

4. Enter content and select:
   - **Memo Drop** for small content (< 1KB)
   - **Storage Drop** for larger content

5. Click Publish and sign the transaction in Phantom

## Step 6: Verify Publication
- Check the transaction signature in the UI
- View on Solana Explorer: https://explorer.solana.com/?tx=<signature>&cluster=devnet

## Troubleshooting

### "Command not found: solana"
- Restart your terminal after installation
- Ensure PATH is set correctly: `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"`

### "Insufficient funds for rent-exempt balance"
- Get more devnet SOL: `solana airdrop 2`

### "Transaction failed"
- Check wallet has enough SOL
- Verify network is set to devnet
- Check transaction details in Solana Explorer

## Memo Drop Testing

### Test Cases
1. **Small text content** - Should use Memo Drop
2. **Unicode content** (emoji, Chinese characters) - Should work correctly
3. **Large content** - Should recommend Storage Drop
4. **Empty content** - Should handle gracefully

### Verification
- Memo Drop: Verify by fetching transaction and checking memo instruction
- Storage Drop: Verify by fetching account data and reconstructing content