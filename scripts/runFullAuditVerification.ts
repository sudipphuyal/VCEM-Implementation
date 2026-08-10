import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import { verifyVcemAudit } from "./auditVerify";

const repoRoot = path.resolve(__dirname, "..");
const manifestPath = process.env.VCEM_AUDIT_MANIFEST || path.join(repoRoot, "deployments", "vcem-manifest.json");
const reportRoot = process.env.VCEM_AUDIT_INTEGRITY_REPORT_ROOT || path.join(repoRoot, "reports", "audit-integrity");
const rawRoot = path.join(reportRoot, "raw");
const rpc = process.env.BESU_NETWORK_URL || process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";

function csv(value: unknown) {
  return JSON.stringify(value ?? "");
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(rpc);
  const report = await verifyVcemAudit({
    provider,
    registryAddress: manifest.addresses.VCEMRegistry,
    consentAddress: manifest.addresses.VCEMConsent,
    auditAddress: manifest.addresses.VCEMAudit,
    mode: "full",
    writeReports: false,
  });
  const access = report.access as any[];
  const columns = [
    "event_index", "tx_hash", "block_number", "transaction_index", "log_index", "requestId", "participantId",
    "requesterId", "consentVersion", "consentHash", "actorsRoot", "purpose", "scopeHash", "dataHash",
    "blockchain_timestamp", "verification_result", "discrepancy_reason",
  ];
  const timestampByBlock = new Map<number, number>();
  const rows = [];
  for (let index = 0; index < access.length; index++) {
    const record = access[index];
    if (!timestampByBlock.has(record.blockNumber)) {
      const block = await provider.getBlock(record.blockNumber);
      if (!block) throw new Error(`missing block ${record.blockNumber}`);
      timestampByBlock.set(record.blockNumber, block.timestamp);
    }
    rows.push({
    event_index: index + 1,
    tx_hash: record.transactionHash,
    block_number: record.blockNumber,
    transaction_index: record.transactionIndex,
    log_index: record.logIndex,
    requestId: record.requestId,
    participantId: record.participantId,
    requesterId: record.requestorId,
    consentVersion: String(record.consentVersion),
    consentHash: record.consentHash,
    actorsRoot: record.actorsRoot,
    purpose: String(record.purpose),
    scopeHash: record.scopeHash,
    dataHash: record.dataHash,
    blockchain_timestamp: String(timestampByBlock.get(record.blockNumber)),
    verification_result: record.pass ? "VERIFIED" : "DISCREPANCY",
    discrepancy_reason: record.failures.join("|"),
    });
  }
  const summary = {
    provenance: {
      category: "peer-review/revision exhaustive analysis of preserved evaluated ledger",
      deploymentManifest: path.relative(repoRoot, manifestPath),
      evaluatedCommit: manifest.gitCommit,
      rpcSource: "Besu on-chain logs, transaction calldata, receipts, and block metadata",
      applicationLayerLogsUsed: false,
      verifier: "scripts/auditVerify.ts",
      generatedAt: new Date().toISOString(),
    },
    population: {
      recordedAuthorizationEvents: report.accessRecords,
      verifiedAuthorizationEvents: report.verifiedAccessRecords,
      discrepancies: report.accessFailures,
      consentRecords: report.consentRecords,
      dataHashRecords: report.dataHashRecords,
      deniedRecords: report.deniedRecords,
      populationFailures: report.populationFailures,
      firstBlock: rows[0]?.block_number,
      lastBlock: rows.at(-1)?.block_number,
    },
    checks: [
      "requestId", "participantId", "requestorId", "requestedPurpose", "scopeHash", "dataHash", "consentVersion",
      "consentHash", "actorsRoot", "block timestamp", "consent existence/current state", "historical registry role",
      "actor membership", "purpose authorization", "scope authorization", "registered data hash", "request uniqueness",
      "EIP-712 signature/signer", "expectedConsentHash", "request expiry",
    ],
  };
  fs.mkdirSync(rawRoot, { recursive: true });
  fs.writeFileSync(path.join(reportRoot, "full-audit-verification.csv"), [columns.join(","), ...rows.map((row) => columns.map((key) => csv((row as any)[key])).join(","))].join("\n") + "\n");
  fs.writeFileSync(path.join(reportRoot, "audit-verification-summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(rawRoot, "full-audit-report.json"), JSON.stringify(report, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (report.accessFailures || report.consentFailures || report.denialFailures || report.populationFailures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
