# Consent Lifecycle

VCEM consent versions are immutable and hash chained.

| Status | Meaning | Authorizable |
| --- | --- | --- |
| `NONE` | No consent exists. | No |
| `ACTIVE` | Current usable policy version. | Yes |
| `SUPERSEDED` | Historical version replaced by a newer active or revoked version. | No for new access, still auditable |
| `REVOKED` | Participant revoked consent. | No |

When a participant modifies consent, the previous current version becomes `SUPERSEDED` and a new `ACTIVE` version is created. In experiments, “modified consent” means “latest active version after one or more modifications,” not a separate authorizable `UPDATED` state.

The canonical consent hash is:

```solidity
sha256(
  abi.encode(
    previousConsentHash,
    participantId,
    version,
    consentStatus,
    purposeMask,
    scopeHash,
    actorsRoot,
    zkConsentCommitment,
    timestamp
  )
)
```

Historical versions remain queryable with their policy fields, actor root, actor set, previous hash, and consent hash.
