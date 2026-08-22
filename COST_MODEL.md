# HashDrop Cost Model

## Overview

HashDrop is now a Memo-only, zero-backend protocol. Content is published using Solana transactions with the SPL Memo program.

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

## Visible Payments

HashDrop displays the following costs:

### HashDrop Protocol Fee

A fee paid to the HashDrop treasury according to the published protocol policy.

### Solana Network Fee

The network transaction fee required by Solana for processing the transaction.

## Before Signing

The browser must calculate or obtain enough information to show:

- Content size in bytes
- Estimated Solana network fee
- HashDrop protocol fee
- Total expected wallet spend

## Accuracy

The implementation uses network-authoritative pricing from Solana RPC for fee estimation.

## Fee Policy

The protocol fee configuration should be explicit and easy to inspect in the code and documentation.

Do not hide protocol fees inside vague transaction-cost language.

## UX

The user should see the final estimated total before approving the transaction.

Errors caused by changed network conditions should be explained rather than silently substituting a stale estimate.

## Memo Drop Cost

For Memo Drop publications:

```text
HashDrop Protocol Fee
+
Solana Network Fee
```

No storage funding is required for Memo Drop publications.

## Transaction Version Costs

### v0 Transactions (Current)
- Protocol Fee: 0.001 SOL
- Network Fee: ~0.000005 SOL
- **Total: ~0.001005 SOL**

### v1 Transactions (Target)
- Protocol Fee: 0.001 SOL
- Network Fee: ~0.000005 SOL
- **Total: ~0.001005 SOL**

## Cost Calculation

The cost is calculated as:

```typescript
const PROTOCOL_FEE_SOL = 0.001;
const NETWORK_FEE_SOL = 0.000005;
const TOTAL = PROTOCOL_FEE_SOL + NETWORK_FEE_SOL;
```

## Fee Transparency

Users see:

1. Protocol Fee: 0.001 SOL
2. Network Fee: ~0.000005 SOL
3. Total: ~0.001005 SOL

## No Storage Funding

For Memo Drop:

- No separate HashDrop storage account
- No rent funding required
- No chunking
- No storage account creation

The transaction itself is the publication record.

## RPC Cost Estimation

The application uses Solana Kit RPC for dynamic fee estimation:

```typescript
// Get fee for message
const fee = await rpc.getFeeForMessage(message).send();

// Get minimum balance for rent exemption
const minBalance = await rpc.getMinimumBalanceForRentExemption(size).send();
```

## Network-Specific Costs

### Devnet
- Uses default Solana Devnet RPC
- No API key required
- Lower transaction fees (test SOL)

### Mainnet
- Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable
- Uses Helius, QuickNode, or other RPC provider
- Real SOL transaction fees apply

## Environment Configuration

For Mainnet deployment, create a `.env.local` file:

```bash
# Mainnet RPC URL (REQUIRED for Mainnet)
NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Devnet RPC URL (optional, defaults to Solana Devnet)
NEXT_PUBLIC_SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

**Important:** The application will NOT fall back to the public Solana Mainnet RPC if `NEXT_PUBLIC_SOLANA_MAINNET_RPC` is not configured. You must provide a valid RPC endpoint.