# HL7 FHIR R4 Consent Fixture Validation Summary

## Scope

This report records peer-review/revision validation for the synthetic Consent fixtures supported by the VCEM FHIR adapter. It validates base HL7 FHIR R4 Consent conformance only. It does not claim live FHIR-server interoperability, SMART-on-FHIR interoperability, implementation-guide conformance, or production clinical interoperability.

The intentionally unsupported fixture `fixtures/fhir/consent-unsupported-nested.json` is excluded because the current adapter rejects deny provisions by design.

## Validator

- Validator: Official HL7 FHIR Validator
- Validator version: `6.10.1` (`Git# 2c71eeadf95f`, built `2026-08-06T22:12:24.240Z`)
- Base FHIR package: `hl7.fhir.r4.core#4.0.1`
- Base profile: `http://hl7.org/fhir/StructureDefinition/Consent`
- R4 terminology package loaded: `hl7.terminology.r4#6.2.0`
- Terminology server: disabled with `-tx n/a`; validation used packaged terminology resources rather than a live terminology server

The validator package summary also listed cross-version support packages including `hl7.fhir.xver-extensions#0.1.0`, `hl7.fhir.uv.extensions.r4#5.2.0`, `hl7.terminology#7.3.0`, `hl7.terminology.r5#7.1.0`, and related extension packages. The R4 terminology package relevant to this base-R4 validation was `hl7.terminology.r4#6.2.0`.

## Command

Each supported fixture was validated with:

```bash
java -jar .tools/fhir-validator/validator_cli.jar <fixture.json> \
  -version 4.0.1 \
  -ig hl7.fhir.r4.core#4.0.1 \
  -profile http://hl7.org/fhir/StructureDefinition/Consent \
  -tx n/a
```

## Results

- Supported Consent fixtures validated: 10
- Total errors: 0
- Total warnings: 12
- Total informational messages/notes: 0
- Result: all supported fixtures passed base HL7 FHIR R4 Consent validation with zero errors.

| Fixture | Errors | Warnings | Information | Pass |
| --- | ---: | ---: | ---: | --- |
| `fixtures/fhir/consent-active.json` | 0 | 1 | 0 | Yes |
| `fixtures/fhir/consent-actor-added.json` | 0 | 1 | 0 | Yes |
| `fixtures/fhir/consent-actor-removed.json` | 0 | 1 | 0 | Yes |
| `fixtures/fhir/consent-disallowed-scope.json` | 0 | 1 | 0 | Yes |
| `fixtures/fhir/consent-modified.json` | 0 | 1 | 0 | Yes |
| `fixtures/fhir/consent-multiple-actors.json` | 0 | 2 | 0 | Yes |
| `fixtures/fhir/consent-multiple-purposes.json` | 0 | 1 | 0 | Yes |
| `fixtures/fhir/consent-revoked.json` | 0 | 1 | 0 | Yes |
| `fixtures/fhir/consent-supported-nested.json` | 0 | 2 | 0 | Yes |
| `services/fhir-adapter/fixtures/consent.anonymized.json` | 0 | 1 | 0 | Yes |

## Warning Interpretation

All ten fixtures have the base FHIR best-practice warning `dom-6` because the synthetic fixtures omit narrative text. This is a warning, not a validation error.

Two fixtures also have an extensible-binding warning for `Consent.provision.actor.role` because the adapter represents provision actors as research practitioners using `http://terminology.hl7.org/CodeSystem/practitioner-role#researcher`, while the base element is extensibly bound to `http://hl7.org/fhir/ValueSet/security-role-type`. The role is preserved because it reflects the current VCEM experimental actor semantics and the binding is extensible.

## Corrections Made

Initial validation found base-R4 structural errors in supported fixtures. The following representation-level corrections were applied without changing the VCEM experimental meaning:

- Added required `Consent.scope` using `http://terminology.hl7.org/CodeSystem/consentscope#research`.
- Added required `Consent.category` using `http://terminology.hl7.org/CodeSystem/consentcategorycodes#research`.
- Added `Consent.policyRule` using `http://terminology.hl7.org/CodeSystem/consentpolicycodes#cric` to satisfy the base `ppc-1` policy/policyRule constraint.
- Added required `Consent.provision.data.meaning = "instance"` wherever `provision.data` is present.
- Added `Consent.provision.actor.role` with `http://terminology.hl7.org/CodeSystem/practitioner-role#researcher` wherever supported provision actors are present.
- Corrected `services/fhir-adapter/fixtures/consent.anonymized.json` so `Consent.provision.action` is represented as a `CodeableConcept` with `coding`, not as a bare `Coding`.

## Report Files

Complete validator outputs are stored in `reports/fhir-validation/`.
