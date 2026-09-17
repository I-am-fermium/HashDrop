# Content Model

## Supported content

HashDrop supports TEXT, PHOTO, VIDEO and VOICE content, scoped by mode:

```text
PUBLIC  -> TEXT ONLY (existing implementation unchanged)
PROOF   -> TEXT + IMAGE + VIDEO + AUDIO
PRIVATE -> TEXT + IMAGE + VIDEO + AUDIO
```

A content record has an explicit media/content type.

## Byte-first rule

Hashes and sizes operate on the exact bytes that will be stored on-chain, not on characters or rendered text.

The browser must establish a deterministic encoding before hashing and publishing.

For media, the proof hash is `SHA-256(exact original file bytes)`. Previews,
transcoded copies, compressed representations and Base64/JSON wrappers are
never hashed.

## Supported Content Types

### Text (all modes)

| MIME Type | Description |
|-----------|-------------|
| text/plain | Plain text |
| text/javascript | JavaScript |
| text/typescript | TypeScript |
| text/html | HTML |
| text/css | CSS |
| application/json | JSON |
| text/markdown | Markdown |

### Media (PROOF / PRIVATE only)

| MIME Type | Kind |
|-----------|------|
| image/jpeg | IMAGE |
| image/png | IMAGE |
| image/webp | IMAGE |
| image/gif | IMAGE |
| video/mp4 | VIDEO |
| video/webm | VIDEO |
| video/quicktime | VIDEO |
| audio/webm | AUDIO |
| audio/ogg | AUDIO |
| audio/wav | AUDIO |
| audio/mpeg | AUDIO |
| audio/mp4 | AUDIO |

Media MIME types are validated against the file signature / magic bytes. The
declared MIME and filename extension are never trusted alone; files whose
signature disagrees with the declared kind are rejected.

## Validation

Reject:

- unsupported content types;
- empty content if the protocol disallows it;
- files exceeding `MAX_MEDIA_FILE_BYTES` (100 MB);
- files whose magic-byte signature does not match the declared MIME kind;
- malformed data that cannot be represented by the protocol.

The precise policy must be implemented consistently between client and program.

## Content Size Limits

### Memo Drop (Current - v0)
- **Max Transaction Size**: 1232 bytes
- **Effective Content**: ~800 bytes (after base64 encoding)
- **Recommendation**: Keep content under 700 bytes for safety

### Memo Drop (Target - v1)
- **Max Transaction Size**: 4096 bytes
- **Effective Content**: ~2800 bytes (after base64 encoding)
- **Status**: Ready when Phantom adds v1 signing support

Media is NEVER placed inside a memo. Only the compact commitment/metadata is
published on-chain; the media artifact is off-chain (user-held file for PROOF,
encrypted `.hdp` artifact for PRIVATE).

## Encoding

Content is encoded as:

1. UTF-8 bytes via `TextEncoder`
2. Base64 encoding for memo payload
3. SHA-256 hash for verification

## Unicode Support

The application correctly handles:

- ASCII characters
- Emoji (🚀)
- Accented characters (é, ü, ñ)
- Non-Latin scripts (你好, مرحبا)
- Mixed Unicode content

**Important**: Use UTF-8 byte length, not JavaScript `string.length`.