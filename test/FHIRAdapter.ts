import { expect } from "chai";
import fs from "fs";
import path from "path";
import { Purpose } from "../services/policy/model";
import { accessAuthorizedToAuditEvent, consentToVcemCall } from "../services/fhir-adapter/vcemMapper";

function fixture(name: string) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "fhir", name), "utf8"));
}

describe("FHIR VCEM adapter", function () {
  const secret = "test-fhir-secret";

  it("maps active, modified, and revoked Consent fixtures to VCEM lifecycle calls", function () {
    const active = consentToVcemCall(fixture("consent-active.json"), secret);
    expect(active.operation).to.equal("create");
    expect(active.policy.purposeMask).to.equal(Purpose.RESEARCH | Purpose.PUBHLTH);
    expect(active.actorIds).to.have.length(2);

    const modified = consentToVcemCall(fixture("consent-modified.json"), secret);
    expect(modified.operation).to.equal("update");
    expect(modified.policy.purposeMask).to.equal(Purpose.RESEARCH);
    expect(modified.actorIds).to.have.length(1);

    const revoked = consentToVcemCall(fixture("consent-revoked.json"), secret);
    expect(revoked.operation).to.equal("revoke");
    expect(revoked.actorIds).to.have.length(0);
  });

  it("rejects unsupported nested consent provisions", function () {
    expect(() => consentToVcemCall(fixture("consent-unsupported-nested.json"), secret)).to.throw(
      "nested Consent.provision is not supported"
    );
  });

  it("generates AuditEvent output from a VCEM authorized access event", function () {
    const auditEvent = accessAuthorizedToAuditEvent({
      requestId: "0xrequest",
      participantId: "0xparticipant",
      requestorId: "0xrequestor",
      dataHash: "0xdata",
      consentHash: "0xconsent",
      consentVersion: 2,
      purpose: Purpose.RESEARCH,
      timestamp: 1767225600,
    });
    expect(auditEvent.resourceType).to.equal("AuditEvent");
    expect(JSON.stringify(auditEvent)).to.contain("vcemConsentVersion");
    expect(JSON.stringify(auditEvent)).to.contain("0xconsent");
  });
});
