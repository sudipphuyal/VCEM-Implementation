# Consent Lifecycle

VCEM consent versions are immutable and hash chained.

| Status | Meaning | Authorizable |
| --- | --- | --- |
| `NONE` | No consent exists. | No |
| `ACTIVE` | Policy version that was active when committed. Prior active versions remain historically active but are not current after a later version exists. | Yes only when it is also the latest version |
| `SUPERSEDED` | Reserved compatibility label. Supersession is derived from later versions, not written by mutating historical records. | No direct use |
| `REVOKED` | Participant revoked consent. | No |

When a participant modifies consent, the previous version is left immutable and a new `ACTIVE` version is created. A previous version is considered superseded only because a later version exists. In experiments, “modified consent” means “latest active version after one or more modifications,” not a separate authorizable status.

When a participant revokes consent, historical active versions remain immutable and a new `REVOKED` version is appended. The latest version being `REVOKED` means there is no active consent for new access.

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
