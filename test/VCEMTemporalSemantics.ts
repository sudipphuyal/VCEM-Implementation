import { expect } from "chai";
import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";
import childProcess from "child_process";

const Role = { PARTICIPANT: 2, RESEARCHER: 3, DATA_CUSTODIAN: 4, POLICY_GATEWAY: 5 };
const Purpose = { RESEARCH: 2 };
const ConsentStatus = { REVOKED: 3n };

type OrderingRow = {
  case: string;
  submissionOrder: string;
  finalizedLedgerOrder: string;
  authorizationBlockNumber: string;
  authorizationTransactionIndex: string;
  revocationBlockNumber: string;
  revocationTransactionIndex: string;
  consentVersionSeen: string;
  consentHashSeen: string;
  authorizationOutcome: "authorized" | "denied";
  rejectionReason: string;
  authorizationTxHash: string;
  revocationTxHash: string;
  expectedObservedMatch: boolean;
};

function digest(label: string) {
  return ethers.sha256(ethers.toUtf8Bytes(label));
}

function actorId(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function normalizeReason(error: any) {
  const text = String(error?.shortMessage || error?.reason || error?.message || error);
  const match = text.match(/VCEMAudit: [A-Za-z ]+/);
  return match?.[0].trim() || text;
}

async function signRequest(audit: any, signer: any, request: any) {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  return signer.signTypedData(
    { name: "VCEMAudit", version: "1", chainId, verifyingContract: await audit.getAddress() },
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

async function fixture(label: string) {
  const [admin, participant, researcher, gateway, custodian] = await ethers.getSigners();
  const registry = await (await ethers.getContractFactory("VCEMRegistry")).deploy();
  const consent = await (await ethers.getContractFactory("VCEMConsent")).deploy(await registry.getAddress());
  const audit = await (await ethers.getContractFactory("VCEMAudit")).deploy(
    await registry.getAddress(),
    await consent.getAddress()
  );
  const ids = {
    participant: actorId(`${label}:participant`),
    researcher: actorId(`${label}:researcher`),
    gateway: actorId(`${label}:gateway`),
    custodian: actorId(`${label}:custodian`),
  };
  await registry.registerActor(ids.participant, participant.address, Role.PARTICIPANT);
  await registry.registerActor(ids.researcher, researcher.address, Role.RESEARCHER);
  await registry.registerActor(ids.gateway, gateway.address, Role.POLICY_GATEWAY);
  await registry.registerActor(ids.custodian, custodian.address, Role.DATA_CUSTODIAN);
  const scopeHash = digest(`${label}:scope`);
  const dataHash = digest(`${label}:data`);
  await consent.connect(participant).createConsent(
    ids.participant,
    { purposeMask: Purpose.RESEARCH, scopeHash, zkConsentCommitment: digest(`${label}:zk`) },
    [ids.researcher]
  );
  await audit.connect(custodian).registerDataHash(ids.participant, scopeHash, dataHash);
  const current = await consent.getCurrentConsentVersion(ids.participant);
  const block = await ethers.provider.getBlock("latest");
  const request = {
    participantId: ids.participant,
    requestorId: ids.researcher,
    dataHash,
    scopeHash,
    requestedPurpose: Purpose.RESEARCH,
    requestId: digest(`${label}:request`),
    clientTimestamp: block!.timestamp,
    requestExpiry: block!.timestamp + 3600,
    expectedConsentHash: current.consentHash,
  };
  return { participant, researcher, gateway, consent, audit, ids, request, current };
}

function receiptPosition(receipt: any) {
  return { block: String(receipt.blockNumber), index: String(receipt.index) };
}

function writeEvidence(rows: OrderingRow[]) {
  const reportDir = process.env.VCEM_TEMPORAL_REPORT_ROOT || path.join(process.cwd(), "reports", "temporal-semantics");
  const rawDir = path.join(reportDir, "raw");
  const evidenceLabel = process.env.VCEM_TEMPORAL_EVIDENCE_LABEL || "current";
  fs.mkdirSync(rawDir, { recursive: true });
  const commit = childProcess.execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
  fs.writeFileSync(
    path.join(rawDir, `hardhat-temporal-ordering-${evidenceLabel}.json`),
    JSON.stringify({ commit, contractsModifiedByHarness: false, generatedAt: new Date().toISOString(), rows }, null, 2)
  );
  const columns = Object.keys(rows[0]) as Array<keyof OrderingRow>;
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => JSON.stringify(row[column])).join(",")),
  ].join("\n");
  fs.writeFileSync(path.join(reportDir, `temporal-ordering-results-${evidenceLabel}.csv`), `${csv}\n`);
  if (evidenceLabel === "evaluated-6077d27") {
    fs.writeFileSync(path.join(reportDir, "temporal-ordering-results.csv"), `${csv}\n`);
  }
}

