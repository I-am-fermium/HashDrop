# Solana Kit Migration Plan

## Current Architecture Audit

### Installed Solana Dependencies

```json
{
  "@solana/web3.js": "^1.98.4",
  "@solana/wallet-adapter-base": "^0.9.27",
  "@solana/wallet-adapter-react": "^0.15.39",
  "@solana/wallet-adapter-react-ui": "^0.9.39",
  "@solana/wallet-adapter-wallets": "^0.19.38",
  "@solana/kit": "7.1.1",
  "@solana/react": "7.1.1",
  "@solana/kit-plugin-wallet": "0.14.0",
  "@solana-program/memo": "0.12.0"
}
```

### Current Transaction Architecture

**Transaction Types Used:**
- `Transaction` (legacy)
- `VersionedTransaction` (v0)
- `TransactionMessage`
- `TransactionInstruction`

**Current Transaction Flow:**
1. `usePublish.ts` → `buildMemoDropTransaction()` → `buildV0Transaction()` or `buildV1Transaction()`
2. `transactions.ts` → `buildMemoDropTransaction()` → detects SDK capabilities
3. `transactionCapabilities.ts` → `sdkSupportsV1()` → checks for `compileToV1Message()` method
4. Currently builds v0 transactions (SDK does not support v1 yet)

**Key Files:**
- `src/hooks/useWallet.ts` - Wallet connection via `window.solana` (Phantom/Brave)
- `src/hooks/usePublish.ts` - Memo Drop publishing
- `src/lib/transactions.ts` - Transaction builders
- `src/lib/verification.ts` - On-chain content verification
- `src/lib/solana/networkCost.ts` - Network cost calculation
- `src/lib/solana/transactionCapabilities.ts` - Transaction capability detection
- `src/lib/memo.ts` - Memo payload encoding
- `src/lib/network.ts` - Network configuration and RPC factory
- `src/lib/rpc/devnet.ts` - Devnet RPC configuration
- `src/lib/rpc/mainnet.ts` - Mainnet RPC configuration

### Current Wallet Architecture

**Wallet Connection:**
- Direct `window.solana` API access (Phantom/Brave browsers)
- No hardcoded wallet list - `autoConnect` enabled

**Wallet Operations:**
- `connect()` - `provider.connect()`
- `disconnect()` - `provider.disconnect()`
- `sendTransaction()` - `provider.signTransaction()` + `connection.sendRawTransaction()`

### Current RPC Architecture

**Hybrid Architecture (COMPLETED):**

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

**RPC Factory Pattern:**
- `createRpc()` - Returns the appropriate Solana Kit RPC client for the current network
- `createConnection()` - Returns the appropriate web3.js Connection for Phantom compatibility

**Methods Used (via Solana Kit):**
- `getLatestBlockhash()` - Via `rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()`
- `getBalance()` - Via Kit RPC
- `getTransaction()` - Via Kit RPC
- `simulateTransaction()` - Via Kit RPC

### Current Address Architecture

**PublicKey Usage:**
- `PublicKey` class from `@solana/web3.js`
- Base58 encoding/decoding via `bs58` library
- Used for: wallet addresses, memo program ID, fee payer

### Current Memo Program

**Program ID:**
- `Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH`

**Payload Format (V2):**
```
HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>
```

### Current Transaction Size Limits

**Constants:**
- `LEGACY_TRANSACTION_MAX_BYTES = 1232`
- `V1_TRANSACTION_MAX_BYTES = 4096`

**Detection:**
- Runtime check: `TransactionMessage.prototype.compileToV1Message`
- Currently reports `supportsV1 = false` (SDK v1.98.4 does not have v1 support)

### Current Content Handling

**Encoding:**
- UTF-8 byte length via `TextEncoder`
- Base64 encoding via `btoa()`
- SHA-256 hashing via Web Crypto API

