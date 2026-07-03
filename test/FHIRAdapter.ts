import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { Purpose } from "../services/policy/model";
import { pseudonymize } from "../services/pseudonymization/pseudonymize";
import {
  accessAuthorizedToAuditEvent,
  consentToVcemCall,
  executeVcemConsentLifecycle,
} from "../services/fhir-adapter/vcemMapper";

const Role = {
  PARTICIPANT: 2,
  RESEARCHER: 3,
  DATA_CUSTODIAN: 4,
  POLICY_GATEWAY: 5,
  AUDITOR: 6,
};

const secret = "test-fhir-secret";

function fixture(name: string) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "fhir", name), "utf8"));
}

async function signAccessRequest(audit: any, signer: any, request: any) {
  const network = await ethers.provider.getNetwork();
  return signer.signTypedData(
    {
      name: "VCEMAudit",
      version: "1",
      chainId: network.chainId,
      verifyingContract: await audit.getAddress(),
    },
    {
      AccessRequest: [
        { name: "participantId", type: "bytes32" },
        { name: "requestorId", type: "bytes32" },
        { name: "dataHash", type: "bytes32" },
        { name: "scopeHash", type: "bytes32" },
        { name: "requestedPurpose", type: "uint8" },
        { name: "requestId", type: "bytes32" },
        { name: "clientTimestamp", type: "uint64" },
        { name: "requestExpiry", type: "uint64" },
        { name: "expectedConsentHash", type: "bytes32" },
      ],
    },
    request
  );
}

async function deployFhirVcem(patientRef = "Patient/anon-001") {
  const [admin, participant, researcherA, researcherB, gateway, custodian, auditor] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("VCEMRegistry");
  const registry = await Registry.deploy();
  const Consent = await ethers.getContractFactory("VCEMConsent");
  const consent = await Consent.deploy(await registry.getAddress());
  const Audit = await ethers.getContractFactory("VCEMAudit");
  const audit = await Audit.deploy(await registry.getAddress(), await consent.getAddress());
  const ids = {
    participant: pseudonymize("fhir:patient", patientRef, secret),
    researcherA: pseudonymize("fhir:actor", "Practitioner/researcher-a", secret),
    researcherB: pseudonymize("fhir:actor", "Practitioner/researcher-b", secret),
    gateway: ethers.keccak256(ethers.toUtf8Bytes(`fhir:gateway:${patientRef}`)),
    custodian: ethers.keccak256(ethers.toUtf8Bytes(`fhir:custodian:${patientRef}`)),
    auditor: ethers.keccak256(ethers.toUtf8Bytes(`fhir:auditor:${patientRef}`)),
  };
  await registry.registerActor(ids.participant, participant.address, Role.PARTICIPANT);
  await registry.registerActor(ids.researcherA, researcherA.address, Role.RESEARCHER);
  await registry.registerActor(ids.researcherB, researcherB.address, Role.RESEARCHER);
  await registry.registerActor(ids.gateway, gateway.address, Role.POLICY_GATEWAY);
  await registry.registerActor(ids.custodian, custodian.address, Role.DATA_CUSTODIAN);
  await registry.registerActor(ids.auditor, auditor.address, Role.AUDITOR);
  return { registry, consent, audit, participant, researcherA, researcherB, gateway, custodian, ids };
}

async function accessRequest(env: any, call: any, requestorId: string, seed: string, purpose = Purpose.RESEARCH, scopeHash = call.policy.scopeHash) {
  const latest = await ethers.provider.getBlock("latest");
  const current = await env.consent.getCurrentConsentVersion(call.participantId);
  return {
    participantId: call.participantId,
    requestorId,
    dataHash: call.dataHash,
    scopeHash,
    requestedPurpose: purpose,
    requestId: ethers.keccak256(ethers.toUtf8Bytes(`fhir:request:${seed}`)),
    clientTimestamp: latest!.timestamp,
    requestExpiry: latest!.timestamp + 3600,
    expectedConsentHash: current.consentHash,
  };
}

