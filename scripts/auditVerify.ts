import { ethers } from "ethers";
import fs from "fs";
import path from "path";

type ConsentRecord = {
  participantId: string;
  version: bigint;
  previousConsentHash: string;
  consentHash: string;
  purposeMask: bigint;
  scopeHash: string;
  actorsRoot: string;
  zkConsentCommitment: string;
  status: bigint;
  timestamp: bigint;
  blockNumber: number;
  logIndex: number;
  recomputedHash?: string;
  pass?: boolean;
  failures: string[];
};

type ActorSetRecord = {
  participantId: string;
  version: bigint;
  actorIds: string[];
  actorsRoot: string;
};

type AccessRecord = {
  requestId: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  scopeHash: string;
  consentVersion: bigint;
  consentHash: string;
  actorsRoot: string;
  purpose: bigint;
  blockNumber: number;
  logIndex: number;
  pass?: boolean;
  failures: string[];
};

type DataHashRecord = {
  participantId: string;
  scopeHash: string;
  dataHash: string;
  blockNumber: number;
  logIndex: number;
};

const coder = ethers.AbiCoder.defaultAbiCoder();
const ACTIVE = 1n;

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

function actorSetRoot(actorIds: string[]) {
  const sorted = [...actorIds].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
  return ethers.sha256(coder.encode(["bytes32[]"], [sorted]));
}

function consentHash(record: ConsentRecord) {
  return ethers.sha256(
    coder.encode(
      ["bytes32", "bytes32", "uint64", "uint8", "uint8", "bytes32", "bytes32", "bytes32", "uint64"],
      [
        record.previousConsentHash,
        record.participantId,
        record.version,
        record.status,
        record.purposeMask,
        record.scopeHash,
        record.actorsRoot,
        record.zkConsentCommitment,
        record.timestamp,
      ]
    )
  );
}

function key(participantId: string, version: bigint) {
  return `${participantId.toLowerCase()}:${version.toString()}`;
}

