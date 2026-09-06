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

### HashDrop Platform Fee

A real on-chain SOL transfer of 0.001 SOL (1,000,000 lamports) from the user's wallet to the HashDrop fee wallet (`Amy4Tej83vsnCdFbBtfWmQrEdRLVF4AVAvZupyka8qQT`), included in every publish transaction via a `SystemProgram.transfer` instruction.

### Solana Network Fee

The network transaction fee required by Solana for processing the transaction.

## Before Signing

The browser must calculate or obtain enough information to show:

- Content size in bytes
- Estimated Solana network fee
- HashDrop protocol fee
- Total expected wallet spend

## Accuracy

The platform-fee portion is exact by construction (it matches the `SystemProgram.transfer` lamport amount). The Solana network fee is currently a hardcoded estimate (5000 lamports via `getBaseTransactionFee()`); `getFeeForMessage` is not currently used.

## Fee Policy

The protocol fee configuration should be explicit and easy to inspect in the code and documentation.

Do not hide protocol fees inside vague transaction-cost language.

## UX

The user should see the final estimated total before approving the transaction.

Errors caused by changed network conditions should be explained rather than silently substituting a stale estimate.

## Memo Drop Cost

For Memo Drop publications:

```text
HashDrop Platform Fee (SystemProgram.transfer, 0.001 SOL)
+
Solana Network Fee
```

No storage funding is required for Memo Drop publications.

The HashDrop platform fee is a **real on-chain SOL transfer** included in every publish transaction: the user's wallet sends 1,000,000 lamports (0.001 SOL) to the HashDrop fee wallet via a `SystemProgram.transfer` instruction. It is not a display-only charge.

## Fee Configuration

The platform fee is defined once in `src/lib/constants.ts` (single source of truth):

```typescript
export const HASHDROP_PLATFORM_FEE_LAMPORTS = 1_000_000; // 0.001 SOL
export const HASHDROP_PLATFORM_FEE_SOL = HASHDROP_PLATFORM_FEE_LAMPORTS / Math.pow(10, SOL_DECIMALS);
export const HASHDROP_FEE_WALLET = 'Amy4Tej83vsnCdFbBtfWmQrEdRLVF4AVAvZupyka8qQT';
```

The transaction builder (`src/lib/transactions.ts`) uses these constants to build the transfer instruction:

```typescript
const transferIx = SystemProgram.transfer({
  fromPubkey: feePayerKey,                  // user's wallet (fee payer, only signer)
  toPubkey: new PublicKey(HASHDROP_FEE_WALLET),
  lamports: HASHDROP_PLATFORM_FEE_LAMPORTS, // 1,000,000
});
```

## Transaction Version Costs

### v0 Transactions (Current)
- Platform Fee: 0.001 SOL (on-chain transfer → fee wallet)
- Network Fee: ~0.000005 SOL (5000 lamports base)
- **Total: ~0.001005 SOL**

### v1 Transactions (Target)
- Platform Fee: 0.001 SOL (on-chain transfer → fee wallet)
- Network Fee: ~0.000005 SOL (5000 lamports base)
- **Total: ~0.001005 SOL**

## Cost Calculation

The estimated cost shown in the UI is:

```typescript
// src/hooks/useCostEstimate.ts
const protocolFeeLamports = HASHDROP_PLATFORM_FEE_LAMPORTS; // 1,000,000
const networkFeeLamports = 5000;                            // base fee estimate
const totalLamports = networkFeeLamports + protocolFeeLamports; // 1,005,000
```

Note: the base network fee is currently a hardcoded estimate (5000 lamports from `getBaseTransactionFee()`); it is not fetched via `getFeeForMessage`. `totalWithNetworkFeeLamports` in `useCostEstimate.ts` double-counts the network fee and is not used by the publish page display.

## Fee Transparency

Users see (before signing):

1. Platform Fee: 0.001 SOL (actual on-chain transfer to the HashDrop fee wallet)
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

The application currently uses Solana Kit RPC for blockchain operations (getLatestBlockhash, etc.), but the network-fee estimate is a hardcoded base-fee value (5000 lamports) returned by `getBaseTransactionFee()` in `src/lib/solana/networkCost.ts`. It does **not** call `getFeeForMessage` for the publish flow.

```typescript
// Current base-fee estimate (src/lib/solana/networkCost.ts)
export async function getBaseTransactionFee(): Promise<number> {
  return 5000; // base transaction fee in lamports
}
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