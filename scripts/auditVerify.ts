import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const coder = ethers.AbiCoder.defaultAbiCoder();
const ACTIVE = 1n;
const REVOKED = 3n;
const ROLE_PARTICIPANT = 2n;
const ROLE_RESEARCHER = 3n;
const ROLE_GATEWAY = 5n;

export type AuditVerifyMode = "full" | "sample";

type Position = {
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
};

type ParsedEvent = Position & {
  address: string;
  transactionHash: string;
  eventName: string;
  args: ethers.Result;
};

type ConsentRecord = Position & {
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
  transactionHash: string;
  actorIds: string[];
  recomputedHash?: string;
  recomputedActorsRoot?: string;
  pass?: boolean;
  failures: string[];
};

type AccessRecord = Position & {
  requestId: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  scopeHash: string;
  consentVersion: bigint;
  consentHash: string;
  actorsRoot: string;
  purpose: bigint;
  transactionHash: string;
  calldata?: {
    request: any;
    signer: string;
    expectedConsentHash: string;
    requestExpiry: bigint;
    signatureValid: boolean;
  };
  pass?: boolean;
  failures: string[];
};

type ActorSetRecord = {
  participantId: string;
  version: bigint;
  actorIds: string[];
  actorsRoot: string;
};

type DeniedRecord = Position & {
  requestId: string;
  participantId: string;
  requestorId: string;
  reasonCode: bigint;
  expectedConsentHash: string;
  activeConsentHash: string;
  transactionHash: string;
  pass?: boolean;
  failures: string[];
};

type DataHashRecord = Position & {
  participantId: string;
  scopeHash: string;
  dataHash: string;
};

type RegistryState = {
  walletById: Map<string, string>;
  rolesById: Map<string, Set<bigint>>;
  activeById: Map<string, boolean>;
  revokedById: Map<string, boolean>;
};

export type AuditEvidence = {
  consentRecords: ConsentRecord[];
  actorSetRecords: ActorSetRecord[];
  accessRecords: AccessRecord[];
  deniedRecords: DeniedRecord[];
  dataHashes: DataHashRecord[];
};

export type AuditVerifyOptions = {
  rpc?: string;
  provider?: ethers.Provider;
  registryAddress: string;
  consentAddress: string;
  auditAddress: string;
  mode?: AuditVerifyMode;
  sampleSize?: number;
  seed?: string;
  outDir?: string;
  fromBlock?: number;
  toBlock?: number | "latest";
  writeReports?: boolean;
  tamper?: (evidence: AuditEvidence) => void;
  tamperAfterDecode?: (evidence: AuditEvidence) => void;
};

function parseArgs(argv: string[]) {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const entry = argv[i];
    if (!entry.startsWith("--")) continue;
    const trimmed = entry.slice(2);
    const eq = trimmed.indexOf("=");
    if (eq >= 0) {
      values[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    } else {
      values[trimmed] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    }
  }
  return values;
}

function lower(value: string) {
  return value.toLowerCase();
}

function eventLessThan(a: Position, b: Position) {
  return (
    a.blockNumber < b.blockNumber ||
    (a.blockNumber === b.blockNumber && a.transactionIndex < b.transactionIndex) ||
    (a.blockNumber === b.blockNumber && a.transactionIndex === b.transactionIndex && a.logIndex < b.logIndex)
  );
}

function sortByPosition<T extends Position>(items: T[]) {
  return [...items].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex
  );
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
  return `${lower(participantId)}:${version.toString()}`;
}

function seededShuffle<T>(items: T[], seed: string) {
  let state = Number(BigInt(ethers.keccak256(ethers.toUtf8Bytes(seed))) & 0xffffffffn);
  const next = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  return [...items].sort(() => next() - 0.5);
}

function sampleAccess(records: AccessRecord[], count: number, seed: string, consentByKey: Map<string, ConsentRecord>) {
  if (records.length <= count) return records;
  const buckets = new Map<string, AccessRecord[]>();
  for (const record of records) {
    const consent = consentByKey.get(key(record.participantId, record.consentVersion));
    const name = consent?.version === 1n ? "initial-active" : consent?.status === REVOKED ? "revoked" : "modified-active";
    buckets.set(name, [...(buckets.get(name) ?? []), record]);
  }
  const bucketNames = [...buckets.keys()].sort();
  const selected: AccessRecord[] = [];
  for (const name of bucketNames) {
    const bucket = seededShuffle(buckets.get(name) ?? [], `${seed}:${name}`);
    const target = Math.min(bucket.length, Math.floor(count / bucketNames.length));
    selected.push(...bucket.slice(0, target));
  }
  const selectedIds = new Set(selected.map((entry) => entry.requestId));
  for (const record of seededShuffle(records, `${seed}:remainder`)) {
    if (selected.length >= count) break;
    if (!selectedIds.has(record.requestId)) {
      selected.push(record);
      selectedIds.add(record.requestId);
    }
  }
  return sortByPosition(selected);
}

