# Wallet

## Goal

Allow users to publish without creating a HashDrop account.

## Supported flow

The wallet layer should support compatible Solana wallets such as Phantom and other wallets supported by the selected wallet-standard approach.

## Required states

- disconnected
- connecting
- connected
- switching/selecting network
- transaction awaiting approval
- transaction submitted
- confirmation pending
- confirmed
- rejected
- expired
- insufficient funds
- RPC failure

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
