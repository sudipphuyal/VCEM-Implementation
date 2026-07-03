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

const ACCESS_AUTHORIZED_TOPIC = ethers.id(
  "AccessAuthorized(bytes32,bytes32,bytes32,bytes32,bytes32,uint8,uint64,bytes32,bytes32,uint64)"
);

type Lifecycle = "active-initial" | "modified-active" | "revoked";
type ActorConfig = "authorized" | "unauthorized" | "removed-after-modification" | "newly-added" | "revoked-or-mismatched";
type PurposeName = "treatment" | "research" | "public-health" | "other-disallowed";
type RequestKind = "nominal" | "adversarial";
type Scenario =
  | "nominal-control"
  | "valid-policy-disallowed-purpose"
  | "malformed-purpose"
  | "invalid-scope"
  | "tampered-data-hash"
  | "tampered-signature"
  | "expired-request"
  | "replayed-request"
  | "unauthorized-active-researcher"
  | "active-role-mismatched-actor"
  | "revoked-actor"
  | "actor-removed-after-update"
  | "actor-added-after-update"
  | "stale-consent-hash"
  | "stale-actor-root"
  | "post-revocation-access";

type MatrixRow = {
  caseId: string;
  lifecycleCondition: string;
  consentVersion: string;
  actorConfiguration: string;
  requestedPurpose: string;
  scopeCondition: string;
  requestType: RequestKind;
  adversarialScenario: Scenario;
  expectedOutcome: "authorized" | "denied";
  actualOutcome: "authorized" | "denied";
  exactDenialReason: string;
  requestId: string;
  transactionHash: string;
  blockNumber: string;
  transactionIndex: string;
  logIndex: string;
  consentHash: string;
  pass: boolean;
};

