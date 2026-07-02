# FHIR R4 Mapping

This repository includes fixture-based FHIR mapping only. It does not implement live production FHIR-server integration.

| FHIR field | VCEM mapping |
| --- | --- |
| `Consent.patient` | Pseudonymous `participantId` derived off-chain. |
| `Consent.provision.purpose` | `purposeMask` bits. |
| `Consent.performer` | Authorized actor pseudonymous IDs and `actorsRoot`. |
| `Consent.dateTime` | Consent fixture timestamp; on-chain timestamp is transaction time. |
| `Consent.status` | Consent lifecycle status. |
| `Consent.provision.action` | Requested action/purpose classification. |
| `Consent.provision.data.reference` / `Consent.subject` | Off-chain artifact reference and/or `dataHash`. |
| `AccessAuthorized` event | FHIR `AuditEvent` fixture representation. |

## Assumptions

- Fixture identifiers are anonymized.
- FHIR purpose codes are mapped to a small demonstration bitmask.
- Raw FHIR JSON is not stored on-chain.

## Example Consent

See `services/fhir-adapter/fixtures/consent.anonymized.json`.

## Example AuditEvent

`services/fhir-adapter/mapper.ts` creates an anonymized AuditEvent-shaped object from an authorized access event.
