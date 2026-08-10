# Audit and Artifact-Integrity Validation

## Status and provenance

This directory contains peer-review/revision validation artifacts added after the original evaluated benchmark campaign. No benchmark result or VCEM Solidity contract was modified.

- Evaluated deployment commit: `6077d27a9eca686e5395e8e081bbbf588b824a0b`
- Deployment manifest: `deployments/vcem-manifest.json`
- Ledger: preserved Besu 24.12.0 IBFT 2.0 chain, chain ID `20260703`
- Author-developed verifier: `scripts/auditVerify.ts`
- Exhaustive runner: `scripts/runFullAuditVerification.ts`
- Integrity/tamper harness: `test/VCEMIntegrityNegativeControls.ts`
- Application-layer logs/databases used by exhaustive verification: none
- External organizational replication: not performed

The integrity and audit-negative-control harness was executed against the exact evaluated Solidity source in a temporary worktree. Harness-only compatibility changes were used; evaluated contracts were not modified.

## Previous 100-event sample

The repository documents a deterministic sample command with `--sample-size 100 --seed 42`. The number 100 is a requested sample cap, not the denominator of authorization outcomes and not evidence that 120 events were recorded. No preserved 100-row audit report exists in the repository, so the exact prior sampled output cannot be independently recovered as an artifact.

The preserved evaluated deployment contains 4,240 successful `AccessAuthorized` events. Therefore, if the documented sample command was run against this same deployment after the population was complete, it would have selected 100 of those 4,240 events. This conditional interpretation must not be rewritten as proof that the missing original sample report contained those exact records.

## Full-population audit verification

The revision-time full verifier queried the original evaluated contract addresses and reconstructed every `AccessAuthorized` event from blocks 316 through 1647.

| Measure | Result |
| --- | ---: |
| Recorded `AccessAuthorized` events | 4,240 |
| Unique authorization transaction hashes | 4,240 |
| Unique request IDs | 4,240 |
| Events exhaustively checked | 4,240 |
| Events passing all checks | 4,240 |
| Events with discrepancies | 0 |
| Consent lifecycle records | 1 |
| Data-hash registration records | 10 |
| `AccessDenied` records | 0 |

For every authorization event, the verifier checked request ID, participant ID, requestor ID, requested purpose, scope hash, data hash, consent version, consent hash, actor root, block timestamp, event order, referenced consent existence and governing state, historical registry wallet/role state, version-specific actor membership, purpose permission, scope permission, latest registered participant/scope data hash, request-ID uniqueness, EIP-712 signature and recovered signer, expected consent hash, and request expiry at the block timestamp.

The verifier used on-chain logs, transaction calldata, transaction receipts, block metadata, registry lifecycle events, consent lifecycle events, data-hash registration events, and local ABIs. It did not read API logs, proxy logs, delivery-ledger rows, storage metadata, benchmark summaries, or off-chain consent copies.

The safe meaning of independent verification is: **verified from on-chain evidence independently of application-layer logs**. The verifier was developed and executed by the authors; no external organization replicated this experiment.

## Audit negative controls

Ten revision-time mutations were applied only to reconstructed in-memory evidence. The underlying blockchain was not changed.

| Mutation | Detector/result |
| --- | --- |
| Modified `consentHash` | `ACCESS_CONSENT_HASH_MISMATCH` |
| Modified `consentVersion` | `MISSING_CONSENT_VERSION` |
| Modified requestor ID | `CALLDATA_REQUESTOR_MISMATCH` |
| Modified participant ID | `MISSING_CONSENT_VERSION` |
| Modified purpose | `CALLDATA_PURPOSE_MISMATCH` |
| Modified scope hash | `SCOPE_MISMATCH` |
| Modified data hash | `DATA_HASH_NOT_REGISTERED` |
| Modified actor root | `ACCESS_ACTOR_ROOT_MISMATCH` |
| Removed authorization event after collection | `ACCESS_EVENT_POPULATION_CHANGED` |
| Inconsistent previous consent hash | `PREVIOUS_HASH_MISMATCH` |

All ten controls were detected. The missing-event control detects removal after the RPC population has been collected. A malicious or incomplete RPC provider that omits both logs and related evidence cannot be detected without comparison against another trusted/full node or a separately committed population count.

## Artifact-integrity validation

The synthetic artifact was a UTF-8 JSON byte sequence containing metadata and a heart-rate observation. The artifact-level implementation hashes raw plaintext bytes with SHA-256 before encryption; it does not canonicalize JSON.

- Registered positive-control hash: `0x2d2288301bba1d4a2ffc66b9cd16585a4615b06f67da79fc6eab915fb06d5a6f`
- Positive result: local SHA-256 matched the participant/scope registered data hash, and authorization succeeded.

| Control | Method | Observed result |
| --- | --- | --- |
| Single-byte modification | Byte offset 138 changed from ASCII `2` (`0x32`) to `3` (`0x33`) | Different SHA-256; `TAMPERED` |
| Metadata modification | Changed `metadata.source`, which is inside the hashed bytes | Different SHA-256; `TAMPERED` |
| Wrong participant association | Used the anchored hash under a second participant without that participant/scope registration | Reverted: `VCEMAudit: data hash denied` |
| Wrong scope | Used the artifact hash with an unauthorized scope | Reverted: `VCEMAudit: scope denied` |
| Stale data hash | Replaced the participant/scope registration, then requested the prior hash | Reverted: `VCEMAudit: data hash denied` |
| Serialization/canonicalization change | Pretty-printed semantically equivalent JSON | Different SHA-256; raw-byte serialization is significant |
| Substituted artifact | Replaced the artifact with unrelated synthetic glucose content | Different SHA-256; `TAMPERED` |

Metadata modification is detected only because the metadata was included inside the exact byte representation being hashed. Changes to metadata stored outside those bytes are not covered by the digest.

## Integrity claim boundary

A matching SHA-256 digest establishes only that the supplied bytes correspond to the representation whose digest was registered/anchored for the relevant participant and scope. It does not establish clinical authenticity, medical accuracy, completeness, source provenance, lawful collection, lawful processing or use, successful delivery, requester retrieval, successful decryption, downstream purpose limitation, deletion of downstream copies, or semantic equivalence between differently serialized representations.

## Evidence files

- `full-audit-verification.csv`: one row per recorded authorization event.
- `audit-verification-summary.json`: denominator, result, provenance, and fields checked.
- `audit-negative-controls.csv`: evaluated-source audit tamper controls.
- `integrity-negative-controls.csv`: positive and negative artifact controls.
- `integrity-validation-summary.json`: exact hashes, byte offset, provenance, and results.
- `raw/full-audit-report.json`: complete verifier output.
- `raw/audit-negative-controls-evaluated-6077d27.json`: evaluated-source audit mutation output.
- `raw/integrity-controls-evaluated-6077d27.json`: evaluated-source artifact-control output.

## Reproduction

```bash
npm run besu:up
npm run audit:verify-full-population
npm run test:audit-integrity
```

To rerun the negative controls against the exact evaluated worktree, invoke the test from the worktree while setting `VCEM_AUDIT_INTEGRITY_REPORT_ROOT` and `VCEM_AUDIT_INTEGRITY_EVIDENCE_LABEL=evaluated-6077d27`, as documented in the root README.
