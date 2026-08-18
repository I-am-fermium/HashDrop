# HashDrop ID

The HashDrop ID is the deterministic identifier for a publication.

The final algorithm must be documented before production deployment.

Requirements:

- deterministic;
- collision-resistant;
- derived from protocol-defined inputs;
- independent of mutable UI state;
- serialized using explicit byte ordering.

Do not use random client-side IDs as the canonical protocol identifier.
