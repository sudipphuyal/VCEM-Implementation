import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

const Role = {
  PARTICIPANT: 2,
  RESEARCHER: 3,
  DATA_CUSTODIAN: 4,
  POLICY_GATEWAY: 5,
  AUDITOR: 6,
};

const Purpose = {
  TREAT: 1,
  RESEARCH: 2,
  PUBHLTH: 4,
  OTHER: 8,
  UNSUPPORTED: 16,
};

type Lifecycle = "active-initial" | "modified-active" | "revoked";
type ActorConfig = "authorized" | "unauthorized" | "removed-after-modification" | "newly-added" | "revoked-or-mismatched";
type PurposeName = "treatment" | "research" | "public-health" | "other-disallowed";
type RequestKind = "nominal" | "adversarial";

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

async function deploy() {
  const [admin, participant, authorized, gateway, custodian, auditor, unauthorized, newlyAdded, revokedActor] =
    await ethers.getSigners();
  const Registry = await ethers.getContractFactory("VCEMRegistry");
  const registry = await Registry.deploy();
  const Consent = await ethers.getContractFactory("VCEMConsent");
  const consent = await Consent.deploy(await registry.getAddress());
  const Audit = await ethers.getContractFactory("VCEMAudit");
  const audit = await Audit.deploy(await registry.getAddress(), await consent.getAddress());

  const ids = {
    participant: id("matrix:participant"),
    authorized: id("matrix:authorized"),
    gateway: id("matrix:gateway"),
    custodian: id("matrix:custodian"),
    auditor: id("matrix:auditor"),
    unauthorized: id("matrix:unauthorized"),
    newlyAdded: id("matrix:newly-added"),
    revokedActor: id("matrix:revoked-actor"),
  };

  await registry.registerActor(ids.participant, participant.address, Role.PARTICIPANT);
  await registry.registerActor(ids.authorized, authorized.address, Role.RESEARCHER);
  await registry.registerActor(ids.gateway, gateway.address, Role.POLICY_GATEWAY);
  await registry.registerActor(ids.custodian, custodian.address, Role.DATA_CUSTODIAN);
  await registry.registerActor(ids.auditor, auditor.address, Role.AUDITOR);
  await registry.registerActor(ids.unauthorized, unauthorized.address, Role.RESEARCHER);
  await registry.registerActor(ids.newlyAdded, newlyAdded.address, Role.RESEARCHER);
  await registry.registerActor(ids.revokedActor, revokedActor.address, Role.RESEARCHER);

  return {
    admin,
    participant,
    authorized,
    gateway,
    custodian,
    auditor,
    unauthorized,
    newlyAdded,
    revokedActor,
    registry,
    consent,
    audit,
    ids,
  };
}

function purposeValue(name: PurposeName) {
  if (name === "treatment") return Purpose.TREAT;
  if (name === "research") return Purpose.RESEARCH;
  if (name === "public-health") return Purpose.PUBHLTH;
  return Purpose.OTHER;
}

function purposeAllowed(name: PurposeName) {
  return name !== "other-disallowed";
}

async function setupCase(env: any, lifecycle: Lifecycle, actorConfig: ActorConfig) {
  const scopeHash = hash("scope:matrix:vitals");
  const initialActors =
    actorConfig === "newly-added"
      ? [env.ids.authorized]
      : actorConfig === "unauthorized"
        ? [env.ids.authorized]
        : actorConfig === "revoked-or-mismatched"
          ? [env.ids.revokedActor]
          : [env.ids.authorized];
  const policy = {
    purposeMask: Purpose.TREAT | Purpose.RESEARCH | Purpose.PUBHLTH,
    scopeHash,
    zkConsentCommitment: hash("zk:matrix:initial"),
  };
  await env.consent.connect(env.participant).createConsent(env.ids.participant, policy, initialActors);

  if (lifecycle === "modified-active") {
    const modifiedActors =
      actorConfig === "removed-after-modification"
        ? [env.ids.newlyAdded]
        : actorConfig === "newly-added"
          ? [env.ids.authorized, env.ids.newlyAdded]
          : initialActors;
    await env.consent.connect(env.participant).updateConsent(
      env.ids.participant,
      {
        purposeMask: Purpose.TREAT | Purpose.RESEARCH | Purpose.PUBHLTH,
        scopeHash,
        zkConsentCommitment: hash("zk:matrix:modified"),
      },
      modifiedActors
    );
  }

  if (actorConfig === "revoked-or-mismatched") {
    await env.registry.revokeActor(env.ids.revokedActor);
  }

  if (lifecycle === "revoked") {
    await env.consent.connect(env.participant).revokeConsent(env.ids.participant);
  }

  return scopeHash;
}

function actorFor(env: any, actorConfig: ActorConfig) {
  if (actorConfig === "unauthorized") return { id: env.ids.unauthorized, signer: env.unauthorized };
  if (actorConfig === "newly-added") return { id: env.ids.newlyAdded, signer: env.newlyAdded };
  if (actorConfig === "revoked-or-mismatched") return { id: env.ids.revokedActor, signer: env.revokedActor };
  return { id: env.ids.authorized, signer: env.authorized };
}

function expectedNominal(lifecycle: Lifecycle, actorConfig: ActorConfig, purpose: PurposeName) {
  if (lifecycle === "revoked") return false;
  if (!purposeAllowed(purpose)) return false;
  if (actorConfig === "unauthorized" || actorConfig === "revoked-or-mismatched") return false;
  if (actorConfig === "newly-added" && lifecycle === "active-initial") return false;
  if (actorConfig === "removed-after-modification" && lifecycle === "modified-active") return false;
  return true;
}