async function main() {
  const rpc = arg("rpc", process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545");
  const consentAddress = arg("consent", process.env.VCEM_CONSENT_ADDRESS || "");
  const auditAddress = arg("audit", process.env.VCEM_AUDIT_ADDRESS || "");
  const mode = arg("mode", "full");
  const seed = arg("seed", "42");
  const sampleSize = Number(arg("sample-size", arg("sampleSize", "100")));
  const outDir = arg("outDir", "evidence/audit");
  if (!consentAddress || !auditAddress) {
    throw new Error("VCEM_CONSENT_ADDRESS and VCEM_AUDIT_ADDRESS, or --consent and --audit, are required");
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const consentArtifact = JSON.parse(fs.readFileSync(path.join("artifacts", "contracts", "vcem", "VCEMConsent.sol", "VCEMConsent.json"), "utf8"));
  const auditArtifact = JSON.parse(fs.readFileSync(path.join("artifacts", "contracts", "vcem", "VCEMAudit.sol", "VCEMAudit.json"), "utf8"));
  const consentInterface = new ethers.Interface(consentArtifact.abi);
  const auditInterface = new ethers.Interface(auditArtifact.abi);

  const latest = await provider.getBlockNumber();
  const consentLogs = await provider.getLogs({ address: consentAddress, fromBlock: 0, toBlock: latest });
  const auditLogs = await provider.getLogs({ address: auditAddress, fromBlock: 0, toBlock: latest });

  const consentRecords: ConsentRecord[] = [];
  const actorSets = new Map<string, ActorSetRecord>();
  for (const log of consentLogs) {
    try {
      const parsed = consentInterface.parseLog(log);
      if (!parsed) continue;
      if (["ConsentRecorded", "ConsentUpdated", "ConsentRevoked"].includes(parsed.name)) {
        consentRecords.push({
          participantId: parsed.args.participantId,
          version: BigInt(parsed.args.version),
          previousConsentHash: parsed.args.previousConsentHash,
          consentHash: parsed.args.consentHash,
          purposeMask: BigInt(parsed.args.purposeMask),
          scopeHash: parsed.args.scopeHash,
          actorsRoot: parsed.args.actorsRoot,
          zkConsentCommitment: parsed.args.zkConsentCommitment,
          status: BigInt(parsed.args.status),
          timestamp: BigInt(parsed.args.timestamp),
          blockNumber: log.blockNumber,
          logIndex: log.index,
          failures: [],
        });
      } else if (parsed.name === "ConsentActorsRecorded") {
        const actorIds = Array.from(parsed.args.actorIds as string[]);
        actorSets.set(key(parsed.args.participantId, BigInt(parsed.args.version)), {
          participantId: parsed.args.participantId,
          version: BigInt(parsed.args.version),
          actorIds,
          actorsRoot: parsed.args.actorsRoot,
        });
      }
    } catch (_err) {
      continue;
    }
  }

  const dataHashes: DataHashRecord[] = [];
  const accessRecords: AccessRecord[] = [];
  for (const log of auditLogs) {
    try {
      const parsed = auditInterface.parseLog(log);
      if (!parsed) continue;
      if (parsed.name === "DataHashRegistered") {
        dataHashes.push({
          participantId: parsed.args.participantId,
          scopeHash: parsed.args.scopeHash,
          dataHash: parsed.args.dataHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
        });
      } else if (parsed.name === "AccessAuthorized") {
        accessRecords.push({
          requestId: parsed.args.requestId,
          participantId: parsed.args.participantId,
          requestorId: parsed.args.requestorId,
          dataHash: parsed.args.dataHash,
          scopeHash: parsed.args.scopeHash,
          purpose: BigInt(parsed.args.requestedPurpose),
          consentVersion: BigInt(parsed.args.consentVersion),
          consentHash: parsed.args.consentHash,
          actorsRoot: parsed.args.actorsRoot,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          failures: [],
        });
      }
    } catch (_err) {
      continue;
    }
  }

  const orderedConsent = [...consentRecords].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  const consentByKey = new Map<string, ConsentRecord>();
  for (const record of orderedConsent) {
    const recordKey = key(record.participantId, record.version);
    const actorSet = actorSets.get(recordKey);
    if (!actorSet) {
      record.failures.push("MISSING_ACTOR_SET_EVENT");
    } else {
      const recomputedRoot = actorSetRoot(actorSet.actorIds);
      if (recomputedRoot.toLowerCase() !== record.actorsRoot.toLowerCase()) {
        record.failures.push("ACTOR_ROOT_MISMATCH");
      }
      if (actorSet.actorsRoot.toLowerCase() !== record.actorsRoot.toLowerCase()) {
        record.failures.push("ACTOR_EVENT_ROOT_MISMATCH");
      }
    }
    record.recomputedHash = consentHash(record);
    if (record.recomputedHash.toLowerCase() !== record.consentHash.toLowerCase()) {
      record.failures.push("CONSENT_HASH_MISMATCH");
    }
    if (record.version > 1n) {
      const previous = consentByKey.get(key(record.participantId, record.version - 1n));
      if (!previous || previous.consentHash.toLowerCase() !== record.previousConsentHash.toLowerCase()) {
        record.failures.push("PREVIOUS_HASH_MISMATCH");
      }
    } else if (record.previousConsentHash !== ethers.ZeroHash) {
      record.failures.push("GENESIS_PREVIOUS_HASH_NONZERO");
    }
    consentByKey.set(recordKey, record);
    record.pass = record.failures.length === 0;
  }

  const selectedAccess = mode === "sample" ? sample(accessRecords, Math.min(sampleSize, accessRecords.length), seed) : accessRecords;
  const seenRequests = new Set<string>();
  for (const access of selectedAccess) {
    const record = consentByKey.get(key(access.participantId, access.consentVersion));
    if (!record) {
      access.failures.push("MISSING_CONSENT_VERSION");
    } else {
      if (record.status !== ACTIVE) access.failures.push("CONSENT_NOT_ACTIVE");
      if (record.consentHash.toLowerCase() !== access.consentHash.toLowerCase()) access.failures.push("ACCESS_CONSENT_HASH_MISMATCH");
      if (record.actorsRoot.toLowerCase() !== access.actorsRoot.toLowerCase()) access.failures.push("ACCESS_ACTOR_ROOT_MISMATCH");
      if (record.scopeHash.toLowerCase() !== access.scopeHash.toLowerCase()) access.failures.push("SCOPE_MISMATCH");
      if ((record.purposeMask & access.purpose) === 0n) access.failures.push("PURPOSE_NOT_ALLOWED");
      const actorSet = actorSets.get(key(access.participantId, access.consentVersion));
      if (!actorSet || !actorSet.actorIds.map((entry) => entry.toLowerCase()).includes(access.requestorId.toLowerCase())) {
        access.failures.push("ACTOR_NOT_IN_VERSION");
      }
    }
    if (seenRequests.has(access.requestId.toLowerCase())) access.failures.push("REQUEST_REPLAY");
    seenRequests.add(access.requestId.toLowerCase());
    const priorDataHashes = dataHashes.filter(
      (entry) =>
        entry.participantId.toLowerCase() === access.participantId.toLowerCase() &&
        entry.scopeHash.toLowerCase() === access.scopeHash.toLowerCase() &&
        (entry.blockNumber < access.blockNumber || (entry.blockNumber === access.blockNumber && entry.logIndex < access.logIndex))
    );
    const priorDataHash = priorDataHashes.length ? priorDataHashes[priorDataHashes.length - 1] : undefined;
    if (!priorDataHash || priorDataHash.dataHash.toLowerCase() !== access.dataHash.toLowerCase()) {
      access.failures.push("DATA_HASH_NOT_REGISTERED");
    }
    access.pass = access.failures.length === 0;
  }

  const consentFailures = consentRecords.filter((entry) => !entry.pass).length;
  const accessFailures = selectedAccess.filter((entry) => !entry.pass).length;
  const report = {
    mode,
    seed: mode === "sample" ? seed : undefined,
    latestBlock: latest,
    consentRecords: consentRecords.length,
    actorSetRecords: actorSets.size,
    dataHashRecords: dataHashes.length,
    accessRecords: accessRecords.length,
    verifiedAccessRecords: selectedAccess.length,
    consentFailures,
    accessFailures,
    bytecode: {
      consent: ethers.keccak256(await provider.getCode(consentAddress)),
      audit: ethers.keccak256(await provider.getCode(auditAddress)),
    },
    consent: consentRecords,
    access: selectedAccess,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "audit-report.json"), JSON.stringify(report, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2));
  const header = ["requestId", "participantId", "requestorId", "dataHash", "scopeHash", "consentVersion", "consentHash", "actorsRoot", "purpose", "blockNumber", "logIndex", "pass", "failures"];
  fs.writeFileSync(
    path.join(outDir, "audit-report.csv"),
    [header.join(","), ...selectedAccess.map((row: any) => header.map((field) => JSON.stringify(row[field] ?? "")).join(","))].join("\n")
  );

  console.log(`VCEM audit verification: ${selectedAccess.length} access events checked, ${accessFailures} access failures, ${consentFailures} consent failures`);
  if (accessFailures > 0 || consentFailures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