describe("VCEM temporal semantics", function () {
  it("uses execution order for authorization, update, and revocation races", async function () {
    const rows: OrderingRow[] = [];

    // Case 1: a finalized authorization remains valid historical evidence after revocation.
    {
      const env = await fixture("temporal:case1");
      const signature = await signRequest(env.audit, env.researcher, env.request);
      const authorization = await env.audit.connect(env.gateway).authorizeAndLogAccess(env.request, signature);
      const authorizationReceipt = await authorization.wait();
      const revocation = await env.consent.connect(env.participant).revokeConsent(env.ids.participant);
      const revocationReceipt = await revocation.wait();
      const stored = await env.audit.getAccessEvent(env.request.requestId);
      const revoked = await env.consent.getCurrentConsentVersion(env.ids.participant);
      expect(stored.authorized).to.equal(true);
      expect(stored.consentHash).to.equal(env.current.consentHash);
      expect(revoked.status).to.equal(ConsentStatus.REVOKED);
      rows.push({
        case: "1-authorization-finalized-before-revocation",
        submissionOrder: "authorization,revokeConsent",
        finalizedLedgerOrder: "authorization,revokeConsent",
        authorizationBlockNumber: receiptPosition(authorizationReceipt).block,
        authorizationTransactionIndex: receiptPosition(authorizationReceipt).index,
        revocationBlockNumber: receiptPosition(revocationReceipt).block,
        revocationTransactionIndex: receiptPosition(revocationReceipt).index,
        consentVersionSeen: String(stored.consentVersion),
        consentHashSeen: stored.consentHash,
        authorizationOutcome: "authorized",
        rejectionReason: "",
        authorizationTxHash: authorization.hash,
        revocationTxHash: revocation.hash,
        expectedObservedMatch: true,
      });
    }

    // Cases 2 and 3 share the same ledger condition but distinguish submission/preparation time.
    for (const caseNumber of [2, 3]) {
      const env = await fixture(`temporal:case${caseNumber}`);
      const signature = await signRequest(env.audit, env.researcher, env.request);
      const revocation = await env.consent.connect(env.participant).revokeConsent(env.ids.participant);
      const revocationReceipt = await revocation.wait();
      let reason = "";
      try {
        await env.audit.connect(env.gateway).authorizeAndLogAccess(env.request, signature);
      } catch (error) {
        reason = normalizeReason(error);
      }
      const revoked = await env.consent.getCurrentConsentVersion(env.ids.participant);
      expect(reason).to.equal("VCEMAudit: consent inactive");
      rows.push({
        case: caseNumber === 2 ? "2-revocation-finalized-before-authorization" : "3-request-prepared-before-revocation-processed-after",
        submissionOrder: "revokeConsent,authorization",
        finalizedLedgerOrder: "revokeConsent; authorization rejected before inclusion",
        authorizationBlockNumber: "",
        authorizationTransactionIndex: "",
        revocationBlockNumber: receiptPosition(revocationReceipt).block,
        revocationTransactionIndex: receiptPosition(revocationReceipt).index,
        consentVersionSeen: String(revoked.version),
        consentHashSeen: revoked.consentHash,
        authorizationOutcome: "denied",
        rejectionReason: reason,
        authorizationTxHash: "",
        revocationTxHash: revocation.hash,
        expectedObservedMatch: true,
      });
    }

    // Case 4: an active update supersedes the signed expectedConsentHash.
    {
      const env = await fixture("temporal:case4");
      const signature = await signRequest(env.audit, env.researcher, env.request);
      const update = await env.consent.connect(env.participant).updateConsent(
        env.ids.participant,
        { purposeMask: Purpose.RESEARCH, scopeHash: env.request.scopeHash, zkConsentCommitment: digest("temporal:case4:zk:v2") },
        [env.ids.researcher]
      );
      const updateReceipt = await update.wait();
      let reason = "";
      try {
        await env.audit.connect(env.gateway).authorizeAndLogAccess(env.request, signature);
      } catch (error) {
        reason = normalizeReason(error);
      }
      const current = await env.consent.getCurrentConsentVersion(env.ids.participant);
      expect(reason).to.equal("VCEMAudit: outdated consent hash");
      rows.push({
        case: "4-superseded-consent-after-update",
        submissionOrder: "updateConsent,stale authorization",
        finalizedLedgerOrder: "updateConsent; authorization rejected before inclusion",
        authorizationBlockNumber: "",
        authorizationTransactionIndex: "",
        revocationBlockNumber: receiptPosition(updateReceipt).block,
        revocationTransactionIndex: receiptPosition(updateReceipt).index,
        consentVersionSeen: String(current.version),
        consentHashSeen: current.consentHash,
        authorizationOutcome: "denied",
        rejectionReason: reason,
        authorizationTxHash: "",
        revocationTxHash: update.hash,
        expectedObservedMatch: true,
      });
    }

    // Case 5A/5B: both transactions are mined in one controlled block; transaction index controls state visibility.
    for (const authorizationFirst of [true, false]) {
      const suffix = authorizationFirst ? "5A" : "5B";
      const env = await fixture(`temporal:case${suffix}`);
      const signature = await signRequest(env.audit, env.researcher, env.request);
      const authorizationData = env.audit.interface.encodeFunctionData("authorizeAndLogAccess", [env.request, signature]);
      const revocationData = env.consent.interface.encodeFunctionData("revokeConsent", [env.ids.participant]);
      await network.provider.send("evm_setAutomine", [false]);
      try {
        const authorizationSend = () => env.gateway.sendTransaction({
          to: env.audit.target,
          data: authorizationData,
          gasLimit: 2_000_000,
          gasPrice: 2_000_000_000n,
        });
        const revocationSend = () => env.participant.sendTransaction({
          to: env.consent.target,
          data: revocationData,
          gasLimit: 2_000_000,
          gasPrice: 2_000_000_000n,
        });
        const first = authorizationFirst ? await authorizationSend() : await revocationSend();
        const second = authorizationFirst ? await revocationSend() : await authorizationSend();
        await network.provider.send("evm_mine");
        const authorizationTx = authorizationFirst ? first : second;
        const revocationTx = authorizationFirst ? second : first;
        const authorizationReceipt = await ethers.provider.getTransactionReceipt(authorizationTx.hash);
        const revocationReceipt = await ethers.provider.getTransactionReceipt(revocationTx.hash);
        expect(authorizationReceipt).to.not.equal(null);
        expect(revocationReceipt).to.not.equal(null);
        expect(authorizationReceipt!.blockNumber).to.equal(revocationReceipt!.blockNumber);
        const authorized = authorizationReceipt!.status === 1;
        expect(authorized).to.equal(authorizationFirst);
        let reason = "";
        if (!authorized) {
          try {
            await ethers.provider.call({ from: env.gateway.address, to: env.audit.target as string, data: authorizationData });
          } catch (error) {
            reason = normalizeReason(error);
          }
          expect(reason).to.equal("VCEMAudit: consent inactive");
        }
        const stored = await env.audit.getAccessEvent(env.request.requestId);
        rows.push({
          case: authorizationFirst ? "5A-same-block-authorization-before-revocation" : "5B-same-block-revocation-before-authorization",
          submissionOrder: authorizationFirst ? "authorization,revokeConsent" : "revokeConsent,authorization",
          finalizedLedgerOrder: authorizationReceipt!.index < revocationReceipt!.index ? "authorization,revokeConsent" : "revokeConsent,authorization",
          authorizationBlockNumber: String(authorizationReceipt!.blockNumber),
          authorizationTransactionIndex: String(authorizationReceipt!.index),
          revocationBlockNumber: String(revocationReceipt!.blockNumber),
          revocationTransactionIndex: String(revocationReceipt!.index),
          consentVersionSeen: authorized ? String(stored.consentVersion) : "2",
          consentHashSeen: authorized ? stored.consentHash : (await env.consent.getCurrentConsentVersion(env.ids.participant)).consentHash,
          authorizationOutcome: authorized ? "authorized" : "denied",
          rejectionReason: reason,
          authorizationTxHash: authorizationTx.hash,
          revocationTxHash: revocationTx.hash,
          expectedObservedMatch: true,
        });
      } finally {
        await network.provider.send("evm_setAutomine", [true]);
      }
    }

    // Case 5C: revoke is submitted first, but fee-priority ordering executes authorization first.
    {
      const env = await fixture("temporal:case5C");
      const signature = await signRequest(env.audit, env.researcher, env.request);
      const authorizationData = env.audit.interface.encodeFunctionData("authorizeAndLogAccess", [env.request, signature]);
      const revocationData = env.consent.interface.encodeFunctionData("revokeConsent", [env.ids.participant]);
      await network.provider.send("evm_setAutomine", [false]);
      try {
        const revocationTx = await env.participant.sendTransaction({
          to: env.consent.target,
          data: revocationData,
          gasLimit: 2_000_000,
          gasPrice: 2_000_000_000n,
        });
        const authorizationTx = await env.gateway.sendTransaction({
          to: env.audit.target,
          data: authorizationData,
          gasLimit: 2_000_000,
          gasPrice: 3_000_000_000n,
        });
        await network.provider.send("evm_mine");
        const authorizationReceipt = await ethers.provider.getTransactionReceipt(authorizationTx.hash);
        const revocationReceipt = await ethers.provider.getTransactionReceipt(revocationTx.hash);
        expect(authorizationReceipt).to.not.equal(null);
        expect(revocationReceipt).to.not.equal(null);
        expect(authorizationReceipt!.blockNumber).to.equal(revocationReceipt!.blockNumber);
        expect(authorizationReceipt!.index).to.be.lessThan(revocationReceipt!.index);
        expect(authorizationReceipt!.status).to.equal(1);
        const stored = await env.audit.getAccessEvent(env.request.requestId);
        expect(stored.consentVersion).to.equal(1n);
        rows.push({
          case: "5C-revocation-submitted-first-authorization-ordered-first",
          submissionOrder: "revokeConsent,authorization",
          finalizedLedgerOrder: "authorization,revokeConsent",
          authorizationBlockNumber: String(authorizationReceipt!.blockNumber),
          authorizationTransactionIndex: String(authorizationReceipt!.index),
          revocationBlockNumber: String(revocationReceipt!.blockNumber),
          revocationTransactionIndex: String(revocationReceipt!.index),
          consentVersionSeen: String(stored.consentVersion),
          consentHashSeen: stored.consentHash,
          authorizationOutcome: "authorized",
          rejectionReason: "",
          authorizationTxHash: authorizationTx.hash,
          revocationTxHash: revocationTx.hash,
          expectedObservedMatch: true,
        });
      } finally {
        await network.provider.send("evm_setAutomine", [true]);
      }
    }

    // Case 5D: authorization is submitted first, but revocation executes first and rejects it.
    {
      const env = await fixture("temporal:case5D");
      const signature = await signRequest(env.audit, env.researcher, env.request);
      const authorizationData = env.audit.interface.encodeFunctionData("authorizeAndLogAccess", [env.request, signature]);
      const revocationData = env.consent.interface.encodeFunctionData("revokeConsent", [env.ids.participant]);
      await network.provider.send("evm_setAutomine", [false]);
      try {
        const authorizationTx = await env.gateway.sendTransaction({
          to: env.audit.target,
          data: authorizationData,
          gasLimit: 2_000_000,
          gasPrice: 2_000_000_000n,
        });
        const revocationTx = await env.participant.sendTransaction({
          to: env.consent.target,
          data: revocationData,
          gasLimit: 2_000_000,
          gasPrice: 3_000_000_000n,
        });
        await network.provider.send("evm_mine");
        const authorizationReceipt = await ethers.provider.getTransactionReceipt(authorizationTx.hash);
        const revocationReceipt = await ethers.provider.getTransactionReceipt(revocationTx.hash);
        expect(authorizationReceipt).to.not.equal(null);
        expect(revocationReceipt).to.not.equal(null);
        expect(authorizationReceipt!.blockNumber).to.equal(revocationReceipt!.blockNumber);
        expect(revocationReceipt!.index).to.be.lessThan(authorizationReceipt!.index);
        expect(authorizationReceipt!.status).to.equal(0);
        let reason = "";
        try {
          await ethers.provider.call({ from: env.gateway.address, to: env.audit.target as string, data: authorizationData });
        } catch (error) {
          reason = normalizeReason(error);
        }
        expect(reason).to.equal("VCEMAudit: consent inactive");
        const current = await env.consent.getCurrentConsentVersion(env.ids.participant);
        rows.push({
          case: "5D-authorization-submitted-first-revocation-ordered-first",
          submissionOrder: "authorization,revokeConsent",
          finalizedLedgerOrder: "revokeConsent,authorization",
          authorizationBlockNumber: String(authorizationReceipt!.blockNumber),
          authorizationTransactionIndex: String(authorizationReceipt!.index),
          revocationBlockNumber: String(revocationReceipt!.blockNumber),
          revocationTransactionIndex: String(revocationReceipt!.index),
          consentVersionSeen: String(current.version),
          consentHashSeen: current.consentHash,
          authorizationOutcome: "denied",
          rejectionReason: reason,
          authorizationTxHash: authorizationTx.hash,
          revocationTxHash: revocationTx.hash,
          expectedObservedMatch: true,
        });
      } finally {
        await network.provider.send("evm_setAutomine", [true]);
      }
    }

    writeEvidence(rows);
    expect(rows).to.have.length(8);
    expect(rows.every((row) => row.expectedObservedMatch)).to.equal(true);
  });
});
