export type FixtureConsent = {
  resourceType: "Consent";
  status: string;
  patient?: { reference?: string };
  performer?: Array<{ reference?: string }>;
  dateTime?: string;
  provision?: {
    purpose?: Array<{ code?: string }>;
    action?: Array<{ code?: string }>;
    data?: Array<{ reference?: { reference?: string } }>;
  };
};

export function purposeMaskFromFhir(consent: FixtureConsent): number {
  const codes = consent.provision?.purpose?.map((purpose) => purpose.code) ?? [];
  let mask = 0;
  if (codes.includes("TREAT")) mask |= 1 << 0;
  if (codes.includes("HRESCH")) mask |= 1 << 1;
  if (codes.includes("PATRQT")) mask |= 1 << 2;
  return mask;
}

export function consentStatusFromFhir(status: string): "ACTIVE" | "REVOKED" | "NONE" {
  if (status === "active") return "ACTIVE";
  if (status === "inactive" || status === "rejected") return "REVOKED";
  return "NONE";
}

export function auditEventFromAccess(access: {
  requestId: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  consentHash: string;
  timestamp: number;
}) {
  return {
    resourceType: "AuditEvent",
    type: { system: "http://terminology.hl7.org/CodeSystem/audit-event-type", code: "rest" },
    action: "R",
    recorded: new Date(access.timestamp * 1000).toISOString(),
    outcome: "0",
    agent: [{ altId: access.requestorId, requestor: true }],
    entity: [
      { what: { identifier: { value: access.dataHash } }, detail: [{ type: "vcemConsentHash", valueString: access.consentHash }] },
      { what: { identifier: { value: access.participantId } }, detail: [{ type: "vcemRequestId", valueString: access.requestId }] },
    ],
  };
}
