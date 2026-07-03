# FHIR R4 Mapping

This repository includes fixture-based FHIR R4 alignment only. It does not implement live production FHIR-server integration.

`services/fhir-adapter/vcemMapper.ts` converts anonymized Consent fixtures into VCEM lifecycle calls and the integration tests execute those calls against real `VCEMConsent` and `VCEMAudit` contracts.

| FHIR field | VCEM mapping |
| --- | --- |
| `Consent.patient` | Pseudonymous `participantId` derived off-chain. |
| `Consent.provision.purpose` | Canonical VCEM purpose mask bits: `TREAT=1`, `HRESCH=2`, `PUBHLTH=4`, `PATRQT=8`. |
| `Consent.performer` and supported `Consent.provision.actor` | Authorized actor pseudonymous IDs; actor root is computed on-chain by `VCEMConsent`. |
| `Consent.dateTime` | Consent fixture timestamp; on-chain timestamp is transaction time. |
| `Consent.status` | `active -> createConsent`, `draft -> updateConsent`, `inactive/rejected -> revokeConsent`. |
| `Consent.provision.period` | Included in canonical scope hash metadata when present. |
| `Consent.provision.data.reference` / `Consent.subject` | Canonical data-reference list and SHA-256 `dataHash`. |
| `AccessAuthorized` event | FHIR `AuditEvent` object with requestor agent, participant entity, data hash detail, purpose, consent hash/version extensions, request ID correlation, and outcome. |

## Supported Nested Subset

The adapter supports one level of nested `Consent.provision` when every provision is `type: "permit"` or has no explicit type. Supported nested fields are `purpose`, `actor`, `data`, and `period`. Nested values are flattened deterministically into the VCEM purpose mask, actor set, data-reference list, and scope hash.

## Assumptions

- Fixture identifiers are anonymized.
- FHIR purpose codes are mapped to the canonical VCEM bitmask shared with TypeScript policy code and Solidity tests.
- Raw FHIR JSON is not stored on-chain.
- Fixture execution requires the participant and performer pseudonymous IDs to be registered in `VCEMRegistry` before calling `VCEMConsent`.

## Example Consent

See `fixtures/fhir/consent-active.json`, `fixtures/fhir/consent-modified.json`, `fixtures/fhir/consent-revoked.json`, `fixtures/fhir/consent-supported-nested.json`, and actor add/remove fixtures.

## Example AuditEvent

`services/fhir-adapter/vcemMapper.ts` creates an anonymized AuditEvent object from a real `AccessAuthorized` event in `test/FHIRAdapter.ts`.
