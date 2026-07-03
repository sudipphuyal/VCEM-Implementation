import { ethers } from "ethers";
import { pseudonymize } from "../pseudonymization/pseudonymize";
import { Purpose, canonicalScopeHash } from "../policy/model";
import { FixtureConsent, auditEventFromAccess, flattenSupportedProvision, purposeMaskFromFhir } from "./mapper";

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
  dataReferences: string[];
  period?: { start?: string; end?: string };
};

export function validateSupportedConsent(consent: FixtureConsent) {
  if (consent.resourceType !== "Consent") throw new Error("FHIR resource must be Consent");
  if (!consent.patient?.reference) throw new Error("Consent.patient is required");
  if (consent.dateTime && Number.isNaN(Date.parse(consent.dateTime))) throw new Error("Consent.dateTime must be an ISO timestamp");
  if (!["active", "draft", "inactive", "rejected"].includes(consent.status)) throw new Error(`unsupported Consent.status: ${consent.status}`);
  const flattened = flattenSupportedProvision(consent);
  const topActors = consent.performer?.map((actor) => actor.reference).filter(Boolean) ?? [];
  const actorRefs = [...topActors, ...flattened.actorReferences];
  if (consent.status !== "inactive" && consent.status !== "rejected" && actorRefs.length === 0) {
    throw new Error("at least one Consent.performer or supported provision.actor is required");
  }
  if (flattened.dataReferences.length === 0) throw new Error("at least one Consent.provision.data or Consent.subject reference is required");
  const purposeMask = purposeMaskFromFhir(consent);
  if (purposeMask === 0 && consent.status !== "inactive" && consent.status !== "rejected") {
    throw new Error("at least one supported Consent.provision.purpose is required");
  }
}

export function consentOperationFromStatus(status: string): VcemConsentOperation {
  if (status === "active") return "create";
  if (status === "draft") return "update";
  if (status === "inactive" || status === "rejected") return "revoke";
  throw new Error(`unsupported Consent.status: ${status}`);
}

export function canonicalDataHash(dataReferences: string[]) {
  return ethers.sha256(ethers.toUtf8Bytes(JSON.stringify({ fhirDataReferences: [...dataReferences].sort() })));
}

export function consentToVcemCall(consent: FixtureConsent, secret: string, operationOverride?: VcemConsentOperation): VcemConsentCall {
  validateSupportedConsent(consent);
  const operation = operationOverride ?? consentOperationFromStatus(consent.status);
  const flattened = flattenSupportedProvision(consent);
  const participantId = pseudonymize("fhir:patient", consent.patient!.reference!, secret);
  const actorRefs = [
    ...(consent.performer?.map((actor) => actor.reference).filter((value): value is string => !!value) ?? []),
    ...flattened.actorReferences,
  ];
  const actorIds = [...new Set(actorRefs)].map((reference) => pseudonymize("fhir:actor", reference, secret));
  const scopeHash = canonicalScopeHash({
    resourceType: "Consent",
    dataReferences: [...flattened.dataReferences].sort(),
    period: flattened.period ?? null,
  });
  return {
    operation,
    participantId,
    policy: {
      purposeMask: operation === "revoke" ? Purpose.RESEARCH : purposeMaskFromFhir(consent),
      scopeHash,
      zkConsentCommitment: ethers.ZeroHash,
    },
    actorIds: operation === "revoke" ? [] : actorIds,
    dataHash: canonicalDataHash(flattened.dataReferences),
    sourceDateTime: consent.dateTime,
    dataReferences: flattened.dataReferences,
    period: flattened.period,
  };
}

export async function executeVcemConsentLifecycle(consentContract: any, participantSigner: any, consent: FixtureConsent, secret: string) {
  const call = consentToVcemCall(consent, secret);
  if (call.operation === "create") {
    await consentContract.connect(participantSigner).createConsent(call.participantId, call.policy, call.actorIds);
  } else if (call.operation === "update") {
    await consentContract.connect(participantSigner).updateConsent(call.participantId, call.policy, call.actorIds);
  } else {
    await consentContract.connect(participantSigner).revokeConsent(call.participantId);
  }
  const version = await consentContract.getCurrentConsentVersion(call.participantId);
  return { call, version };
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
  outcome?: "0" | "4";
}) {
  return auditEventFromAccess(access);
}
