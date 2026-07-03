# VCEM Policy Model

VCEM uses one canonical purpose bitmask across Solidity, TypeScript services, FHIR fixtures, and tests.

| Purpose | Bit | Decimal | FHIR fixture code |
| --- | ---: | ---: | --- |
| Treatment | `1 << 0` | `1` | `TREAT` |
| Research | `1 << 1` | `2` | `HRESCH` |
| Public health | `1 << 2` | `4` | `PUBHLTH` |
| Other participant-requested access | `1 << 3` | `8` | `PATRQT` |

Consent policies may contain a mask with one or more supported bits. Access requests must use exactly one valid purpose bit. Values such as `0`, `3`, `5`, or `16` are malformed and must fail before authorization.

## Scope Hash

`scopeHash` is a SHA-256 hash of canonical off-chain scope metadata. The metadata should contain only non-sensitive policy descriptors, such as:

- resource category code;
- approved dataset or artifact class;
- FHIR resource type where applicable;
- policy version namespace;
- institution-local data-domain code.

It must not contain patient names, raw IDs, emails, FHIR JSON, clinical text, or resource labels that identify a person. TypeScript helper `canonicalScopeHash` sorts metadata keys and hashes the JSON representation.

## Actor Set Commitment

`actorsRoot` is no longer accepted from callers. `VCEMConsent` accepts a bounded actor ID list, rejects zero IDs and duplicates, sorts IDs canonically, stores the sorted list by consent version, and derives:

```solidity
sha256(abi.encode(sortedActorIds))
```

Auditors can retrieve actor count and actor-at-index values and recompute the root independently.
