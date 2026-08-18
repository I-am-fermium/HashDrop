# Deployment

## Development

Use localnet/devnet while building the protocol.

## Production gate

Mainnet deployment requires explicit human approval after testing and security review.

## Frontend

The frontend may be hosted as a static web application. Hosting is not the canonical data layer.

## Program

Before production:

- verify program ID;
- review authority/upgradeability configuration;
- verify treasury configuration;
- verify fee configuration;
- run end-to-end tests;
- document deployment artifacts.

Never deploy a mainnet program automatically from an AI coding session.
