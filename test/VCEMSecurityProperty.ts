import { expect } from "chai";
import { ethers } from "hardhat";
import fc from "fast-check";

const PROPERTY_SEED = 20260807;
const PROPERTY_RUNS = 100;

const Role = {
  ADMIN: 1,
  PARTICIPANT: 2,
  RESEARCHER: 3,
  DATA_CUSTODIAN: 4,
  POLICY_GATEWAY: 5,
  AUDITOR: 6,
};

const ConsentStatus = {
  ACTIVE: 1,
  REVOKED: 3,
};

const Purpose = {
  TREAT: 1 << 0,
  RESEARCH: 1 << 1,
  PUBHLTH: 1 << 2,
  OTHER: 1 << 3,
};

const singlePurposes = [Purpose.TREAT, Purpose.RESEARCH, Purpose.PUBHLTH, Purpose.OTHER] as const;
const validMasks = Array.from({ length: 15 }, (_, i) => i + 1);

function id(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function hash(label: string) {
  return ethers.sha256(ethers.toUtf8Bytes(label));
}

const nonZeroBytes32Arb = fc
  .uint8Array({ minLength: 32, maxLength: 32 })
  .filter((bytes) => bytes.some((b) => b !== 0))
  .map((bytes) => ethers.hexlify(bytes));

const purposeArb = fc.constantFrom(...singlePurposes);
const purposeMaskArb = fc.constantFrom(...validMasks);

type AccessRequest = {
  participantId: string;
  requestorId: string;
  dataHash: string;
  scopeHash: string;
  requestedPurpose: number;
  requestId: string;
  clientTimestamp: number;
  requestExpiry: number;
  expectedConsentHash: string;
};

async function signAccessRequest(audit: any, signer: any, request: AccessRequest) {
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

async function deployVCEM(label: string) {
  const [admin, participant, researcher, gateway, custodian, auditor, outsider, addedResearcher, rotatedParticipant] =
    await ethers.getSigners();

  const Registry = await ethers.getContractFactory("VCEMRegistry");
  const registry = await Registry.deploy();
  const Consent = await ethers.getContractFactory("VCEMConsent");
  const consent = await Consent.deploy(await registry.getAddress());
  const Audit = await ethers.getContractFactory("VCEMAudit");
  const audit = await Audit.deploy(await registry.getAddress(), await consent.getAddress());

  const ids = {
    participant: id(`${label}:participant`),
    researcher: id(`${label}:researcher`),
    gateway: id(`${label}:gateway`),
    custodian: id(`${label}:custodian`),
    auditor: id(`${label}:auditor`),
    outsider: id(`${label}:outsider`),
    addedResearcher: id(`${label}:addedResearcher`),
  };

  await registry.registerActor(ids.participant, participant.address, Role.PARTICIPANT);
  await registry.registerActor(ids.researcher, researcher.address, Role.RESEARCHER);
  await registry.registerActor(ids.gateway, gateway.address, Role.POLICY_GATEWAY);
  await registry.registerActor(ids.custodian, custodian.address, Role.DATA_CUSTODIAN);
  await registry.registerActor(ids.auditor, auditor.address, Role.AUDITOR);
  await registry.registerActor(ids.outsider, outsider.address, Role.RESEARCHER);
  await registry.registerActor(ids.addedResearcher, addedResearcher.address, Role.RESEARCHER);

  return {
    admin,
    participant,
    researcher,
    gateway,
    custodian,
    auditor,
    outsider,
    addedResearcher,
    rotatedParticipant,
    registry,
    consent,
    audit,
    ids,
  };
}

async function latestTimestamp() {
  const latest = await ethers.provider.getBlock("latest");
  return latest!.timestamp;
}

async function createConsent(env: any, purposeMask: number, scopeHash: string, actors = [env.ids.researcher]) {
  await env.consent.connect(env.participant).createConsent(
    env.ids.participant,
    { purposeMask, scopeHash, zkConsentCommitment: hash(`zk:${scopeHash}:${purposeMask}`) },
    actors
  );
  return env.consent.getCurrentConsentVersion(env.ids.participant);
}

async function updateConsent(env: any, purposeMask: number, scopeHash: string, actors = [env.ids.researcher], label = "update") {
  await env.consent.connect(env.participant).updateConsent(
    env.ids.participant,
    { purposeMask, scopeHash, zkConsentCommitment: hash(`zk:${label}:${scopeHash}:${purposeMask}`) },
    actors
  );
  return env.consent.getCurrentConsentVersion(env.ids.participant);
}

async function registerData(env: any, scopeHash: string, dataHash: string) {
  await env.audit.connect(env.custodian).registerDataHash(env.ids.participant, scopeHash, dataHash);
}

async function requestFor(env: any, input: Partial<AccessRequest> & { seed: string; requestorId?: string } = { seed: "request" }): Promise<AccessRequest> {
  const current = await env.consent.getCurrentConsentVersion(env.ids.participant);
  const ts = await latestTimestamp();
  return {
    participantId: env.ids.participant,
    requestorId: input.requestorId ?? env.ids.researcher,
    dataHash: input.dataHash ?? hash(`data:${input.seed}`),
    scopeHash: input.scopeHash ?? current.scopeHash,
    requestedPurpose: input.requestedPurpose ?? Purpose.RESEARCH,
    requestId: input.requestId ?? hash(`request:${input.seed}`),
    clientTimestamp: input.clientTimestamp ?? ts,
    requestExpiry: input.requestExpiry ?? ts + 3600,
    expectedConsentHash: input.expectedConsentHash ?? current.consentHash,
  };
}

async function expectAuthorizationSucceeds(env: any, request: AccessRequest, signer = env.researcher) {
  const signature = await signAccessRequest(env.audit, signer, request);
  await expect(env.audit.connect(env.gateway).authorizeAndLogAccess(request, signature)).to.emit(env.audit, "AccessAuthorized");
}

async function expectAuthorizationFails(env: any, request: AccessRequest, signer = env.researcher, signature?: string) {
  const sig = signature ?? (await signAccessRequest(env.audit, signer, request));
  await expect(env.audit.connect(env.gateway).authorizeAndLogAccess(request, sig)).to.be.reverted;
}

async function expectStateUnchanged(consent: any, participantId: string, before: any) {
  const after = await consent.getCurrentConsentVersion(participantId);
  expect(after.version).to.equal(before.version);
  expect(after.status).to.equal(before.status);
  expect(after.consentHash).to.equal(before.consentHash);
}

async function expectChainLink(consent: any, participantId: string, versionNumber: number, previousHash: string, status: number) {
  const version = await consent.getConsentVersion(participantId, versionNumber);
  expect(version.version).to.equal(versionNumber);
  expect(version.previousConsentHash).to.equal(previousHash);
  expect(version.status).to.equal(status);
  const currentNumber = await consent.getCurrentVersionNumber(participantId);
  expect(currentNumber).to.be.greaterThanOrEqual(versionNumber);
  return version;
}

describe("VCEM security property invariants", function () {
  this.timeout(120_000);

  it("non-current consent cannot authorize", async function () {
    await fc.assert(
      fc.asyncProperty(purposeMaskArb, purposeArb, nonZeroBytes32Arb, nonZeroBytes32Arb, nonZeroBytes32Arb, async (mask, purpose, scopeV1, scopeV2, dataHash) => {
        fc.pre(scopeV1 !== scopeV2);
        fc.pre((mask & purpose) !== 0);
        const env = await deployVCEM(`non-current:${mask}:${purpose}:${scopeV1}`);
        const v1 = await createConsent(env, mask, scopeV1);
        const v2 = await updateConsent(env, mask | purpose, scopeV2, [env.ids.researcher], "v2");
        await registerData(env, scopeV2, dataHash);

        const currentRequest = await requestFor(env, { seed: `current:${dataHash}`, dataHash, scopeHash: scopeV2, requestedPurpose: purpose });
        await expectAuthorizationSucceeds(env, currentRequest);

        const staleRequest = await requestFor(env, {
          seed: `stale:${dataHash}`,
          dataHash,
          scopeHash: scopeV2,
          requestedPurpose: purpose,
          expectedConsentHash: v1.consentHash,
        });
        expect(v2.consentHash).to.not.equal(v1.consentHash);
        await expectAuthorizationFails(env, staleRequest);
      }),
      { seed: PROPERTY_SEED + 1, numRuns: PROPERTY_RUNS }
    );
  });

  it("revoked consent cannot authorize", async function () {
    await fc.assert(
      fc.asyncProperty(purposeMaskArb, purposeArb, nonZeroBytes32Arb, nonZeroBytes32Arb, fc.integer({ min: 0, max: 2 }), async (mask, purpose, scopeHash, dataHash, updates) => {
        fc.pre((mask & purpose) !== 0);
        const env = await deployVCEM(`revoked:${mask}:${purpose}:${updates}`);
        await createConsent(env, mask, scopeHash);
        for (let i = 0; i < updates; i++) {
          await updateConsent(env, mask, scopeHash, [env.ids.researcher], `u${i}`);
        }
        await registerData(env, scopeHash, dataHash);
        await env.consent.connect(env.participant).revokeConsent(env.ids.participant);
        const revoked = await env.consent.getCurrentConsentVersion(env.ids.participant);
        expect(revoked.status).to.equal(ConsentStatus.REVOKED);

        const request = await requestFor(env, {
          seed: `post-revoke:${dataHash}`,
          dataHash,
          scopeHash,
          requestedPurpose: purpose,
          expectedConsentHash: revoked.consentHash,
        });
        await expectAuthorizationFails(env, request);
        expect(await env.audit.accessEventCount()).to.equal(0);
      }),
      { seed: PROPERTY_SEED + 2, numRuns: PROPERTY_RUNS }
    );
  });

  it("used requestId cannot succeed again", async function () {
    await fc.assert(
      fc.asyncProperty(purposeArb, nonZeroBytes32Arb, nonZeroBytes32Arb, async (purpose, scopeHash, dataHash) => {
        const env = await deployVCEM(`replay:${purpose}:${dataHash}`);
        await createConsent(env, purpose, scopeHash);
        await registerData(env, scopeHash, dataHash);
        const request = await requestFor(env, { seed: `replay:${dataHash}`, dataHash, scopeHash, requestedPurpose: purpose });
        await expectAuthorizationSucceeds(env, request);
        expect(await env.audit.usedRequestIds(request.requestId)).to.equal(true);

        await expectAuthorizationFails(env, request);
        const altered = { ...request, dataHash: hash(`altered:${dataHash}`) };
        await expectAuthorizationFails(env, altered);
        expect(await env.audit.accessEventCount()).to.equal(1);
      }),
      { seed: PROPERTY_SEED + 3, numRuns: PROPERTY_RUNS }
    );
  });

  it("modification of any signed field invalidates authorization", async function () {
    await fc.assert(
      fc.asyncProperty(purposeArb, nonZeroBytes32Arb, nonZeroBytes32Arb, nonZeroBytes32Arb, async (purpose, scopeHash, dataHash, replacement) => {
        fc.pre(replacement !== scopeHash && replacement !== dataHash);
        const env = await deployVCEM(`signed-fields:${purpose}:${dataHash}`);
        await createConsent(env, purpose, scopeHash);
        await registerData(env, scopeHash, dataHash);
        const request = await requestFor(env, { seed: `signed:${dataHash}`, dataHash, scopeHash, requestedPurpose: purpose });
        const signature = await signAccessRequest(env.audit, env.researcher, request);
        const ts = await latestTimestamp();
        const mutations: Array<Partial<AccessRequest>> = [
          { participantId: replacement },
          { requestorId: env.ids.addedResearcher },
          { dataHash: replacement },
          { scopeHash: replacement },
          { requestedPurpose: singlePurposes.find((p) => p !== purpose)! },
          { requestId: replacement },
          { clientTimestamp: ts + 7 },
          { requestExpiry: ts + 7200 },
          { expectedConsentHash: replacement },
        ];

        for (const mutation of mutations) {
          const mutated = { ...request, ...mutation, requestId: mutation.requestId ?? request.requestId };
          await expectAuthorizationFails(env, mutated, env.researcher, signature);
        }
        expect(await env.audit.accessEventCount()).to.equal(0);
      }),
      { seed: PROPERTY_SEED + 4, numRuns: PROPERTY_RUNS }
    );
  });

  it("actor, purpose, scope, and data hash resolve against the same current consent state", async function () {
    await fc.assert(
      fc.asyncProperty(nonZeroBytes32Arb, nonZeroBytes32Arb, nonZeroBytes32Arb, nonZeroBytes32Arb, async (scopeV1, scopeV2, dataV1, dataV2) => {
        fc.pre(scopeV1 !== scopeV2 && dataV1 !== dataV2);
        const env = await deployVCEM(`same-state:${scopeV1}:${scopeV2}`);
        const v1 = await createConsent(env, Purpose.RESEARCH, scopeV1, [env.ids.researcher]);
        const v2 = await updateConsent(env, Purpose.OTHER, scopeV2, [env.ids.addedResearcher], "replace-policy");
        await registerData(env, scopeV1, dataV1);
        await registerData(env, scopeV2, dataV2);

        const validCurrent = await requestFor(env, {
          seed: `valid-current:${dataV2}`,
          requestorId: env.ids.addedResearcher,
          dataHash: dataV2,
          scopeHash: scopeV2,
          requestedPurpose: Purpose.OTHER,
          expectedConsentHash: v2.consentHash,
        });
        await expectAuthorizationSucceeds(env, validCurrent, env.addedResearcher);

        const staleActor = { ...validCurrent, requestId: hash(`stale-actor:${dataV2}`), requestorId: env.ids.researcher };
        await expectAuthorizationFails(env, staleActor, env.researcher);
        const stalePurpose = { ...validCurrent, requestId: hash(`stale-purpose:${dataV2}`), requestedPurpose: Purpose.RESEARCH };
        await expectAuthorizationFails(env, stalePurpose, env.addedResearcher);
        const staleScope = { ...validCurrent, requestId: hash(`stale-scope:${dataV2}`), scopeHash: scopeV1 };
        await expectAuthorizationFails(env, staleScope, env.addedResearcher);
        const staleData = { ...validCurrent, requestId: hash(`stale-data:${dataV2}`), dataHash: dataV1 };
        await expectAuthorizationFails(env, staleData, env.addedResearcher);
        const staleHash = { ...validCurrent, requestId: hash(`stale-hash:${dataV2}`), expectedConsentHash: v1.consentHash };
        await expectAuthorizationFails(env, staleHash, env.addedResearcher);
        expect(await env.audit.accessEventCount()).to.equal(1);
      }),
      { seed: PROPERTY_SEED + 5, numRuns: PROPERTY_RUNS }
    );
  });

  it("unauthorized state transitions cannot alter consent", async function () {
    await fc.assert(
      fc.asyncProperty(purposeMaskArb, nonZeroBytes32Arb, nonZeroBytes32Arb, async (mask, scopeHash, nextScopeHash) => {
        fc.pre(scopeHash !== nextScopeHash);
        const env = await deployVCEM(`unauthorized:${mask}:${scopeHash}`);
        const policy = { purposeMask: mask, scopeHash, zkConsentCommitment: hash(`zk:unauthorized:${scopeHash}`) };

        await expect(env.consent.connect(env.outsider).createConsent(env.ids.participant, policy, [env.ids.researcher])).to.be.reverted;
        const empty = await env.consent.getCurrentConsentVersion(env.ids.participant);
        expect(empty.version).to.equal(0);

        await createConsent(env, mask, scopeHash);
        const before = await env.consent.getCurrentConsentVersion(env.ids.participant);
        const nextPolicy = { purposeMask: mask, scopeHash: nextScopeHash, zkConsentCommitment: hash(`zk:next:${nextScopeHash}`) };
        await expect(env.consent.connect(env.outsider).updateConsent(env.ids.participant, nextPolicy, [env.ids.researcher])).to.be.reverted;
        await expectStateUnchanged(env.consent, env.ids.participant, before);
        await expect(env.consent.connect(env.outsider).revokeConsent(env.ids.participant)).to.be.reverted;
        await expectStateUnchanged(env.consent, env.ids.participant, before);

        await env.registry.updateWallet(env.ids.participant, env.rotatedParticipant.address);
        await expect(env.consent.connect(env.participant).updateConsent(env.ids.participant, nextPolicy, [env.ids.researcher])).to.be.reverted;
        await expectStateUnchanged(env.consent, env.ids.participant, before);

        await env.registry.revokeActor(env.ids.participant);
        await expect(env.consent.connect(env.rotatedParticipant).revokeConsent(env.ids.participant)).to.be.reverted;
        await expectStateUnchanged(env.consent, env.ids.participant, before);
      }),
      { seed: PROPERTY_SEED + 6, numRuns: PROPERTY_RUNS }
    );
  });

  it("consent version chain cannot fork under permitted calls", async function () {
    await fc.assert(
      fc.asyncProperty(purposeMaskArb, nonZeroBytes32Arb, fc.array(nonZeroBytes32Arb, { minLength: 1, maxLength: 4 }), fc.boolean(), async (mask, initialScope, updateScopes, revoke) => {
        const env = await deployVCEM(`chain:${mask}:${initialScope}:${updateScopes.length}:${revoke}`);
        let previousHash = ethers.ZeroHash;
        let versionNumber = 1;
        const created = await createConsent(env, mask, initialScope);
        expect(created.version).to.equal(versionNumber);
        expect(created.previousConsentHash).to.equal(previousHash);
        previousHash = created.consentHash;

        await expect(env.consent.connect(env.participant).createConsent(
          env.ids.participant,
          { purposeMask: mask, scopeHash: initialScope, zkConsentCommitment: hash("zk:duplicate-create") },
          [env.ids.researcher]
        )).to.be.reverted;

        for (const [index, scopeHash] of updateScopes.entries()) {
          versionNumber++;
          const updated = await updateConsent(env, mask, scopeHash, [env.ids.researcher], `chain:${index}`);
          expect(updated.version).to.equal(versionNumber);
          expect(updated.previousConsentHash).to.equal(previousHash);
          previousHash = updated.consentHash;
          expect(await env.consent.getCurrentVersionNumber(env.ids.participant)).to.equal(versionNumber);
        }

        if (revoke) {
          versionNumber++;
          await env.consent.connect(env.participant).revokeConsent(env.ids.participant);
          const revoked = await env.consent.getCurrentConsentVersion(env.ids.participant);
          expect(revoked.version).to.equal(versionNumber);
          expect(revoked.status).to.equal(ConsentStatus.REVOKED);
          expect(revoked.previousConsentHash).to.equal(previousHash);
          await expect(env.consent.connect(env.participant).updateConsent(
            env.ids.participant,
            { purposeMask: mask, scopeHash: initialScope, zkConsentCommitment: hash("zk:post-revoke") },
            [env.ids.researcher]
          )).to.be.reverted;
        }

        for (let i = 1; i <= versionNumber; i++) {
          const expectedPrevious = i === 1 ? ethers.ZeroHash : (await env.consent.getConsentVersion(env.ids.participant, i - 1)).consentHash;
          const expectedStatus = revoke && i === versionNumber ? ConsentStatus.REVOKED : ConsentStatus.ACTIVE;
          await expectChainLink(env.consent, env.ids.participant, i, expectedPrevious, expectedStatus);
        }
      }),
      { seed: PROPERTY_SEED + 7, numRuns: PROPERTY_RUNS }
    );
  });
});
