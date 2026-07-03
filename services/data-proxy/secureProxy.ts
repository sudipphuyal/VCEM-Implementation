import { ethers } from "ethers";
import { decryptArtifact } from "./crypto";
import { ArtifactStore } from "../storage/artifactStore";
import { KeyProvider } from "../encryption/keyProvider";
import { AuthSession } from "../auth/walletAuth";

export const ACCESS_AUTHORIZED_TOPIC = ethers.id(
  "AccessAuthorized(bytes32,bytes32,bytes32,bytes32,bytes32,uint8,uint64,bytes32,bytes32,uint64)"
);

export type AuthorizedAccess = {
  requestId: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  scopeHash: string;
  purpose: bigint;
  consentVersion: bigint;
  consentHash: string;
  actorsRoot: string;
  blockNumber: number;
  transactionHash: string;
};

export type ReleaseRequest = {
  session: AuthSession;
  receipt: {
    status?: number | bigint | null;
    chainId?: bigint;
    transactionHash?: string;
    blockNumber?: number;
    confirmations?: number;
    logs: Array<{ address: string; topics: readonly string[]; data: string }>;
  };
  expectedChainId: bigint;
  auditAddress: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  scopeHash: string;
  purpose: bigint;
  requestId: string;
  consentVersion: bigint;
  consentHash: string;
  minConfirmations: number;
};

export type DeliveryRecord = {
  requestId: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  deliveredAt: string;
  transactionHash: string;
  outcome: "released";
};

export class DeliveryLedger {
  private records = new Map<string, DeliveryRecord>();

  has(requestId: string) {
    return this.records.has(requestId.toLowerCase());
  }

  record(record: DeliveryRecord) {
    const key = record.requestId.toLowerCase();
    if (this.records.has(key)) {
      throw new Error("request ID has already been delivered");
    }
    this.records.set(key, record);
  }

  all() {
    return [...this.records.values()];
  }
}

export class PolicyEnforcingDataProxy {
  constructor(
    private readonly artifactStore: ArtifactStore,
    private readonly keyProvider: KeyProvider,
    private readonly ledger = new DeliveryLedger()
  ) {}

  release(request: ReleaseRequest) {
    if (request.session.requestorId.toLowerCase() !== request.requestorId.toLowerCase()) {
      throw new Error("authenticated requestor does not match authorization");
    }
    if (this.ledger.has(request.requestId)) {
      throw new Error("request ID has already been delivered");
    }

    const authorized = verifyAuthorizedReceipt(request);
    const artifact = this.artifactStore.read(authorized.dataHash);
    const plaintext = decryptArtifact(this.keyProvider.getKey(artifact.keyId), artifact);
    const computedHash = ethers.sha256(plaintext);
    if (computedHash.toLowerCase() !== authorized.dataHash.toLowerCase()) {
      throw new Error("artifact integrity hash mismatch");
    }

    this.ledger.record({
      requestId: authorized.requestId,
      participantId: authorized.participantId,
      requestorId: authorized.requestorId,
      dataHash: authorized.dataHash,
      deliveredAt: new Date().toISOString(),
      transactionHash: authorized.transactionHash,
      outcome: "released",
    });

    return plaintext;
  }
}

export function verifyAuthorizedReceipt(request: ReleaseRequest): AuthorizedAccess {
  const receipt = request.receipt;
  if (receipt.status !== 1 && receipt.status !== 1n) {
    throw new Error("authorization transaction is missing or failed");
  }
  if (receipt.chainId !== undefined && receipt.chainId !== request.expectedChainId) {
    throw new Error("authorization receipt chain mismatch");
  }
  if ((receipt.confirmations ?? 0) < request.minConfirmations) {
    throw new Error("authorization transaction lacks required finality");
  }

  const log = receipt.logs.find(
    (entry) => entry.address.toLowerCase() === request.auditAddress.toLowerCase() && entry.topics[0] === ACCESS_AUTHORIZED_TOPIC
  );
  if (!log) {
    throw new Error("transaction does not contain a VCEM AccessAuthorized event");
  }

  const requestId = log.topics[1];
  const participantId = log.topics[2];
  const requestorId = log.topics[3];
  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
    ["bytes32", "bytes32", "uint8", "uint64", "bytes32", "bytes32", "uint64"],
    log.data
  );
  const authorized: AuthorizedAccess = {
    requestId,
    participantId,
    requestorId,
    dataHash: decoded[0] as string,
    scopeHash: decoded[1] as string,
    purpose: BigInt(decoded[2]),
    consentVersion: BigInt(decoded[3]),
    consentHash: decoded[4] as string,
    actorsRoot: decoded[5] as string,
    blockNumber: receipt.blockNumber ?? 0,
    transactionHash: receipt.transactionHash ?? "",
  };

  const checks: Array<[boolean, string]> = [
    [authorized.requestId.toLowerCase() === request.requestId.toLowerCase(), "request ID mismatch"],
    [authorized.participantId.toLowerCase() === request.participantId.toLowerCase(), "participant mismatch"],
    [authorized.requestorId.toLowerCase() === request.requestorId.toLowerCase(), "requestor mismatch"],
    [authorized.dataHash.toLowerCase() === request.dataHash.toLowerCase(), "data hash mismatch"],
    [authorized.scopeHash.toLowerCase() === request.scopeHash.toLowerCase(), "scope mismatch"],
    [authorized.purpose === request.purpose, "purpose mismatch"],
    [authorized.consentVersion === request.consentVersion, "consent version mismatch"],
    [authorized.consentHash.toLowerCase() === request.consentHash.toLowerCase(), "consent hash mismatch"],
  ];
  for (const [ok, message] of checks) {
    if (!ok) throw new Error(message);
  }
  return authorized;
}
