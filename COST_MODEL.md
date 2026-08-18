# HashDrop Cost Model

## Overview

HashDrop is now a Memo-only, zero-backend protocol. Content is published using Solana transactions with the SPL Memo program.

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