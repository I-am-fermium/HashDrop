# HashDrop Media Support

HashDrop extends the existing cryptographic architecture to PHOTO, VIDEO and
VOICE (audio) objects in **PROOF** and **PRIVATE** modes. **PUBLIC mode is and
remains TEXT ONLY.**

```
PUBLIC  -> TEXT ONLY (existing implementation unchanged)
PROOF   -> TEXT + PHOTO + VIDEO + VOICE
PRIVATE -> TEXT + PHOTO + VIDEO + VOICE
```

## Content model

Every media object keeps a descriptor with:

| Field        | Meaning                                             |
|--------------|-----------------------------------------------------|
| `contentKind`| `IMAGE` / `VIDEO` / `AUDIO`                          |
| `mimeType`   | validated MIME type (magic-byte checked)            |
| `filename`   | sanitized original filename (no `|`, capped at 120) |
| `size`       | exact byte length                                   |
| `sha256`     | SHA-256 of the EXACT original bytes                 |

Core module: `src/lib/media.ts`.

## Supported MIME types

- **IMAGE**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- **VIDEO**: `video/mp4`, `video/webm`, `video/quicktime`
- **AUDIO**: `audio/webm`, `audio/ogg`, `audio/wav`, `audio/mpeg`, `audio/mp4`
- **TEXT** (unchanged): `text/plain`, `text/markdown`, `text/html`, `text/css`,
  `text/javascript`, `text/typescript`, `text/xml`, `application/json`

MIME types are validated against the file signature / magic bytes. The declared
MIME is never trusted alone; cross-type spoofing (e.g. image bytes declared as
video) is rejected at upload time. Images are never resized/recompressed and
videos/audio are never transcoded for the proof/private artifact — the original
file is authoritative.

## Hashing

```
Original Media -> Raw Bytes -> SHA-256 -> 64-char hex hash
```

The proof/commitment hash is always `SHA-256(exact uploaded bytes)`. Never a
preview, a transcoded copy, a compressed representation, or a JSON/Base64
wrapper. Verification recomputes `SHA-256(retrieved bytes)` and compares
byte-for-byte with the committed hash.

## Size limits

`MAX_MEDIA_FILE_BYTES = 100 MB` (configurable in `src/lib/media.ts`). Files
above the cap are rejected with a clear error before hashing so the browser
never exhausts memory. Large media is never placed inside a Solana memo.
## Public mode (regression contract)

Public mode publishes text content on-chain and is byte-for-byte unchanged:

```
HASHDROP|v3|PUBLIC|<hashDropId>|<sha256>|<mimeType>|<contentSize>|<base64Content>
```

No media upload control is rendered in Public mode and no encryption behavior
has been introduced into it.

## PROOF mode media lifecycle

Media proofs commit the hash on-chain using the unified PROOF memo (one shape
for every content kind):

```
HASHDROP|v3|PROOF|<hashDropId>|<sha256>|<contentSize>|<contentType>|<filename>
```

- TEXT proofs use the same memo with `contentType: text/plain` and an empty
  filename; media proofs carry the validated MIME type and sanitized filename.
  There is no separate text/media serialization.
- The original media bytes are NEVER stored on-chain. The user keeps the
  original file (the client offers a download before finishing).
- Proof verification flow:

```
Solana memo
  -> parse descriptor (HashDrop ID / sha256 / size / content type / filename)
  -> user supplies the exact original file
  -> SHA-256(supplied bytes)
  -> compare with on-chain commitment
  -> VERIFIED / VERIFICATION FAILED
```

`verifyProofDropBytes()` (`src/lib/verification.ts`) performs the byte-based
verification; `verifyProofDrop()` remains the string-based text path.

## PRIVATE mode media lifecycle

Private media reuses the existing AES-256-GCM + ML-KEM-768 + HKDF-SHA-256
architecture without modification. The on-chain memo format is unchanged:

```
HASHDROP|v3|PRIVATE|<hashDropId>|<sha256>|<contentSize>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<encryptedKeyIv>|<encryptedKey>
```

Pipeline:

```
Original Media
  -> Raw Bytes
  -> SHA-256
  -> AES-256-GCM encrypt (existing AAD binding: hashDropId|sha256|size|mime|cryptoVersion|keyFingerprint)
  -> Encrypted Artifact (off-chain .hdp file)
  -> ML-KEM-768 encapsulate + HKDF-SHA-256 + AES-GCM key wrap -> on-chain key envelope
```

The encrypted artifact envelope is ONE canonical protocol for every content
kind. **Artifact version and object type are separate concepts** —
`version` is the schema version (`v1`), `type` is the object kind
(`TEXT | IMAGE | VIDEO | AUDIO`):

```
HASHDROP-PRIVATE-BLOB|v1|<hashDropId>|<sha256>|<contentSize>|<type>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<mlkemCt>|<iv>|<ciphertext>|<filename>
```

The filename is always present (`''` for text) and is auxiliary display
metadata only, sanitized at import (no `|`, path separators, or `..`
traversal). It is NOT part of the AAD binding. The object `type` IS part of
the AAD (alongside the on-chain commitment fields), so a tampered type/MIME
combination fails AES-GCM authentication during decryption. There is NO
v1/v2 artifact split.
## Retrieve HashDrop page

The Viewer (`src/app/viewer/page.tsx`) renders the correct viewer per content
type after a successful verification:

| Content | Viewer                                        |
|---------|-----------------------------------------------|
| TEXT    | text block                                    |
| IMAGE   | `<img>` preview + filename / MIME / size / SHA-256 / result |
| VIDEO   | `<video controls>` player + metadata          |
| AUDIO   | `<audio controls>` player + metadata          |

The original (retrieved/decrypted) file is always available via a "Download
Original" button. Finding an artifact is NOT the same as verifying it: the UI
separates "artifact/commitment found" from `VERIFIED`.

## Tamper resistance (tested)

`src/lib/mediaLifecycle.test.ts` covers, for every content type:

- one-byte image/video/audio modification
- encrypted artifact ciphertext modification
- on-chain metadata modification
- wrong MIME kind / wrong file / truncated file / missing artifact
- wrong secret key
- cross-type lifecycle for PROOF and PRIVATE: create -> hash -> (encrypt) ->
  store artifact -> memo -> retrieve -> (decrypt) -> hash -> verify

## Public-mode regression

`src/components/ContentInput.test.tsx` asserts Public mode renders only the
text editor (no media tabs, no file input), and the full existing suite (185+
tests) continues to pass unchanged.