function emptyRegistryState(): RegistryState {
  return { walletById: new Map(), rolesById: new Map(), activeById: new Map(), revokedById: new Map() };
}

function cloneRegistryState(state: RegistryState): RegistryState {
  const rolesById = new Map<string, Set<bigint>>();
  for (const [actorId, roles] of state.rolesById.entries()) rolesById.set(actorId, new Set(roles));
  return {
    walletById: new Map(state.walletById),
    rolesById,
    activeById: new Map(state.activeById),
    revokedById: new Map(state.revokedById),
  };
}

function applyRegistryEvent(state: RegistryState, event: ParsedEvent) {
  if (event.eventName === "ActorRegistered") {
    const actorId = lower(event.args.actorId);
    state.walletById.set(actorId, lower(event.args.wallet));
    state.activeById.set(actorId, true);
    state.revokedById.set(actorId, false);
    if (!state.rolesById.has(actorId)) state.rolesById.set(actorId, new Set());
    state.rolesById.get(actorId)!.add(BigInt(event.args.primaryRole));
  } else if (event.eventName === "RoleGranted") {
    const actorId = lower(event.args.actorId);
    if (!state.rolesById.has(actorId)) state.rolesById.set(actorId, new Set());
    state.rolesById.get(actorId)!.add(BigInt(event.args.role));
  } else if (event.eventName === "RoleRevoked") {
    state.rolesById.get(lower(event.args.actorId))?.delete(BigInt(event.args.role));
  } else if (event.eventName === "ActorWalletUpdated") {
    state.walletById.set(lower(event.args.actorId), lower(event.args.newWallet));
  } else if (event.eventName === "ActorRevoked") {
    const actorId = lower(event.args.actorId);
    state.activeById.set(actorId, false);
    state.revokedById.set(actorId, true);
    state.rolesById.set(actorId, new Set());
  }
}

function hasRole(state: RegistryState, actorId: string, role: bigint) {
  const normalized = lower(actorId);
  return (
    state.activeById.get(normalized) === true &&
    state.revokedById.get(normalized) !== true &&
    state.walletById.has(normalized) &&
    state.rolesById.get(normalized)?.has(role) === true
  );
}

function walletOf(state: RegistryState, actorId: string) {
  return state.walletById.get(lower(actorId));
}

function registryAt(events: ParsedEvent[], position: Position) {
  const state = emptyRegistryState();
  for (const event of sortByPosition(events)) {
    if (!eventLessThan(event, position)) break;
    applyRegistryEvent(state, event);
  }
  return state;
}

async function parseLogs(provider: ethers.Provider, address: string, iface: ethers.Interface, fromBlock: number, toBlock: number) {
  const logs = await provider.getLogs({ address, fromBlock, toBlock });
  const parsed: ParsedEvent[] = [];
  for (const log of logs) {
    const event = iface.parseLog(log);
    if (!event) continue;
    parsed.push({
      address: lower(log.address),
      transactionHash: log.transactionHash,
      eventName: event.name,
      args: event.args,
      blockNumber: log.blockNumber,
      transactionIndex: log.transactionIndex,
      logIndex: log.index,
    });
  }
  return sortByPosition(parsed);
}

async function blockTimestamp(provider: ethers.Provider, blockNumber: number) {
  const block = await provider.getBlock(blockNumber);
  if (!block) throw new Error(`missing block ${blockNumber}`);
  return BigInt(block.timestamp);
}

function loadArtifact(contractFile: string, contractName: string) {
  return JSON.parse(fs.readFileSync(path.join("artifacts", "contracts", "vcem", contractFile, `${contractName}.json`), "utf8"));
}

function accessTypes() {
  return {
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
  };
}

