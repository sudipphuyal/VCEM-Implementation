import { ethers } from "ethers";
import { pseudonymize } from "../pseudonymization/pseudonymize";
import { Purpose, canonicalScopeHash } from "../policy/model";
import { FixtureConsent, auditEventFromAccess, purposeMaskFromFhir } from "./mapper";

export type VcemConsentOperation = "create" | "update" | "revoke";

export type VcemConsentCall = {
  operation: VcemConsentOperation;
  participantId: string;
  policy: {
    purposeMask: number;
    scopeHash: string;
    zkConsentCommitment: string;
  };
  actorIds: string[];
  dataHash: string;
  sourceDateTime?: string;
};

export function validateSupportedConsent(consent: FixtureConsent) {
  if (consent.resourceType !== "Consent") throw new Error("FHIR resource must be Consent");
  if (!consent.patient?.reference) throw new Error("Consent.patient is required");
  if (consent.provision?.["provision" as keyof typeof consent.provision]) {
    throw new Error("nested Consent.provision is not supported by this fixture adapter");
  }
  const actorRefs = consent.performer?.map((actor) => actor.reference).filter(Boolean) ?? [];
  if (consent.status !== "inactive" && consent.status !== "rejected" && actorRefs.length === 0) {
    throw new Error("at least one Consent.performer is required for active/update consent");
  }
  const purposeMask = purposeMaskFromFhir(consent);
  if (purposeMask === 0 && consent.status === "active") {
    throw new Error("at least one supported Consent.provision.purpose is required");
  }
}

export function consentOperationFromStatus(status: string): VcemConsentOperation {
  if (status === "active") return "create";
  if (status === "draft") return "update";
  if (status === "inactive" || status === "rejected") return "revoke";
  throw new Error(`unsupported Consent.status: ${status}`);
}

export function consentToVcemCall(consent: FixtureConsent, secret: string, operationOverride?: VcemConsentOperation): VcemConsentCall {
  validateSupportedConsent(consent);
  const operation = operationOverride ?? consentOperationFromStatus(consent.status);
  const participantId = pseudonymize("fhir:patient", consent.patient!.reference!, secret);
  const actorIds = (consent.performer ?? [])
    .map((actor) => actor.reference)
    .filter((value): value is string => !!value)
    .map((reference) => pseudonymize("fhir:actor", reference, secret));
  const dataReference = consent.provision?.data?.[0]?.reference?.reference ?? "DocumentReference/unknown";
  const scopeHash = canonicalScopeHash({
    resourceType: "Consent",
    dataReference,
    period: consent.provision?.["period" as keyof typeof consent.provision] ?? null,
  });
  const dataHash = ethers.sha256(ethers.toUtf8Bytes(`fhir-data:${dataReference}`));
  return {
    operation,
    participantId,
    policy: {
      purposeMask: operation === "revoke" ? Purpose.RESEARCH : purposeMaskFromFhir(consent),
      scopeHash,
      zkConsentCommitment: ethers.ZeroHash,
    },
    actorIds,
    dataHash,
    sourceDateTime: consent.dateTime,
  };
}

export function accessAuthorizedToAuditEvent(access: {
  requestId: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  consentHash: string;
  consentVersion: string | number | bigint;
  purpose: string | number | bigint;
  timestamp: number;
}) {
  const event = auditEventFromAccess(access);
  return {
    ...event,
    purposeOfEvent: [{ coding: [{ system: "urn:vcem:purpose", code: String(access.purpose) }] }],
    entity: [
      ...event.entity,
      {
        detail: [
          { type: "vcemConsentVersion", valueString: String(access.consentVersion) },
          { type: "vcemConsentHash", valueString: access.consentHash },
        ],
      },
    ],
  };
}