describe("FHIR VCEM adapter integration", function () {
  it("executes active, modified, and revoked Consent fixtures as real VCEM lifecycle calls", async function () {
    const env = await deployFhirVcem();
    const active = await executeVcemConsentLifecycle(env.consent, env.participant, fixture("consent-active.json"), secret);
    expect(active.call.operation).to.equal("create");
    expect(active.version.version).to.equal(1);
    expect(active.version.status).to.equal(1);

    const modified = await executeVcemConsentLifecycle(env.consent, env.participant, fixture("consent-modified.json"), secret);
    expect(modified.call.operation).to.equal("update");
    expect(modified.version.version).to.equal(2);
    expect(await env.consent.isActorAuthorized(active.call.participantId, 2, env.ids.researcherA)).to.equal(false);
    expect(await env.consent.isActorAuthorized(active.call.participantId, 2, env.ids.researcherB)).to.equal(true);

    const revoked = await executeVcemConsentLifecycle(env.consent, env.participant, fixture("consent-revoked.json"), secret);
    expect(revoked.call.operation).to.equal("revoke");
    expect(revoked.version.status).to.equal(3);
  });

  it("supports multiple actors, actor addition, and actor removal", async function () {
    const env = await deployFhirVcem();
    const active = await executeVcemConsentLifecycle(env.consent, env.participant, fixture("consent-active.json"), secret);
    expect(active.call.actorIds).to.have.members([env.ids.researcherA, env.ids.researcherB]);

    const removed = await executeVcemConsentLifecycle(env.consent, env.participant, fixture("consent-actor-removed.json"), secret);
    expect(removed.call.actorIds).to.deep.equal([env.ids.researcherB]);
    expect(await env.consent.isActorAuthorized(active.call.participantId, 2, env.ids.researcherA)).to.equal(false);

    const added = await executeVcemConsentLifecycle(env.consent, env.participant, fixture("consent-actor-added.json"), secret);
    expect(added.call.actorIds).to.have.members([env.ids.researcherA, env.ids.researcherB]);
    expect(await env.consent.isActorAuthorized(active.call.participantId, 3, env.ids.researcherA)).to.equal(true);
  });

  it("maps multiple purposes, supported nested provisions, and period metadata into deterministic policy values", async function () {
    const multi = consentToVcemCall(fixture("consent-multiple-purposes.json"), secret);
    expect(multi.policy.purposeMask).to.equal(Purpose.TREAT | Purpose.RESEARCH | Purpose.PUBHLTH);
    expect(multi.period?.start).to.equal("2026-01-01T00:00:00Z");

    const nested = consentToVcemCall(fixture("consent-supported-nested.json"), secret);
    expect(nested.policy.purposeMask).to.equal(Purpose.RESEARCH | Purpose.PUBHLTH);
    expect(nested.actorIds).to.have.length(2);
    expect(nested.dataReferences).to.have.members(["DocumentReference/anon-vitals", "DocumentReference/anon-labs"]);
  });

  it("authorizes permitted scope and rejects disallowed scope from real FHIR-driven consent", async function () {
    const env = await deployFhirVcem();
    const { call } = await executeVcemConsentLifecycle(env.consent, env.participant, fixture("consent-active.json"), secret);
    await env.audit.connect(env.custodian).registerDataHash(call.participantId, call.policy.scopeHash, call.dataHash);
    const allowed = await accessRequest(env, call, env.ids.researcherA, "allowed");
    await expect(env.audit.connect(env.gateway).authorizeAndLogAccess(allowed, await signAccessRequest(env.audit, env.researcherA, allowed))).to.emit(
      env.audit,
      "AccessAuthorized"
    );

    const denied = await accessRequest(env, call, env.ids.researcherA, "wrong-scope", Purpose.RESEARCH, ethers.keccak256(ethers.toUtf8Bytes("wrong-scope")));
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(denied, await signAccessRequest(env.audit, env.researcherA, denied))
    ).to.be.revertedWith("VCEMAudit: scope denied");
  });

  it("rejects unsupported nested deny provisions with clear validation errors", function () {
    expect(() => consentToVcemCall(fixture("consent-unsupported-nested.json"), secret)).to.throw("deny provisions are not supported");
  });

  it("generates FHIR AuditEvent output from a real AccessAuthorized event", async function () {
    const env = await deployFhirVcem();
    const { call } = await executeVcemConsentLifecycle(env.consent, env.participant, fixture("consent-active.json"), secret);
    await env.audit.connect(env.custodian).registerDataHash(call.participantId, call.policy.scopeHash, call.dataHash);
    const request = await accessRequest(env, call, env.ids.researcherA, "audit-event");
    const tx = await env.audit.connect(env.gateway).authorizeAndLogAccess(request, await signAccessRequest(env.audit, env.researcherA, request));
    const receipt = await tx.wait();
    const event = await env.audit.getAccessEvent(request.requestId);
    const auditEvent = accessAuthorizedToAuditEvent({
      requestId: request.requestId,
      participantId: request.participantId,
      requestorId: request.requestorId,
      dataHash: request.dataHash,
      consentHash: event.consentHash,
      consentVersion: event.consentVersion,
      purpose: event.purpose,
      timestamp: Number(event.timestamp),
    });
    const json = JSON.stringify(auditEvent);
    expect(receipt?.status).to.equal(1);
    expect(auditEvent.resourceType).to.equal("AuditEvent");
    expect(json).to.contain(request.requestorId);
    expect(json).to.contain(request.participantId);
    expect(json).to.contain(request.dataHash);
    expect(json).to.contain(event.consentHash);
    expect(json).to.contain(String(event.consentVersion));
    expect(json).to.contain(request.requestId);
    expect(auditEvent.outcome).to.equal("0");
  });
});
