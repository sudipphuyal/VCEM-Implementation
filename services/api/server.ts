import http, { IncomingMessage, ServerResponse } from "http";
import { ethers } from "ethers";
import { WalletAuthService, SessionStore } from "../auth/walletAuth";
import { RegistryIdentityResolver } from "../auth/registryIdentity";
import { PolicyDataProxy, AuthorizedReleaseInput } from "../data-proxy/policyProxy";

export type AccessRelay = {
  authorizeAndLogAccess(request: any, signature: string): Promise<{ hash: string; wait(confirmations: number): Promise<any> }>;
};

export type AuditRelayOptions = {
  confirmBeforeNext?: boolean;
};

export type VcemApiConfig = {
  auth: WalletAuthService;
  sessions: SessionStore;
  registry: RegistryIdentityResolver;
  auditRelay: AccessRelay;
  dataProxy: PolicyDataProxy;
  requiredConfirmations: number;
  logger?: { info(message: string, meta?: Record<string, unknown>): void; error(message: string, meta?: Record<string, unknown>): void };
};

export async function handleVcemApiRequest(config: VcemApiConfig, method: string, pathname: string, body: any = {}, token?: string) {
  const requireToken = () => {
    if (!token) throw new Error("unauthenticated");
    return token;
  };
  if (method === "POST" && pathname === "/auth/challenge") {
    const challenge = await config.auth.issueChallenge(body.wallet);
    return { status: 200, body: { wallet: challenge.wallet, message: challenge.message, expiresAt: challenge.expiresAt.toISOString() } };
  }
  if (method === "POST" && pathname === "/auth/session") {
    const requestorId = await config.registry.resolveActiveResearcher(body.wallet);
    const sessionToken = await config.auth.createSession(body.wallet, body.message, body.signature, requestorId);
    return { status: 200, body: { token: sessionToken, requestorId } };
  }
  if (method === "POST" && pathname === "/auth/revoke") {
    await config.auth.revokeSession(requireToken());
    return { status: 200, body: { revoked: true } };
  }
  if (method === "POST" && pathname === "/access/authorize") {
    const session = await config.sessions.require(requireToken());
    const { request, signature } = validateAccessRequestShape(body);
    if (request.requestorId.toLowerCase() !== session.requestorId.toLowerCase()) throw new Error("session requestor mismatch");
    const activeId = await config.registry.resolveActiveResearcher(session.wallet);
    if (activeId.toLowerCase() !== session.requestorId.toLowerCase()) throw new Error("requestor no longer active");
    const tx = await config.auditRelay.authorizeAndLogAccess(request, signature);
    const receipt = await tx.wait(config.requiredConfirmations);
    return { status: 200, body: { transactionHash: tx.hash, blockNumber: receipt.blockNumber, status: receipt.status } };
  }
  if (method === "POST" && pathname === "/data/release") {
    const session = await config.sessions.require(requireToken());
    const release = validateReleaseShape(body);
    const activeId = await config.registry.resolveActiveResearcher(session.wallet);
    if (activeId.toLowerCase() !== session.requestorId.toLowerCase()) throw new Error("requestor no longer active");
    const plaintext = await config.dataProxy.release({ ...release, session });
    config.logger?.info("artifact released", {
      requestId: release.requestId,
      participantId: release.participantId,
      requestorId: release.requestorId,
      dataHash: release.dataHash,
    });
    return { status: 200, body: { data: plaintext.toString("base64"), encoding: "base64" } };
  }
  if (pathname.startsWith("/storage")) return { status: 403, body: { error: "direct storage access denied" } };
  return { status: 404, body: { error: "not found" } };
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, (_key, value) => (typeof value === "bigint" ? value.toString() : value)));
}

function bearer(req: IncomingMessage) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) throw new Error("unauthenticated");
  return header.slice("Bearer ".length);
}

function validateAccessRequestShape(body: any) {
  const request = body?.request;
  const signature = body?.signature;
  if (!request || typeof signature !== "string") throw new Error("request and signature are required");
  for (const field of [
    "participantId",
    "requestorId",
    "dataHash",
    "scopeHash",
    "requestedPurpose",
    "requestId",
    "clientTimestamp",
    "requestExpiry",
    "expectedConsentHash",
  ]) {
    if (request[field] === undefined) throw new Error(`missing request.${field}`);
  }
  return { request, signature };
}

function validateReleaseShape(body: any): Omit<AuthorizedReleaseInput, "session"> {
  for (const field of [
    "transactionHash",
    "participantId",
    "requestorId",
    "dataHash",
    "scopeHash",
    "purpose",
    "requestId",
    "consentVersion",
    "consentHash",
    "actorsRoot",
  ]) {
    if (body?.[field] === undefined) throw new Error(`missing ${field}`);
  }
  return {
    transactionHash: body.transactionHash,
    participantId: body.participantId,
    requestorId: body.requestorId,
    dataHash: body.dataHash,
    scopeHash: body.scopeHash,
    purpose: BigInt(body.purpose),
    requestId: body.requestId,
    consentVersion: BigInt(body.consentVersion),
    consentHash: body.consentHash,
    actorsRoot: body.actorsRoot,
  };
}

export function createVcemApi(config: VcemApiConfig) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      const result = await handleVcemApiRequest(
        config,
        req.method || "GET",
        url.pathname,
        await readJson(req),
        req.headers.authorization?.startsWith("Bearer ") ? bearer(req) : undefined
      );
      return send(res, result.status, result.body);
    } catch (err: any) {
      config.logger?.error("api request denied", { errorCode: err.message });
      return send(res, err.message === "unauthenticated" ? 401 : 403, { error: err.message });
    }
  });
}

export function createAuditRelay(auditAddress: string, signer: ethers.Signer, abi: any[], options: AuditRelayOptions = {}): AccessRelay {
  const contract = new ethers.Contract(auditAddress, abi, signer);
  let queue = Promise.resolve();
  let nextNonce: number | undefined;
  async function providerNonce() {
    const address = await signer.getAddress();
    const provider = signer.provider;
    if (!provider) throw new Error("audit relay signer has no provider");
    return provider.getTransactionCount(address, "pending");
  }
  async function takeNonce() {
    if (nextNonce === undefined) nextNonce = await providerNonce();
    return nextNonce++;
  }
  async function refreshNonce() {
    nextNonce = await providerNonce();
  }
  async function sendWithFreshNonce(request: any, signature: string) {
    const populated = await (contract.authorizeAndLogAccess as any).populateTransaction(request, signature);
    const send = async () =>
      signer.sendTransaction({
        ...populated,
        nonce: await takeNonce(),
        type: 0,
        gasPrice: 1n,
        gasLimit: 1_000_000n,
      });
    try {
      return await send();
    } catch (err: any) {
      const message = String(err?.message || err);
      if (!message.includes("nonce has already been used") && !message.includes("nonce is too distant")) throw err;
      await refreshNonce();
      return send();
    }
  }
  return {
    authorizeAndLogAccess(request: any, signature: string) {
      const submitted = queue.then(async () => {
        const tx = await sendWithFreshNonce(request, signature);
        if (options.confirmBeforeNext) await tx.wait(1);
        return tx;
      });
      queue = submitted.then(
        () => undefined,
        () => undefined
      );
      return submitted;
    },
  };
}
