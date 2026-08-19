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

1. Build VersionedTransaction
2. Call `wallet.signTransaction(transaction)`
3. User approves in wallet
4. Receive signed transaction
5. Serialize and send via `connection.sendRawTransaction()`
6. Confirm transaction

## Network Selection

- Devnet: `https://api.devnet.solana.com`
- Mainnet: `https://api.mainnet-beta.solana.com`

Users can switch networks via URL parameter `?network=mainnet`