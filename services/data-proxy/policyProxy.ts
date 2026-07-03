import { ethers } from "ethers";
import { AuthSession } from "../auth/walletAuth";
import { KeyProvider } from "../encryption/keyProvider";
import { ArtifactStore } from "../storage/artifactStore";
import { decryptArtifact } from "./crypto";
import { ACCESS_AUTHORIZED_TOPIC, AuthorizedAccess, verifyAuthorizedReceipt } from "./secureProxy";
import { AsyncDeliveryLedger } from "./deliveryLedger";

export type ChainReceiptProvider = {
  getTransactionReceipt(transactionHash: string): Promise<any | null>;
  getNetwork(): Promise<{ chainId: bigint }>;
};

export type AuthorizedReleaseInput = {
  session: AuthSession;
  transactionHash: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  scopeHash: string;
  purpose: bigint;
  requestId: string;
  consentVersion: bigint;
  consentHash: string;
  actorsRoot: string;
};

export class PolicyDataProxy {
  constructor(
    private readonly provider: ChainReceiptProvider,
    private readonly artifactStore: ArtifactStore,
    private readonly keyProvider: KeyProvider,
    private readonly ledger: AsyncDeliveryLedger,
    private readonly config: { chainId: bigint; auditAddress: string; minConfirmations: number }
  ) {}

  async release(input: AuthorizedReleaseInput) {
    const normalizedAudit = ethers.getAddress(this.config.auditAddress);
    if (input.session.requestorId.toLowerCase() !== input.requestorId.toLowerCase()) {
      await this.recordDenied(input, "SESSION_REQUESTOR_MISMATCH");
      throw new Error("authenticated requestor does not match authorization");
    }
    if (await this.ledger.has(input.requestId)) {
      throw new Error("request ID has already been delivered");
    }

    const network = await this.provider.getNetwork();
    if (network.chainId !== this.config.chainId) {
      await this.recordDenied(input, "CHAIN_ID_MISMATCH");
      throw new Error("configured chain ID mismatch");
    }
    const receipt = await this.provider.getTransactionReceipt(input.transactionHash);
    if (!receipt) {
      await this.recordDenied(input, "MISSING_AUTHORIZATION_RECEIPT");
      throw new Error("authorization transaction is missing or failed");
    }
    const authorized = verifyAuthorizedReceipt({
      session: input.session,
      receipt,
      expectedChainId: this.config.chainId,
      auditAddress: normalizedAudit,
      participantId: input.participantId,
      requestorId: input.requestorId,
      dataHash: input.dataHash,
      scopeHash: input.scopeHash,
      purpose: input.purpose,
      requestId: input.requestId,
      consentVersion: input.consentVersion,
      consentHash: input.consentHash,
      minConfirmations: this.config.minConfirmations,
    });
    if (authorized.actorsRoot.toLowerCase() !== input.actorsRoot.toLowerCase()) {
      await this.recordDenied(input, "ACTOR_ROOT_MISMATCH");
      throw new Error("actor root mismatch");
    }
    const artifact = this.artifactStore.read(authorized.dataHash);
    const plaintext = decryptArtifact(this.keyProvider.getKey(artifact.keyId), artifact);
    if (ethers.sha256(plaintext).toLowerCase() !== authorized.dataHash.toLowerCase()) {
      await this.recordDenied(input, "ARTIFACT_INTEGRITY_MISMATCH");
      throw new Error("artifact integrity hash mismatch");
    }
    await this.ledger.record({
      requestId: authorized.requestId,
      participantId: authorized.participantId,
      requestorId: authorized.requestorId,
      dataHash: authorized.dataHash,
      authorizationTxHash: authorized.transactionHash,
      releaseResult: "released",
    });
    return plaintext;
  }

  decodeAuthorized(receipt: { logs: Array<{ address: string; topics: readonly string[]; data: string }> }): AuthorizedAccess {
    const log = receipt.logs.find(
      (entry) => entry.address.toLowerCase() === this.config.auditAddress.toLowerCase() && entry.topics[0] === ACCESS_AUTHORIZED_TOPIC
    );
    if (!log) throw new Error("transaction does not contain a VCEM AccessAuthorized event");
    return verifyAuthorizedReceipt({
      session: { wallet: ethers.ZeroAddress, requestorId: ethers.ZeroHash, authenticatedAt: 0, expiresAt: 0, tokenHash: "" },
      receipt: { status: 1, logs: [log], confirmations: this.config.minConfirmations },
      expectedChainId: this.config.chainId,
      auditAddress: this.config.auditAddress,
      participantId: log.topics[2],
      requestorId: log.topics[3],
      dataHash: ethers.AbiCoder.defaultAbiCoder().decode(["bytes32"], log.data)[0],
      scopeHash: ethers.AbiCoder.defaultAbiCoder().decode(["bytes32", "bytes32"], log.data)[1],
      purpose: BigInt(ethers.AbiCoder.defaultAbiCoder().decode(["bytes32", "bytes32", "uint8"], log.data)[2]),
      requestId: log.topics[1],
      consentVersion: BigInt(ethers.AbiCoder.defaultAbiCoder().decode(["bytes32", "bytes32", "uint8", "uint64"], log.data)[3]),
      consentHash: ethers.AbiCoder.defaultAbiCoder().decode(["bytes32", "bytes32", "uint8", "uint64", "bytes32"], log.data)[4],
      minConfirmations: this.config.minConfirmations,
    });
  }

  private async recordDenied(input: AuthorizedReleaseInput, errorCode: string) {
    if (await this.ledger.has(input.requestId)) return;
    await this.ledger.record({
      requestId: input.requestId,
      participantId: input.participantId,
      requestorId: input.requestorId,
      dataHash: input.dataHash,
      authorizationTxHash: input.transactionHash,
      releaseResult: "denied",
      errorCode,
    });
  }
}
