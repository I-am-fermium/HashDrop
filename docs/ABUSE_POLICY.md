# Abuse and Responsible Use

HashDrop produces public, potentially permanent content.

The product documentation and UI should discourage users from publishing illegal, harmful, confidential, or secret material.

The protocol cannot promise that already-published data can be erased from Solana or from copies made by third parties.

The project should maintain a clear distinction between technical immutability and legal rights.

## Responsible Use

### Do NOT publish:

- Illegal content
- Harmful misinformation
- Personal confidential information
- Passwords or private keys
- Seed phrases
- API secrets
- Proprietary material you don't intend to make public

### Permanence Warning

Before publishing, show:

```text
⚠️ Warning: Published content is public and permanent

Once published to Solana, your content will be:
- Publicly accessible via transaction signature
- Permanently stored on-chain
- Copyable by anyone
- Not deletable

Do not publish:
- Passwords or private keys
- Personal confidential information
- Proprietary content you don't intend to share
```

## Content Size Limits

### Memo Drop (Current - v0)
- **Max Transaction Size**: 1232 bytes
- **Effective Content**: ~800 bytes (after base64 encoding)

### Memo Drop (Target - v1)
- **Max Transaction Size**: 4096 bytes
- **Effective Content**: ~2800 bytes (after base64 encoding)
- **Status**: Ready when Phantom adds v1 signing support

## Reporting Abuse

If you encounter abusive content:

1. Note the transaction signature
2. Report to the appropriate authorities
3. The content is public and permanent - consider the implications before publishing

## Legal Disclaimer

HashDrop is a technical tool for publishing content on Solana. It is not:

- A legal copyright registry
- A private storage service
- A content moderation platform

Users are responsible for their published content.