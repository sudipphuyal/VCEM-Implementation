import { expect } from "chai";
import { ethers } from "hardhat";
import { encryptArtifact, generateParticipantKey, EncryptedArtifact } from "../services/data-proxy/crypto";
import { ArtifactStore } from "../services/storage/artifactStore";
import { LocalKeyProvider } from "../services/encryption/keyProvider";
import { MemoryChallengeStore, MemorySessionStore, WalletAuthService } from "../services/auth/walletAuth";
import { RegistryIdentityResolver } from "../services/auth/registryIdentity";
import { MemoryDeliveryLedger } from "../services/data-proxy/deliveryLedger";
import { PolicyDataProxy } from "../services/data-proxy/policyProxy";
import { createAuditRelay, handleVcemApiRequest, VcemApiConfig } from "../services/api/server";

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

class MemoryArtifactStore implements ArtifactStore {
  private artifacts = new Map<string, EncryptedArtifact>();
  read(dataHash: string) {
    const artifact = this.artifacts.get(dataHash.toLowerCase());
    if (!artifact) throw new Error("artifact not found");
    return artifact;
  }
  write(dataHash: string, artifact: EncryptedArtifact) {
    this.artifacts.set(dataHash.toLowerCase(), artifact);
  }
  delete(dataHash: string) {
    this.artifacts.delete(dataHash.toLowerCase());
  }
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

async function fixture() {
  const [admin, participant, researcher, gateway, custodian, auditor, outsider] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("VCEMRegistry");
  const registry = await Registry.deploy();
  const Consent = await ethers.getContractFactory("VCEMConsent");
  const consent = await Consent.deploy(await registry.getAddress());
  const Audit = await ethers.getContractFactory("VCEMAudit");
  const audit = await Audit.deploy(await registry.getAddress(), await consent.getAddress());
  const ids = {
    participant: id("api:participant"),
    researcher: id("api:researcher"),
    gateway: id("api:gateway"),
    custodian: id("api:custodian"),
    auditor: id("api:auditor"),
    outsider: id("api:outsider"),
  };
  await registry.registerActor(ids.participant, participant.address, Role.PARTICIPANT);
  await registry.registerActor(ids.researcher, researcher.address, Role.RESEARCHER);
  await registry.registerActor(ids.gateway, gateway.address, Role.POLICY_GATEWAY);
  await registry.registerActor(ids.custodian, custodian.address, Role.DATA_CUSTODIAN);
  await registry.registerActor(ids.auditor, auditor.address, Role.AUDITOR);
  await registry.registerActor(ids.outsider, outsider.address, Role.RESEARCHER);

  const scopeHash = hash("api:scope");
  await consent.connect(participant).createConsent(
    ids.participant,
    { purposeMask: Purpose.RESEARCH, scopeHash, zkConsentCommitment: hash("api:zk") },
    [ids.researcher]
  );
  const version = await consent.getCurrentConsentVersion(ids.participant);
  const plaintext = Buffer.from("fixture clinical data not for logs");
  const keyProvider = new LocalKeyProvider();
  const artifactStore = new MemoryArtifactStore();
  const key = generateParticipantKey();
  keyProvider.putKey("participant-key", key);
  const artifact = encryptArtifact("participant-key", key, plaintext);
  artifactStore.write(artifact.dataHash, artifact);
  await audit.connect(custodian).registerDataHash(ids.participant, scopeHash, artifact.dataHash);

  const registryArtifact = await import("../artifacts/contracts/vcem/VCEMRegistry.sol/VCEMRegistry.json");
  const auditArtifact = await import("../artifacts/contracts/vcem/VCEMAudit.sol/VCEMAudit.json");
  const challengeStore = new MemoryChallengeStore();
  const sessionStore = new MemorySessionStore();
  const auth = new WalletAuthService(challengeStore, sessionStore, { challengeTtlSeconds: 300, sessionTtlSeconds: 900 });
  const ledger = new MemoryDeliveryLedger();
  const provider = {
    async getTransactionReceipt(txHash: string) {
      const receipt = await ethers.provider.getTransactionReceipt(txHash);
      return receipt
        ? {
            status: receipt.status,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            confirmations: 1,
            chainId: 31337n,
            logs: receipt.logs,
          }
        : null;
    },
    async getNetwork() {
      return { chainId: 31337n };
    },
  };
  const proxy = new PolicyDataProxy(provider, artifactStore, keyProvider, ledger, {
    chainId: 31337n,
    auditAddress: await audit.getAddress(),
    minConfirmations: 1,
  });
  const logs: string[] = [];
  const apiConfig: VcemApiConfig = {
    auth,
    sessions: sessionStore,
    registry: new RegistryIdentityResolver(await registry.getAddress(), ethers.provider, (registryArtifact as any).abi),
    auditRelay: createAuditRelay(await audit.getAddress(), gateway, (auditArtifact as any).abi),
    dataProxy: proxy,
    requiredConfirmations: 1,
    logger: {
      info(message, meta) {
        logs.push(`${message}:${JSON.stringify(meta)}`);
      },
      error(message, meta) {
        logs.push(`${message}:${JSON.stringify(meta)}`);
      },
    },
  };
  const call = async (path: string, body: any = {}, token?: string, method = "POST"): Promise<{ status: number; body: any }> => {
    try {
      return await handleVcemApiRequest(apiConfig, method, path, body, token);
    } catch (err: any) {
      return { status: err.message === "unauthenticated" ? 401 : 403, body: { error: err.message } };
    }
  };
  async function login(wallet: any) {
    const challenge = await call("/auth/challenge", { wallet: wallet.address });
    const signature = await wallet.signMessage(challenge.body.message);
    return call("/auth/session", { wallet: wallet.address, message: challenge.body.message, signature });
  }
  async function request(seed = "authorized", overrides: any = {}) {
    const latest = await ethers.provider.getBlock("latest");
    const current = await consent.getCurrentConsentVersion(ids.participant);
    return {
      participantId: ids.participant,
      requestorId: ids.researcher,
      dataHash: artifact.dataHash,
      scopeHash,
      requestedPurpose: Purpose.RESEARCH,
      requestId: hash(`api:request:${seed}`),
      clientTimestamp: latest!.timestamp,
      requestExpiry: latest!.timestamp + 3600,
      expectedConsentHash: current.consentHash,
      ...overrides,
    };
  }
  async function authorize(token: string, req: any, signer = researcher) {
    return call("/access/authorize", { request: req, signature: await signAccessRequest(audit, signer, req) }, token);
  }
  async function release(token: string, txHash: string, req: any, current = version) {
    return call(
      "/data/release",
      {
        transactionHash: txHash,
        participantId: req.participantId,
        requestorId: req.requestorId,
        dataHash: req.dataHash,
        scopeHash: req.scopeHash,
        purpose: req.requestedPurpose,
        requestId: req.requestId,
        consentVersion: current.version,
        consentHash: current.consentHash,
        actorsRoot: current.actorsRoot,
      },
      token
    );
  }
  return { call, login, authorize, release, request, researcher, outsider, participant, consent, audit, ids, scopeHash, artifact, keyProvider, logs };
}

describe("Authenticated VCEM API and data proxy", function () {
  it("releases an authorized artifact only once to the authenticated researcher", async function () {
    const env = await fixture();
    const session = await env.login(env.researcher);
    const req = await env.request("ok");
    const authz = await env.authorize(session.body.token, req);
    expect(authz.status).to.equal(200);
    const released = await env.release(session.body.token, authz.body.transactionHash, req);
    expect(released.status, JSON.stringify(released.body)).to.equal(200);
    expect(Buffer.from(released.body.data, "base64").toString()).to.equal("fixture clinical data not for logs");
    const duplicate = await env.release(session.body.token, authz.body.transactionHash, req);
    expect(duplicate.status).to.equal(403);
  });

  it("denies unauthenticated and wrong authenticated researchers", async function () {
    const env = await fixture();
    const session = await env.login(env.researcher);
    const wrongSession = await env.login(env.outsider);
    const req = await env.request("wrong-user");
    expect((await env.authorize("", req)).status).to.equal(401);
    const authz = await env.authorize(session.body.token, req);
    const denied = await env.release(wrongSession.body.token, authz.body.transactionHash, req);
    expect(denied.status).to.equal(403);
  });

  it("revokes sessions and denies later use", async function () {
    const env = await fixture();
    const session = await env.login(env.researcher);
    expect((await env.call("/auth/revoke", {}, session.body.token)).status).to.equal(200);
    expect((await env.authorize(session.body.token, await env.request("revoked-session"))).status).to.equal(401);
  });

  it("denies revoked consent, stale consent hash, wrong scope, and wrong purpose at authorization", async function () {
    const env = await fixture();
    const session = await env.login(env.researcher);
    expect((await env.authorize(session.body.token, await env.request("scope", { scopeHash: hash("wrong:scope") }))).status).to.equal(403);
    expect((await env.authorize(session.body.token, await env.request("purpose", { requestedPurpose: Purpose.OTHER }))).status).to.equal(403);
    const stale = await env.request("stale");
    await env.consent.connect(env.participant).updateConsent(
      env.ids.participant,
      { purposeMask: Purpose.RESEARCH, scopeHash: env.scopeHash, zkConsentCommitment: hash("api:updated") },
      [env.ids.researcher]
    );
    expect((await env.authorize(session.body.token, stale)).status).to.equal(403);
    await env.consent.connect(env.participant).revokeConsent(env.ids.participant);
    expect((await env.authorize(session.body.token, await env.request("revoked"))).status).to.equal(403);
  });

  it("denies forged transactions, different-user transactions, direct storage, and erased keys", async function () {
    const env = await fixture();
    const session = await env.login(env.researcher);
    const req = await env.request("forged");
    expect((await env.release(session.body.token, hash("not:a:tx"), req)).status).to.equal(403);
    const otherReq = await env.request("other", { requestorId: env.ids.outsider });
    expect((await env.release(session.body.token, hash("other:tx"), otherReq)).status).to.equal(403);
    expect((await env.call(`/storage/${env.artifact.dataHash}`, {}, undefined, "GET")).status).to.equal(403);
    const authz = await env.authorize(session.body.token, req);
    env.keyProvider.destroyKey("participant-key");
    expect((await env.release(session.body.token, authz.body.transactionHash, req)).status).to.equal(403);
  });

  it("does not write plaintext clinical data to API logs", async function () {
    const env = await fixture();
    const session = await env.login(env.researcher);
    const req = await env.request("logs");
    const authz = await env.authorize(session.body.token, req);
    await env.release(session.body.token, authz.body.transactionHash, req);
    expect(env.logs.join("\n")).to.not.contain("fixture clinical data");
  });
});