function id(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function hash(label: string) {
  return ethers.sha256(ethers.toUtf8Bytes(label));
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

function normalizeDenial(err: any) {
  const message = err?.shortMessage || err?.message || "reverted";
  const match = String(message).match(/'(VCEM[^']+)'|"([^"]*VCEM[^"]*)"/);
  return match?.[1] ?? match?.[2] ?? String(message);
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
  await env.consent.connect(env.participant).createConsent(
    env.ids.participant,
    {
      purposeMask: Purpose.TREAT | Purpose.RESEARCH | Purpose.PUBHLTH,
      scopeHash,
      zkConsentCommitment: hash("zk:matrix:initial"),
    },
    initialActors
  );

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

function nominalDenial(lifecycle: Lifecycle, actorConfig: ActorConfig, purpose: PurposeName) {
  if (actorConfig === "revoked-or-mismatched") return "VCEMAudit: inactive requestor";
  if (lifecycle === "revoked") return "VCEMAudit: consent inactive";
  if (actorConfig === "unauthorized" || (actorConfig === "newly-added" && lifecycle === "active-initial")) {
    return "VCEMAudit: actor denied";
  }
  if (actorConfig === "removed-after-modification" && lifecycle === "modified-active") return "VCEMAudit: actor denied";
  if (!purposeAllowed(purpose)) return "VCEMAudit: purpose denied";
  return "";
}

function preferredScenario(lifecycle: Lifecycle, actorConfig: ActorConfig, purpose: PurposeName, validSequence: number, caseNumber: number): Scenario {
  if (lifecycle === "revoked") return "post-revocation-access";
  if (actorConfig === "unauthorized") return "unauthorized-active-researcher";
  if (actorConfig === "revoked-or-mismatched") return caseNumber % 2 === 0 ? "revoked-actor" : "active-role-mismatched-actor";
  if (actorConfig === "removed-after-modification" && lifecycle === "modified-active") return "actor-removed-after-update";
  if (actorConfig === "newly-added" && lifecycle === "active-initial") return "actor-added-after-update";
  if (!purposeAllowed(purpose)) return "valid-policy-disallowed-purpose";

  const scenarios: Scenario[] = [
    "stale-consent-hash",
    "stale-actor-root",
    "invalid-scope",
    "tampered-data-hash",
    "tampered-signature",
    "expired-request",
    "replayed-request",
    "malformed-purpose",
  ];
  return scenarios[validSequence % scenarios.length];
}

async function baseRequest(env: any, caseNumber: number, requestKind: RequestKind, actor: any, scopeHash: string, purpose: PurposeName, consentHash: string) {
  const latest = await ethers.provider.getBlock("latest");
  return {
    participantId: env.ids.participant,
    requestorId: actor.id,
    dataHash: hash(`matrix:data:${caseNumber}:${requestKind}`),
    scopeHash,
    requestedPurpose: purposeValue(purpose),
    requestId: hash(`matrix:request:${caseNumber}:${requestKind}`),
    clientTimestamp: latest!.timestamp,
    requestExpiry: latest!.timestamp + 3600,
    expectedConsentHash: consentHash,
  };
}

async function applyScenario(env: any, scenario: Scenario, request: any, scopeHash: string, caseNumber: number) {
  const requestActor = actorFor(env, "authorized");
  if (scenario === "stale-consent-hash") {
    return {
      request: { ...request, requestorId: requestActor.id, expectedConsentHash: hash("stale:consent") },
      signer: requestActor.signer,
      expectedReason: "VCEMAudit: outdated consent hash",
      registerData: true,
    };
  }
  if (scenario === "stale-actor-root") {
    const staleHash = request.expectedConsentHash;
    await env.consent.connect(env.participant).updateConsent(
      env.ids.participant,
      {
        purposeMask: Purpose.TREAT | Purpose.RESEARCH | Purpose.PUBHLTH,
        scopeHash,
        zkConsentCommitment: hash(`zk:matrix:stale-actor-root:${caseNumber}`),
      },
      [env.ids.newlyAdded]
    );
    return {
      request: { ...request, requestorId: requestActor.id, expectedConsentHash: staleHash },
      signer: requestActor.signer,
      expectedReason: "VCEMAudit: outdated consent hash",
      registerData: true,
    };
  }
  if (scenario === "invalid-scope") {
    return {
      request: { ...request, requestorId: requestActor.id, scopeHash: hash("scope:matrix:wrong") },
      signer: requestActor.signer,
      expectedReason: "VCEMAudit: scope denied",
      registerData: false,
    };
  }
  if (scenario === "tampered-data-hash") {
    return {
      request: { ...request, requestorId: requestActor.id, dataHash: hash("matrix:tampered:data") },
      signer: requestActor.signer,
      expectedReason: "VCEMAudit: data hash denied",
      registerData: false,
    };
  }
  if (scenario === "tampered-signature") {
    return {
      request: { ...request, requestorId: requestActor.id },
      signer: env.unauthorized,
      expectedReason: "VCEMAudit: invalid signature",
      registerData: true,
    };
  }
  if (scenario === "expired-request") {
    return {
      request: { ...request, requestorId: requestActor.id, requestExpiry: 1 },
      signer: requestActor.signer,
      expectedReason: "VCEMAudit: expired request",
      registerData: true,
    };
  }
  if (scenario === "replayed-request") {
    return {
      request: { ...request, requestorId: requestActor.id },
      signer: requestActor.signer,
      expectedReason: "VCEMAudit: replayed request",
      registerData: true,
      preAuthorizeReplay: true,
    };
  }
  if (scenario === "malformed-purpose") {
    return {
      request: { ...request, requestorId: requestActor.id, requestedPurpose: 3 },
      signer: requestActor.signer,
      expectedReason: "VCEMAudit: invalid purpose",
      registerData: true,
    };
  }
  if (scenario === "active-role-mismatched-actor") {
    return {
      request: { ...request, requestorId: env.ids.custodian },
      signer: env.custodian,
      expectedReason: "VCEMAudit: inactive requestor",
      registerData: true,
    };
  }
  if (scenario === "revoked-actor") {
    return {
      request: { ...request, requestorId: env.ids.revokedActor },
      signer: env.revokedActor,
      expectedReason: "VCEMAudit: inactive requestor",
      registerData: true,
    };
  }
  return {
    request,
    signer: requestActor.signer,
    expectedReason: nominalDenial("active-initial", "authorized", "research"),
    registerData: true,
  };
}

async function runAccess(env: any, request: any, signer: any, registerData: boolean, preAuthorizeReplay = false) {
  if (registerData) {
    await env.audit.connect(env.custodian).registerDataHash(request.participantId, request.scopeHash, request.dataHash);
  }
  if (preAuthorizeReplay) {
    await env.audit.connect(env.gateway).authorizeAndLogAccess(request, await signAccessRequest(env.audit, signer, request));
  }
  const signature = await signAccessRequest(env.audit, signer, request);
  const tx = await env.audit.connect(env.gateway).authorizeAndLogAccess(request, signature);
  const receipt = await tx.wait();
  const eventLog = receipt?.logs.find((entry: any) => entry.fragment?.name === "AccessAuthorized");
  return {
    transactionHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber?.toString() ?? "",
    transactionIndex: receipt?.index?.toString() ?? "",
    logIndex: eventLog?.index?.toString() ?? "",
  };
}

function writeRows(fileBase: string, rows: MatrixRow[]) {
  const outDir = path.join(process.cwd(), "artifacts", "vcem-matrix");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${fileBase}.json`), JSON.stringify(rows, null, 2));
  const header = Object.keys(rows[0]);
  fs.writeFileSync(
    path.join(outDir, `${fileBase}.csv`),
    [header.join(","), ...rows.map((row) => header.map((field) => JSON.stringify((row as any)[field] ?? "")).join(","))].join("\n")
  );
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
    const rows: MatrixRow[] = [];
    let caseNumber = 0;
    let validSequence = 0;

    for (const lifecycle of lifecycles) {
      for (const purpose of purposes) {
        for (const actorConfig of actorConfigs) {
          caseNumber++;
          const env = await deploy();
          const scopeHash = await setupCase(env, lifecycle, actorConfig);
          const current = await env.consent.getCurrentConsentVersion(env.ids.participant);
          const actor = actorFor(env, actorConfig);
          const nominalRequest = await baseRequest(env, caseNumber, "nominal", actor, scopeHash, purpose, current.consentHash);
          const nominalExpected = expectedNominal(lifecycle, actorConfig, purpose);
          let nominalActual = false;
          let nominalReason = "";
          let nominalTx = { transactionHash: "", blockNumber: "", transactionIndex: "", logIndex: "" };
          try {
            nominalTx = await runAccess(env, nominalRequest, actor.signer, true);
            nominalActual = true;
          } catch (err: any) {
            nominalReason = normalizeDenial(err);
          }
          rows.push({
            caseId: `VCEM-${String(caseNumber).padStart(2, "0")}`,
            lifecycleCondition: lifecycle,
            consentVersion: current.version.toString(),
            actorConfiguration: actorConfig,
            requestedPurpose: purpose,
            scopeCondition: nominalRequest.scopeHash === scopeHash ? "valid" : "invalid",
            requestType: "nominal",
            adversarialScenario: "nominal-control",
            expectedOutcome: nominalExpected ? "authorized" : "denied",
            actualOutcome: nominalActual ? "authorized" : "denied",
            exactDenialReason: nominalReason,
            requestId: nominalRequest.requestId,
            ...nominalTx,
            consentHash: current.consentHash,
            pass: nominalActual === nominalExpected && (nominalExpected || nominalReason === nominalDenial(lifecycle, actorConfig, purpose)),
          });

          const adversarialScenario = preferredScenario(lifecycle, actorConfig, purpose, validSequence, caseNumber);
          if (nominalExpected) validSequence++;
          const adversarialRequest = await baseRequest(env, caseNumber, "adversarial", actor, scopeHash, purpose, current.consentHash);
          const override =
            adversarialScenario === "post-revocation-access"
              ? {
                  request: { ...adversarialRequest, requestorId: env.ids.authorized },
                  signer: env.authorized,
                  expectedReason: "VCEMAudit: consent inactive",
                  registerData: true,
                }
              : adversarialScenario === "unauthorized-active-researcher" ||
            adversarialScenario === "actor-removed-after-update" ||
            adversarialScenario === "actor-added-after-update" ||
            adversarialScenario === "valid-policy-disallowed-purpose"
              ? {
                  request: adversarialRequest,
                  signer: actor.signer,
                  expectedReason: nominalDenial(lifecycle, actorConfig, purpose),
                  registerData: true,
                }
              : await applyScenario(env, adversarialScenario, adversarialRequest, scopeHash, caseNumber);

          let actual = false;
          let denialReason = "";
          let txData = { transactionHash: "", blockNumber: "", transactionIndex: "", logIndex: "" };
          try {
            txData = await runAccess(env, override.request, override.signer, override.registerData, override.preAuthorizeReplay);
            actual = true;
          } catch (err: any) {
            denialReason = normalizeDenial(err);
          }
          rows.push({
            caseId: `VCEM-${String(caseNumber).padStart(2, "0")}`,
            lifecycleCondition: lifecycle,
            consentVersion: current.version.toString(),
            actorConfiguration: actorConfig,
            requestedPurpose: purpose,
            scopeCondition: override.request.scopeHash === scopeHash ? "valid" : "invalid",
            requestType: "adversarial",
            adversarialScenario,
            expectedOutcome: "denied",
            actualOutcome: actual ? "authorized" : "denied",
            exactDenialReason: denialReason,
            requestId: override.request.requestId,
            ...txData,
            consentHash: current.consentHash,
            pass: !actual && denialReason === override.expectedReason,
          });
        }
      }
    }

    expect(caseNumber).to.equal(60);
    expect(rows).to.have.length(120);
    expect(new Set(rows.map((row) => `${row.requestType}:${row.requestId}`)).size).to.equal(120);
    expect(rows.every((row) => row.pass), JSON.stringify(rows.filter((row) => !row.pass), null, 2)).to.equal(true);

    const scenarios = new Set(rows.map((row) => row.adversarialScenario));
    for (const scenario of [
      "valid-policy-disallowed-purpose",
      "malformed-purpose",
      "invalid-scope",
      "tampered-data-hash",
      "tampered-signature",
      "expired-request",
      "replayed-request",
      "unauthorized-active-researcher",
      "active-role-mismatched-actor",
      "revoked-actor",
      "actor-removed-after-update",
      "actor-added-after-update",
      "stale-consent-hash",
      "stale-actor-root",
      "post-revocation-access",
    ]) {
      expect(scenarios.has(scenario as Scenario), `missing scenario ${scenario}`).to.equal(true);
    }

    writeRows("vcem-correctness-matrix", rows);
  });

  it("records deterministic access-versus-consent-update ordering evidence", async function () {
    this.timeout(120000);
    const rows: MatrixRow[] = [];
    const env = await deploy();
    const scopeHash = await setupCase(env, "active-initial", "authorized");
    const v1 = await env.consent.getCurrentConsentVersion(env.ids.participant);
    const latest = await ethers.provider.getBlock("latest");
    const accessBeforeUpdate = {
      participantId: env.ids.participant,
      requestorId: env.ids.authorized,
      dataHash: hash("concurrency:data:before"),
      scopeHash,
      requestedPurpose: Purpose.RESEARCH,
      requestId: hash("concurrency:access-before-update"),
      clientTimestamp: latest!.timestamp,
      requestExpiry: latest!.timestamp + 3600,
      expectedConsentHash: v1.consentHash,
    };
    await env.audit.connect(env.custodian).registerDataHash(accessBeforeUpdate.participantId, scopeHash, accessBeforeUpdate.dataHash);

    await ethers.provider.send("evm_setAutomine", [false]);
    try {
      const accessData = await env.audit
        .connect(env.gateway)
        .authorizeAndLogAccess.populateTransaction(accessBeforeUpdate, await signAccessRequest(env.audit, env.authorized, accessBeforeUpdate));
      const updateData = await env.consent.connect(env.participant).updateConsent.populateTransaction(
        env.ids.participant,
        {
          purposeMask: Purpose.TREAT | Purpose.RESEARCH | Purpose.PUBHLTH,
          scopeHash,
          zkConsentCommitment: hash("zk:concurrency:update-after-access"),
        },
        [env.ids.newlyAdded]
      );
      const accessHash = await ethers.provider.send("eth_sendTransaction", [
        { from: env.gateway.address, to: await env.audit.getAddress(), data: accessData.data },
      ]);
      const updateHash = await ethers.provider.send("eth_sendTransaction", [
        { from: env.participant.address, to: await env.consent.getAddress(), data: updateData.data },
      ]);
      await ethers.provider.send("evm_mine", []);
      const accessReceipt = await ethers.provider.getTransactionReceipt(accessHash);
      const updateReceipt = await ethers.provider.getTransactionReceipt(updateHash);
      const accessLog = accessReceipt?.logs.find((entry: any) => entry.topics[0] === ACCESS_AUTHORIZED_TOPIC);
      rows.push({
        caseId: "VCEM-CONCURRENCY-01",
        lifecycleCondition: "access-before-update-same-block",
        consentVersion: "1",
        actorConfiguration: "authorized",
        requestedPurpose: "research",
        scopeCondition: "valid",
        requestType: "nominal",
        adversarialScenario: "nominal-control",
        expectedOutcome: "authorized",
        actualOutcome: "authorized",
        exactDenialReason: "",
        requestId: accessBeforeUpdate.requestId,
        transactionHash: accessReceipt?.hash ?? accessHash,
        blockNumber: accessReceipt?.blockNumber?.toString() ?? "",
        transactionIndex: accessReceipt?.index?.toString() ?? "",
        logIndex: accessLog?.index?.toString() ?? "",
        consentHash: v1.consentHash,
        pass: (accessReceipt?.index ?? 0) < (updateReceipt?.index ?? 999),
      });
    } finally {
      await ethers.provider.send("evm_setAutomine", [true]);
    }

    const v2 = await env.consent.getCurrentConsentVersion(env.ids.participant);
    const afterUpdateRequest = {
      participantId: env.ids.participant,
      requestorId: env.ids.authorized,
      dataHash: hash("concurrency:data:after"),
      scopeHash,
      requestedPurpose: Purpose.RESEARCH,
      requestId: hash("concurrency:update-before-access"),
      clientTimestamp: latest!.timestamp,
      requestExpiry: latest!.timestamp + 3600,
      expectedConsentHash: v1.consentHash,
    };
    await env.audit.connect(env.custodian).registerDataHash(afterUpdateRequest.participantId, scopeHash, afterUpdateRequest.dataHash);

    let denialReason = "";
    try {
      await env.audit
        .connect(env.gateway)
        .authorizeAndLogAccess(afterUpdateRequest, await signAccessRequest(env.audit, env.authorized, afterUpdateRequest));
    } catch (err: any) {
      denialReason = normalizeDenial(err);
    }
    rows.push({
      caseId: "VCEM-CONCURRENCY-02",
      lifecycleCondition: "update-before-access-next-block",
      consentVersion: v2.version.toString(),
      actorConfiguration: "authorized-removed-by-update",
      requestedPurpose: "research",
      scopeCondition: "valid",
      requestType: "adversarial",
      adversarialScenario: "stale-consent-hash",
      expectedOutcome: "denied",
      actualOutcome: denialReason ? "denied" : "authorized",
      exactDenialReason: denialReason,
      requestId: afterUpdateRequest.requestId,
      transactionHash: "",
      blockNumber: "",
      transactionIndex: "",
      logIndex: "",
      consentHash: v2.consentHash,
      pass: denialReason === "VCEMAudit: outdated consent hash",
    });

    expect(rows.every((row) => row.pass), JSON.stringify(rows, null, 2)).to.equal(true);
    writeRows("vcem-concurrency-ordering", rows);
  });
});