async function decodeAccessCalldata(provider: ethers.Provider, auditInterface: ethers.Interface, auditAddress: string, event: AccessRecord) {
  const tx = await provider.getTransaction(event.transactionHash);
  if (!tx) {
    event.failures.push("MISSING_ACCESS_TRANSACTION");
    return;
  }
  const parsed = auditInterface.parseTransaction({ data: tx.data, value: tx.value });
  if (!parsed || parsed.name !== "authorizeAndLogAccess") {
    event.failures.push("ACCESS_CALLDATA_NOT_AUTHORIZE");
    return;
  }
  const request = parsed.args.request;
  const signature = parsed.args.actorSignature as string;
  const network = await provider.getNetwork();
  const message = {
    participantId: request.participantId,
    requestorId: request.requestorId,
    dataHash: request.dataHash,
    scopeHash: request.scopeHash,
    requestedPurpose: Number(request.requestedPurpose),
    requestId: request.requestId,
    clientTimestamp: BigInt(request.clientTimestamp),
    requestExpiry: BigInt(request.requestExpiry),
    expectedConsentHash: request.expectedConsentHash,
  };
  const signer = ethers.verifyTypedData(
    { name: "VCEMAudit", version: "1", chainId: network.chainId, verifyingContract: auditAddress },
    accessTypes(),
    message,
    signature
  );
  event.calldata = {
    request: message,
    signer,
    expectedConsentHash: message.expectedConsentHash,
    requestExpiry: message.requestExpiry,
    signatureValid: ethers.isAddress(signer),
  };
}

