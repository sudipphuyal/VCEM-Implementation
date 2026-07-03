import { expect } from "chai";
import { ethers } from "hardhat";
import { verifyVcemAudit, AuditVerifyOptions } from "../scripts/auditVerify";
import { normalizeRuntimeBytecode, verifyDeployedBytecode } from "../scripts/verifyDeployedBytecode";

const Role = {
  PARTICIPANT: 2,
  RESEARCHER: 3,
  DATA_CUSTODIAN: 4,
  POLICY_GATEWAY: 5,
  AUDITOR: 6,
};

const Purpose = {
  RESEARCH: 2,
  OTHER: 8,
};

function id(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function hash(label: string) {
  return ethers.sha256(ethers.toUtf8Bytes(label));
}

function reportText(report: unknown) {
  return JSON.stringify(report, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
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

async function deployEvidenceFixture() {
  const [admin, participant, researcher, gateway, custodian, auditor, outsider] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("VCEMRegistry");
  const registry = await Registry.deploy();
  const Consent = await ethers.getContractFactory("VCEMConsent");
  const consent = await Consent.deploy(await registry.getAddress());
  const Audit = await ethers.getContractFactory("VCEMAudit");
  const audit = await Audit.deploy(await registry.getAddress(), await consent.getAddress());
  const ids = {
    participant: id("audit:participant"),
    researcher: id("audit:researcher"),
    gateway: id("audit:gateway"),
    custodian: id("audit:custodian"),
    auditor: id("audit:auditor"),
    outsider: id("audit:outsider"),
  };
  await registry.registerActor(ids.participant, participant.address, Role.PARTICIPANT);
  await registry.registerActor(ids.researcher, researcher.address, Role.RESEARCHER);
  await registry.registerActor(ids.gateway, gateway.address, Role.POLICY_GATEWAY);
  await registry.registerActor(ids.custodian, custodian.address, Role.DATA_CUSTODIAN);
  await registry.registerActor(ids.auditor, auditor.address, Role.AUDITOR);
  await registry.registerActor(ids.outsider, outsider.address, Role.RESEARCHER);

  const scopeHash = hash("audit:scope");
  await consent.connect(participant).createConsent(
    ids.participant,
    {
      purposeMask: Purpose.RESEARCH,
      scopeHash,
      zkConsentCommitment: hash("audit:zk"),
    },
    [ids.researcher]
  );
  const version = await consent.getCurrentConsentVersion(ids.participant);
  const latest = await ethers.provider.getBlock("latest");
  const request = {
    participantId: ids.participant,
    requestorId: ids.researcher,
    dataHash: hash("audit:data"),
    scopeHash,
    requestedPurpose: Purpose.RESEARCH,
    requestId: hash("audit:request"),
    clientTimestamp: latest!.timestamp,
    requestExpiry: latest!.timestamp + 3600,
    expectedConsentHash: version.consentHash,
  };
  await audit.connect(custodian).registerDataHash(request.participantId, request.scopeHash, request.dataHash);
  await audit.connect(gateway).authorizeAndLogAccess(request, await signAccessRequest(audit, researcher, request));

  const options: AuditVerifyOptions = {
    provider: ethers.provider,
    registryAddress: await registry.getAddress(),
    consentAddress: await consent.getAddress(),
    auditAddress: await audit.getAddress(),
    writeReports: false,
  };
  return { options, registry, consent, audit };
}

describe("VCEM audit verifier", function () {
  it("passes untampered blockchain evidence", async function () {
    const { options } = await deployEvidenceFixture();
    const report = await verifyVcemAudit(options);
    expect(report.consentFailures).to.equal(0);
    expect(report.accessFailures).to.equal(0);
  });

  it("reports deterministic sample mode when fewer than 100 eligible events exist", async function () {
    const { options } = await deployEvidenceFixture();
    const report = await verifyVcemAudit({ ...options, mode: "sample", sampleSize: 100, seed: "42" });
    expect(report.verifiedAccessRecords).to.equal(1);
    expect(report.sampleNotice).to.contain("fewer than requested eligible events exist");
  });

  const tamperCases: Array<[string, string, NonNullable<AuditVerifyOptions["tamper"]>]> = [
    ["altered consent hash", "CONSENT_HASH_MISMATCH", (e) => (e.consentRecords[0].consentHash = hash("bad:consent"))],
    ["altered previous hash", "PREVIOUS_HASH_MISMATCH", (e) => {
      e.consentRecords.push({ ...e.consentRecords[0], version: 2n, previousConsentHash: hash("bad:previous"), logIndex: e.consentRecords[0].logIndex + 1 });
    }],
    ["altered actor root", "ACTOR_ROOT_MISMATCH", (e) => (e.consentRecords[0].actorsRoot = hash("bad:root"))],
    ["altered actor list", "ACTOR_ROOT_MISMATCH", (e) => (e.actorSetRecords[0].actorIds = [id("bad:actor")])],
    ["wrong actor", "CALLDATA_REQUESTOR_MISMATCH", (e) => (e.accessRecords[0].requestorId = id("wrong:actor"))],
    ["wrong role", "REQUESTOR_NOT_ACTIVE_RESEARCHER", (e) => (e.accessRecords[0].requestorId = e.dataHashes[0].participantId)],
    ["invalid purpose", "CALLDATA_PURPOSE_MISMATCH", (e) => (e.accessRecords[0].purpose = BigInt(Purpose.OTHER))],
    ["invalid scope", "SCOPE_MISMATCH", (e) => (e.accessRecords[0].scopeHash = hash("bad:scope"))],
    ["data hash mismatch", "DATA_HASH_NOT_REGISTERED", (e) => (e.accessRecords[0].dataHash = hash("bad:data"))],
    ["replay", "REQUEST_REPLAY", (e) => e.accessRecords.push({ ...e.accessRecords[0], logIndex: e.accessRecords[0].logIndex + 1 })],
    ["invalid signature", "INVALID_REQUEST_SIGNATURE", (e) => (e.accessRecords[0].requestorId = id("signature:mismatch"))],
    ["stale consent hash", "EXPECTED_CONSENT_HASH_MISMATCH", (e) => (e.accessRecords[0].consentHash = hash("stale:consent"))],
  ];

  for (const [name, expectedFailure, tamper] of tamperCases) {
    it(`detects ${name}`, async function () {
      const { options } = await deployEvidenceFixture();
      const report = await verifyVcemAudit({ ...options, tamper });
      const failures = reportText(report);
      expect(failures).to.contain(expectedFailure);
    });
  }

  it("detects expired request", async function () {
    const { options } = await deployEvidenceFixture();
    const report = await verifyVcemAudit({
      ...options,
      tamperAfterDecode: (e) => {
        e.accessRecords[0].calldata!.requestExpiry = 1n;
      },
    });
    expect(reportText(report)).to.contain("REQUEST_EXPIRED_AT_BLOCK");
  });

  it("detects wrong deployed bytecode", async function () {
    const { registry, consent, audit } = await deployEvidenceFixture();
    const results = await verifyDeployedBytecode({
      provider: ethers.provider,
      addresses: {
        VCEMRegistry: await registry.getAddress(),
        VCEMConsent: await consent.getAddress(),
        VCEMAudit: await audit.getAddress(),
      },
      artifactByName: {
        VCEMRegistry: "artifacts/contracts/vcem/VCEMAudit.sol/VCEMAudit.json",
        VCEMConsent: "artifacts/contracts/vcem/VCEMConsent.sol/VCEMConsent.json",
        VCEMAudit: "artifacts/contracts/vcem/VCEMAudit.sol/VCEMAudit.json",
      },
    });
    expect(results.find((row) => row.name === "VCEMRegistry")?.match).to.equal(false);
  });

  it("normalizes immutable and library byte ranges", function () {
    const artifact = {
      deployedBytecode: "0x1111222233334444",
      immutableReferences: { "1": [{ start: 2, length: 2 }] },
      deployedLinkReferences: { "L.sol": { L: [{ start: 6, length: 1 }] } },
    };
    expect(normalizeRuntimeBytecode("0x1111aaaa3333bb44", artifact).bytecode).to.equal("0x1111000033330044");
  });
});
