# FHIR Limitations

FHIR support is fixture based. The repository does not implement live FHIR-server integration, SMART-on-FHIR authorization, or production profile validation.

Unsupported constructs are expected to be rejected by future adapter validation rather than silently mapped:

- nested consent provisions with conflicting allow/deny semantics;
- raw patient identifiers;
- inline clinical resources;
- free-text data labels that could identify a subject;
- multiple policy periods requiring temporal authorization logic.

The adapter exists to demonstrate deterministic mapping from anonymized FHIR R4 fixture fields to VCEM pseudonymous IDs, purpose masks, scope hashes, actor IDs, and AuditEvent-shaped output.
