import { ethers } from "ethers";
import fs from "fs";
import path from "path";

type ConsentRecord = {
  participantId: string;
  version: string;
  previousConsentHash: string;
  consentHash: string;
  status: string;
  blockNumber: number;
  logIndex: number;
};

type AccessRecord = {
  requestId: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  scopeHash: string;
  consentHash: string;
  purpose: string;
  blockNumber: number;
  logIndex: number;
  pass?: boolean;
};

function arg(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length) || process.env[name.toUpperCase()] || fallback;
}

function sample<T>(items: T[], count: number, seed: string) {
  let state = Number(BigInt(ethers.keccak256(ethers.toUtf8Bytes(seed))) & 0xffffffffn);
  const next = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  return [...items].sort(() => next() - 0.5).slice(0, count);
}

async function main() {
  const rpc = arg("rpc", process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545");
  const consentAddress = arg("consent", process.env.VCEM_CONSENT_ADDRESS || "");
  const auditAddress = arg("audit", process.env.VCEM_AUDIT_ADDRESS || "");
  const mode = arg("mode", "full");
  const seed = arg("seed", "vcem-audit");
  const sampleSize = Number(arg("sampleSize", "25"));
  const outDir = arg("outDir", "evidence/audit");
  if (!consentAddress || !auditAddress) {
    throw new Error("VCEM_CONSENT_ADDRESS and VCEM_AUDIT_ADDRESS, or --consent and --audit, are required");
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const consentAbi = JSON.parse(fs.readFileSync(path.join("artifacts", "contracts", "vcem", "VCEMConsent.sol", "VCEMConsent.json"), "utf8")).abi;
  const auditAbi = JSON.parse(fs.readFileSync(path.join("artifacts", "contracts", "vcem", "VCEMAudit.sol", "VCEMAudit.json"), "utf8")).abi;
  const consentInterface = new ethers.Interface(consentAbi);
  const auditInterface = new ethers.Interface(auditAbi);

  const latest = await provider.getBlockNumber();
  const consentLogs = await provider.getLogs({ address: consentAddress, fromBlock: 0, toBlock: latest });
  const auditLogs = await provider.getLogs({ address: auditAddress, fromBlock: 0, toBlock: latest });

  const consentRecords: ConsentRecord[] = [];
  for (const log of consentLogs) {
    try {
      const parsed = consentInterface.parseLog(log);
      if (!parsed || !["ConsentRecorded", "ConsentUpdated", "ConsentRevoked"].includes(parsed.name)) continue;
      consentRecords.push({
        participantId: parsed.args.participantId,
        version: parsed.args.version.toString(),
        previousConsentHash: parsed.args.previousConsentHash,
        consentHash: parsed.args.consentHash,
        status: parsed.args.status.toString(),
        blockNumber: log.blockNumber,
        logIndex: log.index,
      });
    } catch (_err) {
      continue;
    }
  }

  const accessRecords: AccessRecord[] = [];
  for (const log of auditLogs) {
    try {
      const parsed = auditInterface.parseLog(log);
      if (!parsed || parsed.name !== "AccessAuthorized") continue;
      accessRecords.push({
        requestId: parsed.args.requestId,
        participantId: parsed.args.participantId,
        requestorId: parsed.args.requestorId,
        dataHash: parsed.args.dataHash,
        scopeHash: parsed.args.scopeHash,
        consentHash: parsed.args.consentHash,
        purpose: parsed.args.purpose.toString(),
        blockNumber: log.blockNumber,
        logIndex: log.index,
      });
    } catch (_err) {
      continue;
    }
  }

  const selectedAccess = mode === "sample" ? sample(accessRecords, sampleSize, seed) : accessRecords;
  const orderedConsent = [...consentRecords].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  for (const access of selectedAccess) {
    const priorConsent = orderedConsent.filter(
      (record) =>
        record.participantId.toLowerCase() === access.participantId.toLowerCase() &&
        (record.blockNumber < access.blockNumber || (record.blockNumber === access.blockNumber && record.logIndex < access.logIndex))
    );
    const activeAtAccess = priorConsent.length ? priorConsent[priorConsent.length - 1] : undefined;
    access.pass = !!activeAtAccess && activeAtAccess.consentHash.toLowerCase() === access.consentHash.toLowerCase() && activeAtAccess.status === "1";
  }

  const report = {
    mode,
    seed: mode === "sample" ? seed : undefined,
    latestBlock: latest,
    consentRecords: consentRecords.length,
    accessRecords: accessRecords.length,
    verifiedAccessRecords: selectedAccess.length,
    failures: selectedAccess.filter((entry) => !entry.pass).length,
    access: selectedAccess,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "audit-report.json"), JSON.stringify(report, null, 2));
  const header = ["requestId", "participantId", "requestorId", "dataHash", "scopeHash", "consentHash", "purpose", "blockNumber", "logIndex", "pass"];
  fs.writeFileSync(
    path.join(outDir, "audit-report.csv"),
    [header.join(","), ...selectedAccess.map((row: any) => header.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\n")
  );

  console.log(`VCEM audit verification: ${selectedAccess.length} checked, ${report.failures} failures`);
  if (report.failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
