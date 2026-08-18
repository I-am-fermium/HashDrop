# Testing Strategy

## Unit tests

Test:

- byte encoding
- exact byte counting
- cryptographic hashing
- HashDrop ID generation
- deterministic serialization
- chunk splitting
- chunk reconstruction
- cost calculations
- content validation

## Program tests

Test:

- create_drop authorization
- valid metadata
- invalid metadata
- valid chunk writes
- unauthorized writes
- invalid indices
- oversize chunks
- repeated writes
- incomplete finalization
- successful finalization
- post-finalization mutation attempts
- wrong creator
- invalid PDA/account relationships

## Client integration tests

Test:

- wallet connect/disconnect
- transaction approval
- rejection
- insufficient funds
- RPC errors
- expired transactions
- partial progress
- retry/resume behavior
- reconstruction from Solana
- successful hash verification
- corrupt/mismatched data detection

## End-to-end

At minimum prove:

1. create small code asset;
2. calculate hash;
3. calculate storage;
4. publish on localnet/devnet;
5. write chunks;
6. finalize;
7. close/reload frontend;
8. reconstruct using only public frontend + RPC;
9. recompute hash;
10. display VERIFIED ON-CHAIN.

## Regression rule

Every protocol bug fixed should receive a regression test where practical.
