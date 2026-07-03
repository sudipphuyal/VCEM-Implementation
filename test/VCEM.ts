import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import fs from "fs";
import path from "path";

const Role = {
  ADMIN: 1,
  PARTICIPANT: 2,
  RESEARCHER: 3,
  DATA_CUSTODIAN: 4,
  POLICY_GATEWAY: 5,
  AUDITOR: 6,
};

const ConsentStatus = {
  NONE: 0,
  ACTIVE: 1,
  SUPERSEDED: 2,
  REVOKED: 3,
};

const Purpose = {
  TREAT: 1 << 0,
  RESEARCH: 1 << 1,
  PUBHLTH: 1 << 2,
  OTHER: 1 << 3,
};

function id(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function hash(label: string) {
  return ethers.sha256(ethers.toUtf8Bytes(label));
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

async function deployVCEM() {
  const [admin, participant, researcher, gateway, custodian, auditor, outsider, addedResearcher] =
    await ethers.getSigners();

  const Registry = await ethers.getContractFactory("VCEMRegistry");
  const registry = await Registry.deploy();

  const Consent = await ethers.getContractFactory("VCEMConsent");
  const consent = await Consent.deploy(await registry.getAddress());

  const Audit = await ethers.getContractFactory("VCEMAudit");
  const audit = await Audit.deploy(await registry.getAddress(), await consent.getAddress());

  const participantId = id("participant:fixture");
  const researcherId = id("researcher:authorized");
  const gatewayId = id("gateway:fixture");
  const custodianId = id("custodian:fixture");
  const auditorId = id("auditor:fixture");
  const outsiderId = id("researcher:outsider");
  const addedResearcherId = id("researcher:added");

  await registry.registerActor(participantId, participant.address, Role.PARTICIPANT);
  await registry.registerActor(researcherId, researcher.address, Role.RESEARCHER);
  await registry.registerActor(gatewayId, gateway.address, Role.POLICY_GATEWAY);
  await registry.registerActor(custodianId, custodian.address, Role.DATA_CUSTODIAN);
  await registry.registerActor(auditorId, auditor.address, Role.AUDITOR);
  await registry.registerActor(outsiderId, outsider.address, Role.RESEARCHER);
  await registry.registerActor(addedResearcherId, addedResearcher.address, Role.RESEARCHER);

  return {
    admin,
    participant,
    researcher,
    gateway,
    custodian,
    auditor,
    outsider,
    addedResearcher,
    registry,
    consent,
    audit,
    participantId,
    researcherId,
    gatewayId,
    outsiderId,
    addedResearcherId,
  };
}

async function createConsentFixture(
  env: any,
  purposeMask = Purpose.RESEARCH | Purpose.PUBHLTH,
  scopeHash = hash("scope:vitals"),
  authorizedActors = [env.researcherId]
) {
  const policy = {
    purposeMask,
    scopeHash,
    zkConsentCommitment: hash("zk:commitment:fixture"),
  };
  await env.consent
    .connect(env.participant)
    .createConsent(env.participantId, policy, authorizedActors);
  const version = await env.consent.getCurrentConsentVersion(env.participantId);
  return { policy, version };
}

async function requestFor(env: any, overrides: any = {}) {
  const latest = await ethers.provider.getBlock("latest");
  const version = await env.consent.getCurrentConsentVersion(env.participantId);
  const { registerDataHash = true, ...requestOverrides } = overrides;
  const request = {
    participantId: env.participantId,
    requestorId: env.researcherId,
    dataHash: hash(`data:${requestOverrides.seed ?? "default"}`),
    scopeHash: hash("scope:vitals"),
    requestedPurpose: Purpose.RESEARCH,
    requestId: hash(`request:${requestOverrides.seed ?? Math.random().toString()}`),
    clientTimestamp: latest!.timestamp,
    requestExpiry: latest!.timestamp + 3600,
    expectedConsentHash: version.consentHash,
    ...requestOverrides,
  };
  if (registerDataHash) {
    await env.audit.connect(env.custodian).registerDataHash(request.participantId, request.scopeHash, request.dataHash);
  }
  return request;
}

describe("VCEM", function () {
  it("creates, updates, revokes, and preserves consent hash history", async function () {
    const env = await deployVCEM();
    const { version } = await createConsentFixture(env);

    expect(version.version).to.equal(1);
    expect(version.status).to.equal(ConsentStatus.ACTIVE);
    expect(await env.consent.getCurrentActiveConsentHash(env.participantId)).to.equal(version.consentHash);

    await env.consent.connect(env.participant).updateConsent(
      env.participantId,
      {
        purposeMask: Purpose.RESEARCH,
        scopeHash: hash("scope:vitals"),
        zkConsentCommitment: hash("zk:commitment:v2"),
      },
      [env.researcherId]
    );

    const oldVersion = await env.consent.getConsentVersion(env.participantId, 1);
    const newVersion = await env.consent.getCurrentConsentVersion(env.participantId);
    expect(oldVersion.status).to.equal(ConsentStatus.SUPERSEDED);
    expect(newVersion.previousConsentHash).to.equal(version.consentHash);
    expect(newVersion.consentHash).to.not.equal(version.consentHash);

    await env.consent.connect(env.participant).revokeConsent(env.participantId);
    const revoked = await env.consent.getCurrentConsentVersion(env.participantId);
    expect(revoked.status).to.equal(ConsentStatus.REVOKED);
    await expect(env.consent.getCurrentActiveConsentHash(env.participantId)).to.be.revertedWith(
      "VCEMConsent: no active consent"
    );

    const history = await env.consent.getConsentHashHistory(env.participantId);
    expect(history.length).to.equal(3);
  });

  it("authorizes and logs access with the exact active consent hash", async function () {
    const env = await deployVCEM();
    const { version } = await createConsentFixture(env);
    const request = await requestFor(env, { seed: "authorized" });
    const signature = await signAccessRequest(env.audit, env.researcher, request);

    await expect(env.audit.connect(env.gateway).authorizeAndLogAccess(request, signature))
      .to.emit(env.audit, "AccessAuthorized")
      .withArgs(
        request.requestId,
        env.participantId,
        env.researcherId,
        request.dataHash,
        request.scopeHash,
        request.requestedPurpose,
        version.version,
        version.consentHash,
        version.actorsRoot,
        anyValue
      );

    const event = await env.audit.getAccessEvent(request.requestId);
    expect(event.consentHash).to.equal(version.consentHash);
    expect(event.authorized).to.equal(true);
  });

  it("rejects replayed, expired, invalid-signature, outdated, unauthorized, revoked, scope, and purpose failures", async function () {
    const env = await deployVCEM();
    await createConsentFixture(env);

    const valid = await requestFor(env, { seed: "first" });
    await env.audit
      .connect(env.gateway)
      .authorizeAndLogAccess(valid, await signAccessRequest(env.audit, env.researcher, valid));
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(valid, await signAccessRequest(env.audit, env.researcher, valid))
    ).to.be.revertedWith("VCEMAudit: replayed request");

    const expired = await requestFor(env, { seed: "expired", requestExpiry: 1 });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(expired, await signAccessRequest(env.audit, env.researcher, expired))
    ).to.be.revertedWith("VCEMAudit: expired request");

    const badSignature = await requestFor(env, { seed: "bad-signature" });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(badSignature, await signAccessRequest(env.audit, env.outsider, badSignature))
    ).to.be.revertedWith("VCEMAudit: invalid signature");

    const outdated = await requestFor(env, { seed: "outdated" });
    await env.consent.connect(env.participant).updateConsent(
      env.participantId,
      {
        purposeMask: Purpose.RESEARCH,
        scopeHash: hash("scope:vitals"),
        zkConsentCommitment: hash("zk:commitment:v3"),
      },
      [env.researcherId]
    );
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(outdated, await signAccessRequest(env.audit, env.researcher, outdated))
    ).to.be.revertedWith("VCEMAudit: outdated consent hash");

    const scopeDenied = await requestFor(env, { seed: "scope", scopeHash: hash("scope:labs") });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(scopeDenied, await signAccessRequest(env.audit, env.researcher, scopeDenied))
    ).to.be.revertedWith("VCEMAudit: scope denied");

    const purposeDenied = await requestFor(env, { seed: "purpose", requestedPurpose: Purpose.OTHER });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(purposeDenied, await signAccessRequest(env.audit, env.researcher, purposeDenied))
    ).to.be.revertedWith("VCEMAudit: purpose denied");

    const invalidPurpose = await requestFor(env, { seed: "invalid-purpose", requestedPurpose: 3 });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(invalidPurpose, await signAccessRequest(env.audit, env.researcher, invalidPurpose))
    ).to.be.revertedWith("VCEMAudit: invalid purpose");

    const tamperedData = await requestFor(env, { seed: "tampered", registerDataHash: false });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(tamperedData, await signAccessRequest(env.audit, env.researcher, tamperedData))
    ).to.be.revertedWith("VCEMAudit: data hash denied");

    const actorDenied = await requestFor(env, { seed: "actor", requestorId: env.outsiderId });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(actorDenied, await signAccessRequest(env.audit, env.outsider, actorDenied))
    ).to.be.revertedWith("VCEMAudit: actor denied");

    await env.consent.connect(env.participant).revokeConsent(env.participantId);
    const revoked = await requestFor(env, {
      seed: "revoked",
      expectedConsentHash: (await env.consent.getCurrentConsentVersion(env.participantId)).consentHash,
    });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(revoked, await signAccessRequest(env.audit, env.researcher, revoked))
    ).to.be.revertedWith("VCEMAudit: consent inactive");
  });

  it("derives canonical actor roots from sorted unique actor sets", async function () {
    const envA = await deployVCEM();
    const rootAB = await envA.consent.computeActorSetRoot([envA.outsiderId, envA.researcherId]);
    await createConsentFixture(envA, Purpose.RESEARCH, hash("scope:vitals"), [envA.outsiderId, envA.researcherId]);
    const versionA = await envA.consent.getCurrentConsentVersion(envA.participantId);
    expect(versionA.actorsRoot).to.equal(rootAB);
    expect(await envA.consent.getConsentActorAt(envA.participantId, 1, 0)).to.equal(envA.researcherId);
    expect(await envA.consent.getConsentActorAt(envA.participantId, 1, 1)).to.equal(envA.outsiderId);

    const envB = await deployVCEM();
    await createConsentFixture(envB, Purpose.RESEARCH, hash("scope:vitals"), [envB.researcherId, envB.outsiderId]);
    const versionB = await envB.consent.getCurrentConsentVersion(envB.participantId);
    expect(versionB.actorsRoot).to.equal(versionA.actorsRoot);

    const envC = await deployVCEM();
    await createConsentFixture(envC, Purpose.RESEARCH, hash("scope:vitals"), [envC.researcherId]);
    const versionC = await envC.consent.getCurrentConsentVersion(envC.participantId);
    expect(versionC.actorsRoot).to.not.equal(versionA.actorsRoot);

    const envD = await deployVCEM();
    await expect(
      createConsentFixture(envD, Purpose.RESEARCH, hash("scope:vitals"), [envD.researcherId, envD.researcherId])
    ).to.be.revertedWith("CanonicalHash: duplicate actor");
  });

  it("keeps actor authorization version-specific across consent modifications", async function () {
    const env = await deployVCEM();
    await createConsentFixture(env, Purpose.RESEARCH, hash("scope:vitals"), [env.researcherId]);

    expect(await env.consent.isActorAuthorized(env.participantId, 1, env.researcherId)).to.equal(true);
    expect(await env.consent.isActorAuthorized(env.participantId, 1, env.addedResearcherId)).to.equal(false);

    await env.consent.connect(env.participant).updateConsent(
      env.participantId,
      {
        purposeMask: Purpose.RESEARCH,
        scopeHash: hash("scope:vitals"),
        zkConsentCommitment: hash("zk:commitment:actor-change"),
      },
      [env.addedResearcherId]
    );

    const latest = await env.consent.getCurrentConsentVersion(env.participantId);
    expect(latest.version).to.equal(2);
    expect(await env.consent.isActorAuthorized(env.participantId, 1, env.researcherId)).to.equal(true);
    expect(await env.consent.isActorAuthorized(env.participantId, 2, env.researcherId)).to.equal(false);
    expect(await env.consent.isActorAuthorized(env.participantId, 2, env.addedResearcherId)).to.equal(true);

    const removedRequest = await requestFor(env, { seed: "removed-after-update", expectedConsentHash: latest.consentHash });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(removedRequest, await signAccessRequest(env.audit, env.researcher, removedRequest))
    ).to.be.revertedWith("VCEMAudit: actor denied");

    const addedRequest = await requestFor(env, {
      seed: "added-after-update",
      requestorId: env.addedResearcherId,
      expectedConsentHash: latest.consentHash,
    });
    await expect(
      env.audit
        .connect(env.gateway)
        .authorizeAndLogAccess(addedRequest, await signAccessRequest(env.audit, env.addedResearcher, addedRequest))
    ).to.emit(env.audit, "AccessAuthorized");
  });

  it("enforces role revocation and pause controls", async function () {
    const env = await deployVCEM();
    await createConsentFixture(env);
    await env.registry.revokeRole(env.gatewayId, Role.POLICY_GATEWAY);

    const request = await requestFor(env, { seed: "revoked-gateway" });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(request, await signAccessRequest(env.audit, env.researcher, request))
    ).to.be.revertedWith("VCEMAudit: gateway only");

    await env.registry.grantRole(env.gatewayId, Role.POLICY_GATEWAY);
    await env.audit.pause();
    const paused = await requestFor(env, { seed: "paused", registerDataHash: false });
    await expect(
      env.audit.connect(env.gateway).authorizeAndLogAccess(paused, await signAccessRequest(env.audit, env.researcher, paused))
    ).to.be.revertedWith("VCEMAudit: paused");
  });

  it("generates exactly 60 consent-state authorization evidence rows", async function () {
    this.timeout(120000);
    const rows: any[] = [];
    const states = ["active", "updated", "revoked"];
    const purposeAllowed = [true, false];
    const actorAuthorized = [true, false];
    const scopeValid = [true, false];

    let caseIndex = 0;
    for (const state of states) {
      for (const purpose of purposeAllowed) {
        for (const actor of actorAuthorized) {
          for (const scope of scopeValid) {
            for (const repeat of [0, 1, 2]) {
              if (rows.length >= 60) break;
              const env = await deployVCEM();
              const initial = await createConsentFixture(env);
              let expectedConsentHash = initial.version.consentHash;
              if (state === "updated") {
                await env.consent.connect(env.participant).updateConsent(
                  env.participantId,
                  {
                    purposeMask: Purpose.RESEARCH,
                    scopeHash: hash("scope:vitals"),
                    zkConsentCommitment: hash("zk:matrix"),
                  },
                  [env.researcherId]
                );
                expectedConsentHash = (await env.consent.getCurrentConsentVersion(env.participantId)).consentHash;
              }
              if (state === "revoked") {
                await env.consent.connect(env.participant).revokeConsent(env.participantId);
                expectedConsentHash = (await env.consent.getCurrentConsentVersion(env.participantId)).consentHash;
              }

              const requestorId = actor ? env.researcherId : env.outsiderId;
              const signer = actor ? env.researcher : env.outsider;
              const request = await requestFor(env, {
                seed: `matrix:${caseIndex}:${repeat}`,
                requestorId,
                requestedPurpose: purpose ? Purpose.RESEARCH : Purpose.OTHER,
                scopeHash: scope ? hash("scope:vitals") : hash("scope:other"),
                expectedConsentHash,
              });
              const expectedDecision = state !== "revoked" && purpose && actor && scope ? "authorized" : "denied";
              let actualDecision = "denied";
              let transactionHash = "";
              let pass = false;
              try {
                const tx = await env.audit
                  .connect(env.gateway)
                  .authorizeAndLogAccess(request, await signAccessRequest(env.audit, signer, request));
                const receipt = await tx.wait();
                transactionHash = receipt?.hash ?? tx.hash;
                actualDecision = "authorized";
              } catch (_err) {
                actualDecision = "denied";
              }
              pass = actualDecision === expectedDecision;
              rows.push({
                consentState: state,
                consentVersion: String((await env.consent.getCurrentConsentVersion(env.participantId)).version),
                purpose: purpose ? "allowed" : "disallowed",
                actorRole: actor ? "authorized" : "unauthorized",
                scopeResult: scope ? "valid" : "invalid",
                expectedDecision,
                actualDecision,
                requestId: request.requestId,
                transactionHash,
                pass,
              });
              caseIndex++;
            }
          }
        }
      }
    }

    expect(rows).to.have.length(60);
    expect(rows.every((row) => row.pass)).to.equal(true);
    const outDir = path.join(process.cwd(), "evidence", "vcem");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "consent-state-matrix.json"), JSON.stringify(rows, null, 2));
    const header = Object.keys(rows[0]);
    const csv = [header.join(","), ...rows.map((row) => header.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\n");
    fs.writeFileSync(path.join(outDir, "consent-state-matrix.csv"), csv);
  });
});