export async function verifyVcemAudit(options: AuditVerifyOptions) {
  const provider = options.provider ?? new ethers.JsonRpcProvider(options.rpc || "http://127.0.0.1:8545");
  const registryArtifact = loadArtifact("VCEMRegistry.sol", "VCEMRegistry");
  const consentArtifact = loadArtifact("VCEMConsent.sol", "VCEMConsent");
  const auditArtifact = loadArtifact("VCEMAudit.sol", "VCEMAudit");
  const registryInterface = new ethers.Interface(registryArtifact.abi);
  const consentInterface = new ethers.Interface(consentArtifact.abi);
  const auditInterface = new ethers.Interface(auditArtifact.abi);
  const latest = options.toBlock === undefined || options.toBlock === "latest" ? await provider.getBlockNumber() : options.toBlock;
  const fromBlock = options.fromBlock ?? 0;

  const [registryEvents, consentEvents, auditEvents] = await Promise.all([
    parseLogs(provider, options.registryAddress, registryInterface, fromBlock, latest),
    parseLogs(provider, options.consentAddress, consentInterface, fromBlock, latest),
    parseLogs(provider, options.auditAddress, auditInterface, fromBlock, latest),
  ]);

  const actorSetRecords: ActorSetRecord[] = [];
  const consentRecords: ConsentRecord[] = [];
  for (const event of consentEvents) {
    if (["ConsentRecorded", "ConsentUpdated", "ConsentRevoked"].includes(event.eventName)) {
      consentRecords.push({
        participantId: event.args.participantId,
        version: BigInt(event.args.version),
        previousConsentHash: event.args.previousConsentHash,
        consentHash: event.args.consentHash,
        purposeMask: BigInt(event.args.purposeMask),
        scopeHash: event.args.scopeHash,
        actorsRoot: event.args.actorsRoot,
        zkConsentCommitment: event.args.zkConsentCommitment,
        status: BigInt(event.args.status),
        timestamp: BigInt(event.args.timestamp),
        transactionHash: event.transactionHash,
        actorIds: [],
        blockNumber: event.blockNumber,
        transactionIndex: event.transactionIndex,
        logIndex: event.logIndex,
        failures: [],
      });
    } else if (event.eventName === "ConsentActorsRecorded") {
      actorSetRecords.push({
        participantId: event.args.participantId,
        version: BigInt(event.args.version),
        actorIds: Array.from(event.args.actorIds as string[]),
        actorsRoot: event.args.actorsRoot,
      });
    }
  }

  const dataHashes: DataHashRecord[] = [];
  const accessRecords: AccessRecord[] = [];
  const deniedRecords: DeniedRecord[] = [];
  for (const event of auditEvents) {
    if (event.eventName === "DataHashRegistered") {
      dataHashes.push({
        participantId: event.args.participantId,
        scopeHash: event.args.scopeHash,
        dataHash: event.args.dataHash,
        blockNumber: event.blockNumber,
        transactionIndex: event.transactionIndex,
        logIndex: event.logIndex,
      });
    } else if (event.eventName === "AccessAuthorized") {
      accessRecords.push({
        requestId: event.args.requestId,
        participantId: event.args.participantId,
        requestorId: event.args.requestorId,
        dataHash: event.args.dataHash,
        scopeHash: event.args.scopeHash,
        purpose: BigInt(event.args.requestedPurpose),
        consentVersion: BigInt(event.args.consentVersion),
        consentHash: event.args.consentHash,
        actorsRoot: event.args.actorsRoot,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        transactionIndex: event.transactionIndex,
        logIndex: event.logIndex,
        failures: [],
      });
    } else if (event.eventName === "AccessDenied") {
      deniedRecords.push({
        requestId: event.args.requestId,
        participantId: event.args.participantId,
        requestorId: event.args.requestorId,
        reasonCode: BigInt(event.args.reasonCode),
        expectedConsentHash: event.args.expectedConsentHash,
        activeConsentHash: event.args.activeConsentHash,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        transactionIndex: event.transactionIndex,
        logIndex: event.logIndex,
        failures: [],
      });
    }
  }

  const evidence: AuditEvidence = { consentRecords, actorSetRecords, accessRecords, deniedRecords, dataHashes };
  options.tamper?.(evidence);

  const orderedConsent = sortByPosition(evidence.consentRecords);
  const actorSets = new Map(evidence.actorSetRecords.map((record) => [key(record.participantId, record.version), record]));
  const consentByKey = new Map<string, ConsentRecord>();
  const immutableSeen = new Map<string, string>();
  for (const record of orderedConsent) {
    const recordKey = key(record.participantId, record.version);
    const actorSet = actorSets.get(recordKey);
    if (!actorSet) {
      record.failures.push("MISSING_ACTOR_SET_EVENT");
    } else {
      record.actorIds = actorSet.actorIds;
      record.recomputedActorsRoot = actorSetRoot(actorSet.actorIds);
      if (record.recomputedActorsRoot.toLowerCase() !== record.actorsRoot.toLowerCase()) record.failures.push("ACTOR_ROOT_MISMATCH");
      if (actorSet.actorsRoot.toLowerCase() !== record.actorsRoot.toLowerCase()) record.failures.push("ACTOR_EVENT_ROOT_MISMATCH");
      if (new Set(actorSet.actorIds.map(lower)).size !== actorSet.actorIds.length) record.failures.push("DUPLICATE_ACTOR_IN_VERSION");
    }
    record.recomputedHash = consentHash(record);
    if (record.recomputedHash.toLowerCase() !== record.consentHash.toLowerCase()) record.failures.push("CONSENT_HASH_MISMATCH");
    if (record.version > 1n) {
      const previous = consentByKey.get(key(record.participantId, record.version - 1n));
      if (!previous || previous.consentHash.toLowerCase() !== record.previousConsentHash.toLowerCase()) {
        record.failures.push("PREVIOUS_HASH_MISMATCH");
      }
    } else if (record.previousConsentHash !== ethers.ZeroHash) {
      record.failures.push("GENESIS_PREVIOUS_HASH_NONZERO");
    }
    if (immutableSeen.has(recordKey) && immutableSeen.get(recordKey) !== record.consentHash) {
      record.failures.push("IMMUTABLE_VERSION_CHANGED");
    }
    immutableSeen.set(recordKey, record.consentHash);

    const tx = await provider.getTransaction(record.transactionHash);
    if (!tx) {
      record.failures.push("MISSING_CONSENT_TRANSACTION");
    } else {
      const registryState = registryAt(registryEvents, record);
      const participantWallet = walletOf(registryState, record.participantId);
      if (!participantWallet || lower(tx.from) !== participantWallet) record.failures.push("CONSENT_NOT_PARTICIPANT_SIGNED");
      if (!hasRole(registryState, record.participantId, ROLE_PARTICIPANT)) record.failures.push("PARTICIPANT_ROLE_INACTIVE");
      const parsed = consentInterface.parseTransaction({ data: tx.data, value: tx.value });
      const expected =
        record.version === 1n ? "createConsent" : record.status === REVOKED ? "revokeConsent" : "updateConsent";
      if (!parsed || parsed.name !== expected) record.failures.push("CONSENT_CALL_MISMATCH");
      if (parsed?.args.participantId && lower(parsed.args.participantId) !== lower(record.participantId)) {
        record.failures.push("CONSENT_CALL_PARTICIPANT_MISMATCH");
      }
    }

    consentByKey.set(recordKey, record);
    record.pass = record.failures.length === 0;
  }

  const selectedAccess =
    (options.mode ?? "full") === "sample"
      ? sampleAccess(evidence.accessRecords, Math.min(options.sampleSize ?? 100, evidence.accessRecords.length), options.seed ?? "42", consentByKey)
      : sortByPosition(evidence.accessRecords);

  const seenRequests = new Set<string>();
  for (const access of selectedAccess) {
    await decodeAccessCalldata(provider, auditInterface, options.auditAddress, access);
  }
  options.tamperAfterDecode?.(evidence);

  for (const access of selectedAccess) {
    const record = consentByKey.get(key(access.participantId, access.consentVersion));
    const priorParticipantConsent = orderedConsent.filter(
      (entry) => lower(entry.participantId) === lower(access.participantId) && eventLessThan(entry, access)
    );
    const latestAtAccess = priorParticipantConsent.length ? priorParticipantConsent[priorParticipantConsent.length - 1] : undefined;
    if (!record) {
      access.failures.push("MISSING_CONSENT_VERSION");
    } else {
      if (record.status !== ACTIVE) access.failures.push("CONSENT_NOT_ACTIVE");
      if (!latestAtAccess || latestAtAccess.version !== access.consentVersion) access.failures.push("STALE_CONSENT_VERSION");
      if (latestAtAccess && latestAtAccess.status !== ACTIVE) access.failures.push("LATEST_CONSENT_NOT_ACTIVE");
      if (record.consentHash.toLowerCase() !== access.consentHash.toLowerCase()) access.failures.push("ACCESS_CONSENT_HASH_MISMATCH");
      if (record.actorsRoot.toLowerCase() !== access.actorsRoot.toLowerCase()) access.failures.push("ACCESS_ACTOR_ROOT_MISMATCH");
      if (record.scopeHash.toLowerCase() !== access.scopeHash.toLowerCase()) access.failures.push("SCOPE_MISMATCH");
      if ((record.purposeMask & access.purpose) === 0n) access.failures.push("PURPOSE_NOT_ALLOWED");
      if (!record.actorIds.map(lower).includes(lower(access.requestorId))) access.failures.push("ACTOR_NOT_IN_VERSION");
    }
    if (seenRequests.has(lower(access.requestId))) access.failures.push("REQUEST_REPLAY");
    seenRequests.add(lower(access.requestId));
    const priorDataHashes = sortByPosition(evidence.dataHashes).filter(
      (entry) =>
        lower(entry.participantId) === lower(access.participantId) &&
        lower(entry.scopeHash) === lower(access.scopeHash) &&
        eventLessThan(entry, access)
    );
    const priorDataHash = priorDataHashes.length ? priorDataHashes[priorDataHashes.length - 1] : undefined;
    if (!priorDataHash || lower(priorDataHash.dataHash) !== lower(access.dataHash)) access.failures.push("DATA_HASH_NOT_REGISTERED");

    if (!access.calldata) {
      access.failures.push("MISSING_ACCESS_CALLDATA");
    } else {
      const req = access.calldata.request;
      if (lower(req.requestId) !== lower(access.requestId)) access.failures.push("CALLDATA_REQUEST_ID_MISMATCH");
      if (lower(req.participantId) !== lower(access.participantId)) access.failures.push("CALLDATA_PARTICIPANT_MISMATCH");
      if (lower(req.requestorId) !== lower(access.requestorId)) access.failures.push("CALLDATA_REQUESTOR_MISMATCH");
      if (lower(req.dataHash) !== lower(access.dataHash)) access.failures.push("CALLDATA_DATA_HASH_MISMATCH");
      if (lower(req.scopeHash) !== lower(access.scopeHash)) access.failures.push("CALLDATA_SCOPE_MISMATCH");
      if (BigInt(req.requestedPurpose) !== access.purpose) access.failures.push("CALLDATA_PURPOSE_MISMATCH");
      if (lower(req.expectedConsentHash) !== lower(access.consentHash)) access.failures.push("EXPECTED_CONSENT_HASH_MISMATCH");
      if (access.calldata.requestExpiry < await blockTimestamp(provider, access.blockNumber)) access.failures.push("REQUEST_EXPIRED_AT_BLOCK");
      const registryState = registryAt(registryEvents, access);
      const requestorWallet = walletOf(registryState, access.requestorId);
      if (!requestorWallet || lower(access.calldata.signer) !== requestorWallet) access.failures.push("INVALID_REQUEST_SIGNATURE");
      if (!hasRole(registryState, access.requestorId, ROLE_RESEARCHER)) access.failures.push("REQUESTOR_NOT_ACTIVE_RESEARCHER");
    }
    access.pass = access.failures.length === 0;
  }

  for (const denied of evidence.deniedRecords) {
    if (denied.requestId === ethers.ZeroHash) denied.failures.push("DENIED_EMPTY_REQUEST_ID");
    if (denied.reasonCode === 0n) denied.failures.push("DENIED_EMPTY_REASON");
    const tx = await provider.getTransaction(denied.transactionHash);
    if (!tx) {
      denied.failures.push("MISSING_DENIED_TRANSACTION");
    } else {
      const registryState = registryAt(registryEvents, denied);
      const callerActorId = [...registryState.walletById.entries()].find(([, wallet]) => wallet === lower(tx.from))?.[0];
      if (!callerActorId || !hasRole(registryState, callerActorId, ROLE_GATEWAY)) denied.failures.push("DENIED_NOT_GATEWAY_SIGNED");
    }
    denied.pass = denied.failures.length === 0;
  }

  const consentFailures = evidence.consentRecords.filter((entry) => !entry.pass).length;
  const accessFailures = selectedAccess.filter((entry) => !entry.pass).length;
  const denialFailures = evidence.deniedRecords.filter((entry) => !entry.pass).length;
  const report = {
    mode: options.mode ?? "full",
    seed: options.mode === "sample" ? options.seed ?? "42" : undefined,
    sampleRequested: options.mode === "sample" ? options.sampleSize ?? 100 : undefined,
    sampleNotice:
      options.mode === "sample" && evidence.accessRecords.length < (options.sampleSize ?? 100)
        ? `fewer than requested eligible events exist: ${evidence.accessRecords.length}`
        : undefined,
    latestBlock: latest,
    consentRecords: evidence.consentRecords.length,
    dataHashRecords: evidence.dataHashes.length,
    accessRecords: evidence.accessRecords.length,
    verifiedAccessRecords: selectedAccess.length,
    deniedRecords: evidence.deniedRecords.length,
    consentFailures,
    accessFailures,
    denialFailures,
    consent: evidence.consentRecords,
    access: selectedAccess,
    denied: evidence.deniedRecords,
  };

  if (options.writeReports !== false) {
    const outDir = options.outDir ?? "evidence/audit";
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "audit-report.json"), JSON.stringify(report, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2));
    const header = [
      "requestId",
      "participantId",
      "requestorId",
      "dataHash",
      "scopeHash",
      "consentVersion",
      "consentHash",
      "actorsRoot",
      "purpose",
      "blockNumber",
      "transactionIndex",
      "logIndex",
      "pass",
      "failures",
    ];
    fs.writeFileSync(
      path.join(outDir, "audit-report.csv"),
      [header.join(","), ...selectedAccess.map((row: any) => header.map((field) => JSON.stringify(row[field] ?? "")).join(","))].join("\n")
    );
  }

  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const registryAddress = args.registry || process.env.VCEM_REGISTRY_ADDRESS || "";
  const consentAddress = args.consent || process.env.VCEM_CONSENT_ADDRESS || "";
  const auditAddress = args.audit || process.env.VCEM_AUDIT_ADDRESS || "";
  if (!registryAddress || !consentAddress || !auditAddress) {
    throw new Error("VCEM_REGISTRY_ADDRESS, VCEM_CONSENT_ADDRESS, and VCEM_AUDIT_ADDRESS or --registry/--consent/--audit are required");
  }
  const report = await verifyVcemAudit({
    rpc: args.rpc || process.env.LOCAL_RPC_URL || process.env.BESU_NETWORK_URL || "http://127.0.0.1:8545",
    registryAddress,
    consentAddress,
    auditAddress,
    mode: (args.mode as AuditVerifyMode) || "full",
    sampleSize: Number(args["sample-size"] || args.sampleSize || "100"),
    seed: args.seed || "42",
    outDir: args.outDir || "evidence/audit",
  });
  console.log(
    `VCEM audit verification: ${report.verifiedAccessRecords} access events checked, ${report.accessFailures} access failures, ${report.consentFailures} consent failures, ${report.denialFailures} denial failures`
  );
  if (report.accessFailures > 0 || report.consentFailures > 0 || report.denialFailures > 0) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
