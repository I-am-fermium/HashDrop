# Wallet

## Goal

Allow users to publish without creating a HashDrop account.

## Supported flow

The wallet layer supports compatible Solana wallets such as Phantom and other wallets supported by the Wallet Standard approach via `window.solana` API.

## Supported Wallets

- **Phantom**: Primary wallet, supports v0 transactions
- **Brave**: Native Brave wallet, supports v0 transactions
- **Solflare**: Compatible via Wallet Standard
- **Sollet**: Compatible via Wallet Standard

## Required states

- disconnected
- connecting
- connected
- network switching/selecting
- transaction awaiting approval
- transaction submitted
- confirmation pending
- confirmed
- rejected
- expired
- insufficient funds
- RPC failure

## Transaction Support

| Wallet | v0 Support | v1 Support |
|--------|------------|------------|
| Phantom | ✅ | ⚠️ Pending |
| Brave | ✅ | ⚠️ Pending |
| Solflare | ✅ | Unknown |
| Sollet | ✅ | Unknown |

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

### Network Configuration

- **Devnet**: `https://api.devnet.solana.com` (default)
- **Mainnet**: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

### RPC Factory Pattern

```typescript
// Get Solana Kit RPC client for RPC operations
const rpc = createRpc();

// Get web3.js Connection for Phantom compatibility
const connection = createConnection();
```

## Rules

- Never request or handle private keys.
- Never store seed phrases.
- Never claim wallet ownership from an unverified local state.
- Always derive creator/publisher identity from the connected public key.
- Clearly identify the network.

## Transaction UX

For a multi-step publication, explain:

1. what the transaction does;
2. why it is needed;
3. the expected cost;
4. what happens after approval.

The application must preserve enough local state to resume an interrupted workflow safely.

## Connection Flow

1. User clicks "Connect Wallet"
2. Browser prompts wallet connection
3. User approves connection in wallet
4. App receives public key
5. App stores connection state

## Transaction Signing Flow

1. Build VersionedTransaction using web3.js
2. Call `wallet.signTransaction(transaction)`
3. User approves in wallet
4. Receive signed transaction
5. Send via `connection.sendRawTransaction()` (web3.js Connection)
6. Confirm transaction

## Network Selection

Users can switch networks via:

- URL parameter `?network=mainnet`
- Network selector in the UI
- localStorage setting

### Environment Configuration

For Mainnet deployment, create a `.env.local` file:

```bash
# Mainnet RPC URL (REQUIRED for Mainnet)
NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Devnet RPC URL (optional, defaults to Solana Devnet)
NEXT_PUBLIC_SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

**Important:** The application will NOT fall back to the public Solana Mainnet RPC if `NEXT_PUBLIC_SOLANA_MAINNET_RPC` is not configured. You must provide a valid RPC endpoint.

## RPC Operations

All RPC operations use Solana Kit:

- `getLatestBlockhash()` - Via `rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()`
- `getBalance()` - Via Kit RPC
- `getTransaction()` - Via Kit RPC
- `simulateTransaction()` - Via Kit RPC

## Error Handling

RPC errors are captured and logged with safe information:

```typescript
console.error('[HashDrop] getLatestBlockhash failed:', {
  operation: 'getLatestBlockhash',
  network,
  provider,
  message: error?.message,
  code: error?.code,
});
```

Never logs:
- API keys
- Full RPC URLs with credentials
- Query parameters
- Authorization headers