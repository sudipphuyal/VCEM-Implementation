import { expect } from "chai";
import { ethers } from "hardhat";
import { encryptArtifact, generateParticipantKey, EncryptedArtifact } from "../services/data-proxy/crypto";
import { ArtifactStore } from "../services/storage/artifactStore";
import { LocalKeyProvider } from "../services/encryption/keyProvider";
import {
  ACCESS_AUTHORIZED_TOPIC,
  DeliveryLedger,
  JsonFileDeliveryLedger,
  PolicyEnforcingDataProxy,
  ProviderBackedAccessService,
} from "../services/data-proxy/secureProxy";
import fs from "fs";
import os from "os";
import path from "path";

class MemoryArtifactStore implements ArtifactStore {
  private artifacts = new Map<string, EncryptedArtifact>();
  read(dataHash: string): EncryptedArtifact {
    const artifact = this.artifacts.get(dataHash.toLowerCase());
    if (!artifact) throw new Error("artifact not found");
    return artifact;
  }
  write(dataHash: string, artifact: EncryptedArtifact): void {
    this.artifacts.set(dataHash.toLowerCase(), artifact);
  }
  delete(dataHash: string): void {
    this.artifacts.delete(dataHash.toLowerCase());
  }
}

function hash(label: string) {
  return ethers.sha256(ethers.toUtf8Bytes(label));
}

function makeReceipt(params: {
  auditAddress: string;
  requestId: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  scopeHash: string;
  purpose: bigint;
  consentVersion: bigint;
  consentHash: string;
  actorsRoot: string;
}) {
  const data = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "uint8", "uint64", "bytes32", "bytes32", "uint64"],
    [params.dataHash, params.scopeHash, params.purpose, params.consentVersion, params.consentHash, params.actorsRoot, 123n]
  );
  return {
    status: 1,
    chainId: 31337n,
    transactionHash: hash(`tx:${params.requestId}`),
    blockNumber: 10,
    confirmations: 2,
    logs: [
      {
        address: params.auditAddress,
        topics: [ACCESS_AUTHORIZED_TOPIC, params.requestId, params.participantId, params.requestorId],
        data,
      },
    ],
  };
}

describe("PolicyEnforcingDataProxy", function () {
  async function fixture() {
    const [, requestor, other] = await ethers.getSigners();
    const auditAddress = ethers.Wallet.createRandom().address;
    const participantId = hash("proxy:participant");
    const requestorId = hash("proxy:requestor");
    const otherRequestorId = hash("proxy:other");
    const dataHashPlaintext = Buffer.from("anonymized encrypted fixture");
    const key = generateParticipantKey();
    const keyProvider = new LocalKeyProvider();
    keyProvider.putKey("participant-key", key);
    const artifact = encryptArtifact("participant-key", key, dataHashPlaintext);
    const store = new MemoryArtifactStore();
    store.write(artifact.dataHash, artifact);
    const ledger = new DeliveryLedger();
    const proxy = new PolicyEnforcingDataProxy(store, keyProvider, ledger);
    const request = {
      session: { wallet: requestor.address, requestorId, authenticatedAt: Date.now() },
      expectedChainId: 31337n,
      auditAddress,
      participantId,
      requestorId,
      dataHash: artifact.dataHash,
      scopeHash: hash("proxy:scope"),
      purpose: 2n,
      requestId: hash("proxy:request"),
      consentVersion: 1n,
      consentHash: hash("proxy:consent"),
      minConfirmations: 1,
      receipt: {} as any,
    };
    request.receipt = makeReceipt({ ...request, actorsRoot: hash("proxy:actors") });
    return { proxy, request, keyProvider, artifact, other, otherRequestorId, auditAddress };
  }

  it("releases the artifact only for the authenticated authorized requestor", async function () {
    const { proxy, request } = await fixture();
    const plaintext = proxy.release(request);
    expect(plaintext.toString()).to.equal("anonymized encrypted fixture");
  });

  it("rejects authenticated wrong researcher and forged receipts", async function () {
    const { proxy, request, other, otherRequestorId } = await fixture();
    await expect(() =>
      proxy.release({ ...request, session: { wallet: other.address, requestorId: otherRequestorId, authenticatedAt: Date.now() } })
    ).to.throw("authenticated requestor does not match authorization");

    await expect(() =>
      proxy.release({ ...request, receipt: { ...request.receipt, logs: [{ ...request.receipt.logs[0], address: ethers.Wallet.createRandom().address }] } })
    ).to.throw("transaction does not contain a VCEM AccessAuthorized event");
  });

  it("rejects transaction-hash bearer-token replay", async function () {
    const { proxy, request } = await fixture();
    proxy.release(request);
    await expect(() => proxy.release(request)).to.throw("request ID has already been delivered");
  });

  it("rejects mismatched scope, purpose, and cryptographic erasure", async function () {
    const { proxy, request, keyProvider, artifact } = await fixture();
    await expect(() => proxy.release({ ...request, scopeHash: hash("proxy:wrong-scope") })).to.throw("scope mismatch");
    await expect(() => proxy.release({ ...request, purpose: 4n })).to.throw("purpose mismatch");
    keyProvider.destroyKey(artifact.keyId);
    await expect(() => proxy.release({ ...request, requestId: hash("proxy:erased-request"), receipt: makeReceipt({ ...request, requestId: hash("proxy:erased-request"), actorsRoot: hash("proxy:actors") }) })).to.throw(
      "participant key is unavailable or destroyed"
    );
  });

  it("uses provider-fetched receipts and a durable release ledger", async function () {
    const { request, keyProvider, artifact } = await fixture();
    const store = new MemoryArtifactStore();
    store.write(artifact.dataHash, artifact);
    const ledgerPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vcem-ledger-")), "deliveries.json");
    const durableLedger = new JsonFileDeliveryLedger(ledgerPath);
    const proxy = new PolicyEnforcingDataProxy(store, keyProvider, durableLedger);
    const provider = {
      async getTransactionReceipt(transactionHash: string) {
        return transactionHash === request.receipt.transactionHash ? request.receipt : null;
      },
      async getNetwork() {
        return { chainId: 31337n };
      },
    };
    const service = new ProviderBackedAccessService(provider, proxy, 31337n);
    const plaintext = await service.releaseByTransactionHash({
      ...request,
      transactionHash: request.receipt.transactionHash,
    });
    expect(plaintext.toString()).to.equal("anonymized encrypted fixture");
    expect(JSON.parse(fs.readFileSync(ledgerPath, "utf8"))).to.have.length(1);

    const reloadedLedger = new JsonFileDeliveryLedger(ledgerPath);
    const reloadedProxy = new PolicyEnforcingDataProxy(store, keyProvider, reloadedLedger);
    const reloadedService = new ProviderBackedAccessService(provider, reloadedProxy, 31337n);
    let replayError = "";
    try {
      await reloadedService.releaseByTransactionHash({
        ...request,
        transactionHash: request.receipt.transactionHash,
      });
    } catch (err: any) {
      replayError = err.message;
    }
    expect(replayError).to.contain("request ID has already been delivered");
  });
});
