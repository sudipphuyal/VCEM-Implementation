import { Purpose } from "../policy/model";

export type FhirReference = { reference?: string };
export type FhirCoding = { system?: string; code?: string };

export type FixtureConsentProvision = {
  type?: "permit" | "deny";
  purpose?: FhirCoding[];
  action?: FhirCoding[];
  actor?: Array<{ reference?: FhirReference }>;
  data?: Array<{ reference?: FhirReference }>;
  period?: { start?: string; end?: string };
  provision?: FixtureConsentProvision[];
};

export type FixtureConsent = {
  resourceType: "Consent";
  status: string;
  patient?: FhirReference;
  subject?: FhirReference;
  performer?: FhirReference[];
  dateTime?: string;
  provision?: FixtureConsentProvision;
};

export type FlattenedProvision = {
  purposeCodes: string[];
  actorReferences: string[];
  dataReferences: string[];
  period?: { start?: string; end?: string };
};

export function purposeMaskFromCodes(codes: string[]) {
  let mask = 0;
  if (codes.includes("TREAT")) mask |= Purpose.TREAT;
  if (codes.includes("HRESCH")) mask |= Purpose.RESEARCH;
  if (codes.includes("PUBHLTH")) mask |= Purpose.PUBHLTH;
  if (codes.includes("PATRQT")) mask |= Purpose.OTHER;
  return mask;
}

export function purposeMaskFromFhir(consent: FixtureConsent): number {
  return purposeMaskFromCodes(flattenSupportedProvision(consent).purposeCodes);
}

export function consentStatusFromFhir(status: string): "ACTIVE" | "REVOKED" | "NONE" {
  if (status === "active" || status === "draft") return "ACTIVE";
  if (status === "inactive" || status === "rejected") return "REVOKED";
  return "NONE";
}

export function flattenSupportedProvision(consent: FixtureConsent): FlattenedProvision {
  const purposeCodes: string[] = [];
  const actorReferences: string[] = [];
  const dataReferences: string[] = [];
  let period: { start?: string; end?: string } | undefined;

  function visit(provision: FixtureConsentProvision | undefined, nested: boolean) {
    if (!provision) return;
    if (provision.type === "deny") throw new Error("unsupported Consent.provision: deny provisions are not supported");
    if (nested && provision.provision?.length) {
      throw new Error("unsupported Consent.provision: nested depth greater than one is not supported");
    }
    for (const purpose of provision.purpose ?? []) {
      if (purpose.code) purposeCodes.push(purpose.code);
    }
    for (const actor of provision.actor ?? []) {
      if (actor.reference?.reference) actorReferences.push(actor.reference.reference);
    }
    for (const data of provision.data ?? []) {
      if (data.reference?.reference) dataReferences.push(data.reference.reference);
    }
    if (provision.period) period = provision.period;
    for (const child of provision.provision ?? []) visit(child, true);
  }

  visit(consent.provision, false);
  if (consent.subject?.reference) dataReferences.push(consent.subject.reference);
  return {
    purposeCodes: [...new Set(purposeCodes)],
    actorReferences: [...new Set(actorReferences)],
    dataReferences: [...new Set(dataReferences)],
    period,
  };
}

export function auditEventFromAccess(access: {
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
  return {
    resourceType: "AuditEvent",
    type: { system: "http://terminology.hl7.org/CodeSystem/audit-event-type", code: "rest" },
    action: "R",
    recorded: new Date(access.timestamp * 1000).toISOString(),
    outcome: access.outcome ?? "0",
    purposeOfEvent: [{ coding: [{ system: "urn:vcem:purpose", code: String(access.purpose) }] }],
    agent: [{ altId: access.requestorId, requestor: true }],
    entity: [
      {
        role: { coding: [{ system: "urn:vcem:entity-role", code: "participant" }] },
        what: { identifier: { value: access.participantId } },
        detail: [{ type: "vcemRequestId", valueString: access.requestId }],
      },
      {
        role: { coding: [{ system: "urn:vcem:entity-role", code: "data-artifact" }] },
        what: { identifier: { value: access.dataHash } },
        detail: [
          { type: "vcemDataHash", valueString: access.dataHash },
          { type: "vcemConsentHash", valueString: access.consentHash },
          { type: "vcemConsentVersion", valueString: String(access.consentVersion) },
        ],
      },
    ],
    extension: [
      { url: "urn:vcem:requestId", valueIdentifier: { value: access.requestId } },
      { url: "urn:vcem:consentHash", valueString: access.consentHash },
      { url: "urn:vcem:consentVersion", valueString: String(access.consentVersion) },
    ],
  };
}
