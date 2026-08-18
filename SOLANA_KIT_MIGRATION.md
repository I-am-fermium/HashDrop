# Solana Kit Migration Plan

## Current Architecture Audit

### Installed Solana Dependencies

```json
{
  "@solana/web3.js": "^1.98.4",
  "@solana/wallet-adapter-base": "^0.9.27",
  "@solana/wallet-adapter-react": "^0.15.39",
  "@solana/wallet-adapter-react-ui": "^0.9.39",
  "@solana/wallet-adapter-wallets": "^0.19.38"
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
- `src/lib/transactions.ts` - Transaction building
- `src/lib/transactions.ts` - Transaction serialization
- `src/lib/solana/transactionCapabilities.ts` - Transaction capability detection
- `src/lib/memo.ts` - Memo payload encoding
- `src/lib/verification.ts` - On-chain content verification
- `src/lib/solana/networkCost.ts` - Network cost calculation
- `src/components/WalletProvider.tsx` - Wallet adapter provider
- `src/components/WalletConnect.tsx` - Wallet connection UI
- `src/app/page.tsx` - Main publish page

### Current Wallet Architecture

**Wallet Connection:**
- Direct `window.solana` API access (Phantom/Brave browsers)
- `WalletProvider` from `@solana/wallet-adapter-react`
- No hardcoded wallet list - `autoConnect` enabled

**Wallet Operations:**
- `connect()` - `provider.connect()`
- `disconnect()` - `provider.disconnect()`
- `sendTransaction()` - `provider.signTransaction()` + `connection.sendRawTransaction()`

### Current RPC Architecture

**Connection:**
- `Connection` class from `@solana/web3.js`
- Endpoints: `DEVNET_ENDPOINT`, `MAINNET_ENDPOINT`
- Commitment: `'confirmed'`

**Methods Used:**
- `getLatestBlockhash()`
- `sendRawTransaction()`
- `confirmTransaction()`
- `getTransaction()` with `maxSupportedTransactionVersion: 1`
- `getBalance()`
- `getFeeForMessage()`
- `getMinimumBalanceForRentExemption()`
- `simulateTransaction()`

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

## Migration Plan

### Phase 1: Install Solana Kit

Install the modern Solana Kit packages:
```bash
npm install @solana/kit @solana/react @solana/kit-plugin-wallet
npm install @solana-program/memo
```

### Phase 2: Wallet Migration

Replace `@solana/wallet-adapter-*` with:
- `@solana/react` - React hooks for wallet
- `@solana/kit-plugin-wallet` - Wallet Standard plugin

### Phase 3: RPC Migration

Replace `Connection` with Kit RPC:
- `createRpc()` from `@solana/kit`
- Maintain network switching capability

### Phase 4: Address Migration

Replace `PublicKey` with `Address`:
- `createAddress()` from `@solana/kit`
- Update all address handling

### Phase 5: Transaction Architecture

Replace legacy transaction classes with Kit:
- `TransactionMessage` → Kit transaction planner
- `VersionedTransaction` → Kit transaction builder
- Implement v1 transaction support

### Phase 6: Solana V1 Transaction Support

Implement v1 transaction creation:
- Use Kit's v1 transaction APIs
- Verify 4096-byte limit
- Calculate actual available payload

### Phase 7: Testing

Test on Devnet:
- 1 byte → maximum valid payload
- Unicode content (Hindi, Japanese, Chinese, Emoji)
- Wallet signing
- Transaction submission
- Retrieval and verification

---

## Key Considerations

1. **Do NOT break existing HashDrops** - Maintain retrieval compatibility
2. **Do NOT hardcode 4096-byte Memo limit** - Calculate dynamically
3. **Use UTF-8 byte length** - Not character count
4. **Preserve HashDrop protocol** - Same hash generation, same memo format
5. **Network support** - Check if v1 is actually supported on target network