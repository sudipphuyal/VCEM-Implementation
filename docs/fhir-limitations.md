# FHIR Limitations

FHIR support is fixture based. The repository does not implement live FHIR-server integration, SMART-on-FHIR authorization, or production profile validation.

Unsupported constructs are rejected by adapter validation rather than silently mapped:

- deny provisions or nested provisions with conflicting allow/deny semantics;
- nested depth greater than one;
- raw patient identifiers;
- inline clinical resources;
- free-text data labels that could identify a subject;
- multiple policy periods requiring temporal authorization logic.

The adapter exists to demonstrate deterministic mapping from anonymized FHIR R4 fixture fields to real VCEM lifecycle operations, pseudonymous IDs, purpose masks, scope hashes, actor IDs, data hashes, and AuditEvent output.