**Size Calculation:**
- Dynamic transaction size measurement
- Memo payload size + transaction overhead
- Available bytes = max bytes - transaction size

### Current Verification Architecture

**Verification Flow:**
1. Fetch transaction via `connection.getTransaction(signature, { maxSupportedTransactionVersion: 1 })`
2. Parse transaction version from RPC response
3. Find Memo instruction in transaction
4. Decode memo payload
5. Decode base64 content
6. Verify SHA-256 hash

**Supported Versions:**
- Legacy (version undefined)
- v0 (version 0)
- v1 (version 1) - for retrieval only

---

## Migration Status

### Phase 1: Install Solana Kit ✅ COMPLETE

Installed packages:
- `@solana/kit@7.1.1`
- `@solana/react@7.1.1`
- `@solana/kit-plugin-wallet@0.14.0`
- `@solana-program/memo@0.12.0`

### Phase 2: Wallet Migration ✅ COMPLETE

Current implementation uses direct `window.solana` API for Phantom/Brave wallet compatibility.

**Current Flow:**
```tsx
// Direct window.solana API
const { solana } = window as any;
await solana.connect();
const signedTx = await solana.signTransaction(transaction);
```

**Target Flow (when ready):**
```tsx
// Wallet Standard approach
const wallets = useWallets();
const solanaWallets = wallets.filter(w => w.chains.includes('solana:devnet'));
const transactionSigner = useWalletAccountTransactionSigner(selectedAccount, 'solana:devnet');
```

### Phase 3: RPC Migration ✅ COMPLETE

**Completed:**
- ✅ Replaced `Connection` with Kit RPC for `getLatestBlockhash()`
- ✅ Created RPC factory pattern in `src/lib/rpc/`
- ✅ Implemented network-specific RPC configuration
- ✅ Added `createRpc()` and `createConnection()` functions
- ✅ Updated `transactions.ts` to use Solana Kit RPC
- ✅ Updated `page.tsx` to use Solana Kit RPC

**Architecture:**
- `@solana/kit` = PRIMARY RPC layer for all RPC operations
- `@solana/web3.js` = ONLY for Phantom compatibility/signing boundary

### Phase 4: Address Migration ⏳ PLANNED

Replace `PublicKey` with `Address` when needed.

### Phase 5: Transaction Architecture ⏳ PLANNED

Replace legacy transaction classes with Kit when needed.

### Phase 6: Solana V1 Transaction Support ⏳ READY

SDK support is available. Wallet support is pending Phantom wallet v1 signing support.

---

## Key Considerations

1. **Do NOT break existing HashDrops** - Maintain retrieval compatibility
2. **Do NOT hardcode 4096-byte Memo limit** - Calculate dynamically
3. **Use UTF-8 byte length** - Not character count
4. **Preserve HashDrop protocol** - Same hash generation, same memo format
5. **Network support** - Check if v1 is actually supported on target network

## Current Status

- **SDK Support**: ✅ Available (web3.js 1.98.4, Kit 7.1.1)
- **Wallet Support**: ⚠️ Phantom v1 signing pending
- **RPC Migration**: ✅ COMPLETE
- **Current Implementation**: v0 transactions (1232-byte limit)
- **Target Implementation**: v1 transactions (4096-byte limit) when Phantom adds support

## RPC Configuration

### Environment Variables

- `NEXT_PUBLIC_SOLANA_DEVNET_RPC` - Devnet RPC URL (optional, defaults to Solana Devnet)
- `NEXT_PUBLIC_SOLANA_MAINNET_RPC` - Mainnet RPC URL (REQUIRED for Mainnet)

### Network Selection

Users can switch networks via:
- URL parameter `?network=mainnet`
- Network selector in the UI
- localStorage setting

### RPC Factory

```typescript
// Get Solana Kit RPC client for RPC operations
const rpc = createRpc();

// Get web3.js Connection for Phantom compatibility
const connection = createConnection();
```

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