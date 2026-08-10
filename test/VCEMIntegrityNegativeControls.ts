import { expect } from "chai";
import { ethers } from "hardhat";
import crypto from "crypto";
import childProcess from "child_process";
import fs from "fs";
import path from "path";
import { verifyVcemAudit, AuditVerifyOptions } from "../scripts/auditVerify";
import { encryptArtifact } from "../services/data-proxy/crypto";

const Role = { PARTICIPANT: 2, RESEARCHER: 3, DATA_CUSTODIAN: 4, POLICY_GATEWAY: 5 };
const Purpose = { RESEARCH: 2, OTHER: 8 };

function id(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function sha256(bytes: Buffer | string) {
  return `0x${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function normalizeReason(error: any) {
  const text = String(error?.shortMessage || error?.reason || error?.message || error);
  return text.match(/VCEMAudit: [A-Za-z ]+/)?.[0].trim() || text;
}

async function signRequest(audit: any, signer: any, request: any) {
  return signer.signTypedData(
    { name: "VCEMAudit", version: "1", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await audit.getAddress() },
    {
      AccessRequest: [
        { name: "participantId", type: "bytes32" }, { name: "requestorId", type: "bytes32" },
        { name: "dataHash", type: "bytes32" }, { name: "scopeHash", type: "bytes32" },
        { name: "requestedPurpose", type: "uint8" }, { name: "requestId", type: "bytes32" },
        { name: "clientTimestamp", type: "uint64" }, { name: "requestExpiry", type: "uint64" },
        { name: "expectedConsentHash", type: "bytes32" },
      ],
    },
    request
  );
}

async function deployBase(label: string) {
  const [admin, participantA, participantB, researcher, gateway, custodian] = await ethers.getSigners();
  const registry = await (await ethers.getContractFactory("VCEMRegistry")).deploy();
  const consent = await (await ethers.getContractFactory("VCEMConsent")).deploy(await registry.getAddress());
  const audit = await (await ethers.getContractFactory("VCEMAudit")).deploy(await registry.getAddress(), await consent.getAddress());
  const ids = {
    participantA: id(`${label}:participant:a`), participantB: id(`${label}:participant:b`),
    researcher: id(`${label}:researcher`), gateway: id(`${label}:gateway`), custodian: id(`${label}:custodian`),
  };
  await registry.registerActor(ids.participantA, participantA.address, Role.PARTICIPANT);
  await registry.registerActor(ids.participantB, participantB.address, Role.PARTICIPANT);
  await registry.registerActor(ids.researcher, researcher.address, Role.RESEARCHER);
  await registry.registerActor(ids.gateway, gateway.address, Role.POLICY_GATEWAY);
  await registry.registerActor(ids.custodian, custodian.address, Role.DATA_CUSTODIAN);
  return { participantA, participantB, researcher, gateway, custodian, registry, consent, audit, ids };
}

async function auditFixture(label: string) {
  const env = await deployBase(label);
  const scopeHash = sha256(`${label}:scope`);
  await env.consent.connect(env.participantA).createConsent(
    env.ids.participantA,
    { purposeMask: Purpose.RESEARCH, scopeHash, zkConsentCommitment: sha256(`${label}:zk:v1`) },
    [env.ids.researcher]
  );
  await env.consent.connect(env.participantA).updateConsent(
    env.ids.participantA,
    { purposeMask: Purpose.RESEARCH, scopeHash, zkConsentCommitment: sha256(`${label}:zk:v2`) },
    [env.ids.researcher]
  );
  const current = await env.consent.getCurrentConsentVersion(env.ids.participantA);
  const block = await ethers.provider.getBlock("latest");
  const request = {
    participantId: env.ids.participantA, requestorId: env.ids.researcher, dataHash: sha256(`${label}:data`), scopeHash,
    requestedPurpose: Purpose.RESEARCH, requestId: sha256(`${label}:request`), clientTimestamp: block!.timestamp,
    requestExpiry: block!.timestamp + 3600, expectedConsentHash: current.consentHash,
  };
  await env.audit.connect(env.custodian).registerDataHash(request.participantId, request.scopeHash, request.dataHash);
  await env.audit.connect(env.gateway).authorizeAndLogAccess(request, await signRequest(env.audit, env.researcher, request));
  const options: AuditVerifyOptions = {
    provider: ethers.provider,
    registryAddress: await env.registry.getAddress(), consentAddress: await env.consent.getAddress(), auditAddress: await env.audit.getAddress(),
    mode: "full", writeReports: false,
  };
  return { env, options };
}

function reportPaths() {
  const root = process.env.VCEM_AUDIT_INTEGRITY_REPORT_ROOT || path.join(process.cwd(), "reports", "audit-integrity");
  const label = process.env.VCEM_AUDIT_INTEGRITY_EVIDENCE_LABEL || "current";
  fs.mkdirSync(path.join(root, "raw"), { recursive: true });
  return { root, label, canonical: label === "evaluated-6077d27" };
}

function writeCsv(file: string, rows: Record<string, unknown>[]) {
  const columns = Object.keys(rows[0]);
  fs.writeFileSync(file, [columns.join(","), ...rows.map((row) => columns.map((column) => JSON.stringify(row[column] ?? "")).join(","))].join("\n") + "\n");
}

describe("Reviewer 2 Concern 10 audit and integrity controls", function () {
  this.timeout(120_000);

  it("detects all reconstructed-evidence audit mutations", async function () {
    const cases: Array<{ name: string; expected: string; tamper: NonNullable<AuditVerifyOptions["tamper"]> }> = [
      { name: "modified consentHash", expected: "ACCESS_CONSENT_HASH_MISMATCH", tamper: (e) => { e.accessRecords[0].consentHash = sha256("tamper:consent"); } },
      { name: "modified consentVersion", expected: "MISSING_CONSENT_VERSION", tamper: (e) => { e.accessRecords[0].consentVersion = 99n; } },
      { name: "modified requesterId", expected: "CALLDATA_REQUESTOR_MISMATCH", tamper: (e) => { e.accessRecords[0].requestorId = id("tamper:requester"); } },
      { name: "modified participantId", expected: "MISSING_CONSENT_VERSION", tamper: (e) => { e.accessRecords[0].participantId = id("tamper:participant"); } },
      { name: "modified purpose", expected: "CALLDATA_PURPOSE_MISMATCH", tamper: (e) => { e.accessRecords[0].purpose = 8n; } },
      { name: "modified scopeHash", expected: "SCOPE_MISMATCH", tamper: (e) => { e.accessRecords[0].scopeHash = sha256("tamper:scope"); } },
      { name: "modified dataHash", expected: "DATA_HASH_NOT_REGISTERED", tamper: (e) => { e.accessRecords[0].dataHash = sha256("tamper:data"); } },
      { name: "modified actorsRoot", expected: "ACCESS_ACTOR_ROOT_MISMATCH", tamper: (e) => { e.accessRecords[0].actorsRoot = sha256("tamper:actors"); } },
      { name: "missing authorization event", expected: "ACCESS_EVENT_POPULATION_CHANGED", tamper: (e) => { e.accessRecords.splice(0, 1); } },
      { name: "inconsistent historical consent reference", expected: "PREVIOUS_HASH_MISMATCH", tamper: (e) => { e.consentRecords[1].previousConsentHash = sha256("tamper:previous"); } },
    ];
    const rows: Record<string, unknown>[] = [];
    for (let index = 0; index < cases.length; index++) {
      const testCase = cases[index];
      const { options } = await auditFixture(`concern10:audit:${index}`);
      const report = await verifyVcemAudit({ ...options, tamper: testCase.tamper });
      const serialized = JSON.stringify(report, (_key, value) => typeof value === "bigint" ? value.toString() : value);
      const detected = serialized.includes(testCase.expected);
      expect(detected, testCase.name).to.equal(true);
      rows.push({
        test_case: testCase.name, expected_result: "DETECTED", actual_result: detected ? "DETECTED" : "NOT_DETECTED",
        expected_detector: testCase.expected, pass: detected,
      });
    }
    const paths = reportPaths();
    const labelled = path.join(paths.root, `audit-negative-controls-${paths.label}.csv`);
    writeCsv(labelled, rows);
    if (paths.canonical) writeCsv(path.join(paths.root, "audit-negative-controls.csv"), rows);
    fs.writeFileSync(path.join(paths.root, "raw", `audit-negative-controls-${paths.label}.json`), JSON.stringify({
      commit: childProcess.execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim(),
      category: "peer-review/revision reconstructed-evidence tamper controls", rows,
    }, null, 2));
  });

  it("detects byte, metadata, association, scope, stale-hash, serialization, and substitution changes", async function () {
    const env = await deployBase("concern10:integrity");
    const scopeHash = sha256("concern10:scope:vitals");
    const wrongScope = sha256("concern10:scope:labs");
    const artifactText = '{"metadata":{"source":"synthetic-device","collectedAt":"2026-01-01T00:00:00Z","unit":"bpm"},"observations":[{"code":"heart-rate","value":72}]}';
    const artifact = Buffer.from(artifactText, "utf8");
    const originalHash = sha256(artifact);
    const encrypted = encryptArtifact("synthetic-participant-key", Buffer.alloc(32, 7), artifact);
    expect(encrypted.dataHash).to.equal(originalHash);

    for (const [participant, participantId, commitment] of [
      [env.participantA, env.ids.participantA, "a"], [env.participantB, env.ids.participantB, "b"],
    ] as const) {
      await env.consent.connect(participant).createConsent(
        participantId,
        { purposeMask: Purpose.RESEARCH, scopeHash, zkConsentCommitment: sha256(`concern10:zk:${commitment}`) },
        [env.ids.researcher]
      );
    }
    await env.audit.connect(env.custodian).registerDataHash(env.ids.participantA, scopeHash, originalHash);
    expect(await env.audit.registeredDataHash(env.ids.participantA, scopeHash)).to.equal(originalHash);

    const request = async (participantId: string, requestScope: string, dataHash: string, label: string) => {
      const current = await env.consent.getCurrentConsentVersion(participantId);
      const block = await ethers.provider.getBlock("latest");
      return {
        participantId, requestorId: env.ids.researcher, dataHash, scopeHash: requestScope, requestedPurpose: Purpose.RESEARCH,
        requestId: sha256(`concern10:request:${label}`), clientTimestamp: block!.timestamp,
        requestExpiry: block!.timestamp + 3600, expectedConsentHash: current.consentHash,
      };
    };
    const positive = await request(env.ids.participantA, scopeHash, originalHash, "positive");
    const positiveTx = await env.audit.connect(env.gateway).authorizeAndLogAccess(positive, await signRequest(env.audit, env.researcher, positive));
    const positiveReceipt = await positiveTx.wait();
    expect(positiveReceipt?.status).to.equal(1);
    expect((await env.audit.getAccessEvent(positive.requestId)).authorized).to.equal(true);

    const rows: Record<string, unknown>[] = [{
      test_case: "baseline positive", original_hash: originalHash, test_hash: originalHash,
      participant: env.ids.participantA, scope: scopeHash, expected_result: "MATCH", actual_result: "MATCH",
      exact_rejection_or_mismatch_reason: "SHA-256(raw artifact bytes) equals registered participant/scope data hash", pass: true,
    }];
    const oneByte = Buffer.from(artifact);
    const byteOffset = artifact.indexOf(Buffer.from("72"));
    oneByte[byteOffset + 1] = "3".charCodeAt(0);
    const metadataChanged = Buffer.from(artifactText.replace("synthetic-device", "synthetic-source"), "utf8");
    const serializationChanged = Buffer.from(JSON.stringify(JSON.parse(artifactText), null, 2), "utf8");
    const substituted = Buffer.from('{"metadata":{"source":"synthetic-lab"},"observations":[{"code":"glucose","value":999}]}', "utf8");
    for (const [name, bytes, reason] of [
      ["single-byte modification", oneByte, `byte offset ${byteOffset + 1} changed from 0x32 to 0x33`],
      ["metadata modification", metadataChanged, "metadata.source is inside the hashed raw bytes"],
      ["canonicalization/serialization change", serializationChanged, "semantically equivalent JSON was pretty-printed; raw-byte hashing is serialization-sensitive"],
      ["deliberately substituted artifact", substituted, "different synthetic artifact bytes supplied"],
    ] as const) {
      const testHash = sha256(bytes);
      const mismatch = testHash !== originalHash;
      expect(mismatch, name).to.equal(true);
      rows.push({
        test_case: name, original_hash: originalHash, test_hash: testHash, participant: env.ids.participantA, scope: scopeHash,
        expected_result: "TAMPERED", actual_result: mismatch ? "TAMPERED" : "MATCH",
        exact_rejection_or_mismatch_reason: `${reason}; SHA-256 mismatch`, pass: mismatch,
      });
    }

    const associationCases = [
      { name: "wrong participant association", value: await request(env.ids.participantB, scopeHash, originalHash, "wrong-participant"), expected: "VCEMAudit: data hash denied" },
      { name: "wrong scope", value: await request(env.ids.participantA, wrongScope, originalHash, "wrong-scope"), expected: "VCEMAudit: scope denied" },
    ];
    for (const item of associationCases) {
      let reason = "";
      try {
        await env.audit.connect(env.gateway).authorizeAndLogAccess(item.value, await signRequest(env.audit, env.researcher, item.value));
      } catch (error) {
        reason = normalizeReason(error);
      }
      expect(reason).to.equal(item.expected);
      rows.push({
        test_case: item.name, original_hash: originalHash, test_hash: originalHash, participant: item.value.participantId,
        scope: item.value.scopeHash, expected_result: "REJECTED", actual_result: "REJECTED",
        exact_rejection_or_mismatch_reason: reason, pass: true,
      });
    }

    const replacementHash = sha256(Buffer.from(artifactText.replace("72", "74"), "utf8"));
    await env.audit.connect(env.custodian).registerDataHash(env.ids.participantA, scopeHash, replacementHash);
    const stale = await request(env.ids.participantA, scopeHash, originalHash, "stale-data-hash");
    let staleReason = "";
    try {
      await env.audit.connect(env.gateway).authorizeAndLogAccess(stale, await signRequest(env.audit, env.researcher, stale));
    } catch (error) {
      staleReason = normalizeReason(error);
    }
    expect(staleReason).to.equal("VCEMAudit: data hash denied");
    rows.push({
      test_case: "stale data hash", original_hash: originalHash, test_hash: replacementHash, participant: env.ids.participantA,
      scope: scopeHash, expected_result: "REJECTED", actual_result: "REJECTED",
      exact_rejection_or_mismatch_reason: staleReason, pass: true,
    });

    const paths = reportPaths();
    writeCsv(path.join(paths.root, `integrity-negative-controls-${paths.label}.csv`), rows);
    if (paths.canonical) writeCsv(path.join(paths.root, "integrity-negative-controls.csv"), rows);
    const summary = {
      commit: childProcess.execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim(),
      category: "peer-review/revision synthetic artifact integrity controls", algorithm: "SHA-256 over raw plaintext artifact bytes",
      originalArtifactUtf8: artifactText, originalHash, byteMutationOffset: byteOffset + 1,
      positiveControls: rows.filter((row) => row.test_case === "baseline positive").length,
      negativeControls: rows.filter((row) => row.test_case !== "baseline positive").length,
      passed: rows.filter((row) => row.pass).length, rows,
    };
    fs.writeFileSync(path.join(paths.root, `integrity-validation-summary-${paths.label}.json`), JSON.stringify(summary, null, 2));
    if (paths.canonical) fs.writeFileSync(path.join(paths.root, "integrity-validation-summary.json"), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(paths.root, "raw", `integrity-controls-${paths.label}.json`), JSON.stringify(summary, null, 2));
    expect(rows).to.have.length(8);
  });
});