function adversarialOverride(caseId: number, kindIndex: number, request: any, currentHash: string) {
  const selector = caseId % 9;
  if (selector === 0) return { request: { ...request, expectedConsentHash: hash("stale:consent") }, label: "stale-consent-hash" };
  if (selector === 1) return { request: { ...request, scopeHash: hash("scope:matrix:wrong") }, label: "invalid-scope" };
  if (selector === 2) return { request: { ...request, requestedPurpose: 3 }, label: "malformed-purpose" };
  if (selector === 3) return { request: { ...request, requestExpiry: 1 }, label: "expired-request" };
  if (selector === 4) return { request: { ...request, dataHash: hash("tampered:data") }, label: "tampered-data-hash" };
  if (selector === 5) return { request: { ...request, expectedConsentHash: currentHash, requestId: request.requestId }, label: "replay-control" };
  if (selector === 6) return { request: { ...request, requestedPurpose: Purpose.UNSUPPORTED }, label: "unsupported-purpose" };
  if (selector === 7) return { request, label: "tampered-signature" };
  return { request: { ...request, scopeHash: hash("scope:matrix:disallowed") }, label: "disallowed-scope" };
}

describe("VCEM correctness matrix", function () {
  it("records exactly 60 policy cases and 120 nominal/adversarial outcomes", async function () {
    this.timeout(120000);
    const lifecycles: Lifecycle[] = ["active-initial", "modified-active", "revoked"];
    const purposes: PurposeName[] = ["treatment", "research", "public-health", "other-disallowed"];
    const actorConfigs: ActorConfig[] = [
      "authorized",
      "unauthorized",
      "removed-after-modification",
      "newly-added",
      "revoked-or-mismatched",
    ];
    const rows: any[] = [];
    let caseNumber = 0;

    for (const lifecycle of lifecycles) {
      for (const purpose of purposes) {
        for (const actorConfig of actorConfigs) {
          caseNumber++;
          const env = await deploy();
          const scopeHash = await setupCase(env, lifecycle, actorConfig);
          const current = await env.consent.getCurrentConsentVersion(env.ids.participant);
          const actor = actorFor(env, actorConfig);
          const latest = await ethers.provider.getBlock("latest");
          const baseRequest = {
            participantId: env.ids.participant,
            requestorId: actor.id,
            dataHash: hash(`matrix:data:${caseNumber}`),
            scopeHash,
            requestedPurpose: purposeValue(purpose),
            requestId: hash(`matrix:request:${caseNumber}:nominal`),
            clientTimestamp: latest!.timestamp,
            requestExpiry: latest!.timestamp + 3600,
            expectedConsentHash: current.consentHash,
          };
          await env.audit.connect(env.custodian).registerDataHash(baseRequest.participantId, baseRequest.scopeHash, baseRequest.dataHash);

          for (const requestKind of ["nominal", "adversarial"] as RequestKind[]) {
            const adversarial = requestKind === "adversarial" ? adversarialOverride(caseNumber, rows.length, baseRequest, current.consentHash) : undefined;
            const request = adversarial?.request ?? baseRequest;
            const expected = requestKind === "nominal" ? expectedNominal(lifecycle, actorConfig, purpose) : false;
            let actual = false;
            let denialReason = "";
            let transactionHash = "";
            let blockNumber = "";
            let transactionIndex = "";
            try {
              if (adversarial?.label === "replay-control") {
                const first = await env.audit.connect(env.gateway).authorizeAndLogAccess(baseRequest, await signAccessRequest(env.audit, actor.signer, baseRequest));
                await first.wait();
              }
              const signature =
                adversarial?.label === "tampered-signature"
                  ? await signAccessRequest(env.audit, env.unauthorized, request)
                  : await signAccessRequest(env.audit, actor.signer, request);
              const tx = await env.audit.connect(env.gateway).authorizeAndLogAccess(request, signature);
              const receipt = await tx.wait();
              transactionHash = receipt?.hash ?? tx.hash;
              blockNumber = receipt?.blockNumber?.toString() ?? "";
              transactionIndex = receipt?.index?.toString() ?? "";
              actual = true;
            } catch (err: any) {
              denialReason = err?.shortMessage || err?.message || "reverted";
            }
            rows.push({
              caseId: `VCEM-${String(caseNumber).padStart(2, "0")}`,
              lifecycleCondition: lifecycle,
              policyVersion: current.version.toString(),
              actorId: actor.id,
              actorConfiguration: actorConfig,
              actorRoleState: actorConfig === "revoked-or-mismatched" ? "revoked" : actorConfig === "unauthorized" ? "active-unauthorized" : "active-researcher",
              requestedPurpose: purpose,
              scopeCondition: request.scopeHash === scopeHash ? "valid" : "invalid",
              requestType: requestKind,
              adversarialScenario: adversarial?.label ?? "",
              expectedOutcome: expected ? "authorized" : "denied",
              actualOutcome: actual ? "authorized" : "denied",
              denialReason,
              requestId: request.requestId,
              transactionHash,
              blockNumber,
              transactionIndex,
              consentHash: current.consentHash,
              pass: actual === expected,
            });
          }
        }
      }
    }

    expect(caseNumber).to.equal(60);
    expect(rows).to.have.length(120);
    expect(rows.every((row) => row.pass)).to.equal(true);

    const outDir = path.join(process.cwd(), "artifacts", "vcem-matrix");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "vcem-correctness-matrix.json"), JSON.stringify(rows, null, 2));
    const header = Object.keys(rows[0]);
    fs.writeFileSync(path.join(outDir, "vcem-correctness-matrix.csv"), [header.join(","), ...rows.map((row) => header.map((field) => JSON.stringify(row[field] ?? "")).join(","))].join("\n"));
  });
});
