import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import { Client } from "pg";
import { encryptArtifact } from "../../services/data-proxy/crypto";

const repoRoot = path.resolve(__dirname, "../..");
const fixtureDir = path.join(repoRoot, "benchmarks", "raw", "fixtures");
const fixturePath = path.join(fixtureDir, "benchmark-fixtures.json");
const actorsPath = path.join(fixtureDir, "vcem-actors.json");
const keysPath = path.join(fixtureDir, "vcem-keys.json");
const artifactRoot = path.join(fixtureDir, "vcem-artifacts");
const migrationPath = path.join(repoRoot, "services", "api", "migrations", "001_vcem_api.sql");
const manifestPath = path.join(repoRoot, "deployments", "vcem-manifest.json");
const fixtureCount = Number(process.env.BENCHMARK_FIXTURE_COUNT || 75000);

const Role = {
  PARTICIPANT: 2,
  RESEARCHER: 3,
  DATA_CUSTODIAN: 4,
  POLICY_GATEWAY: 5,
  AUDITOR: 6,
};
const Purpose = { RESEARCH: 2 };

function sha256(data: Buffer | string) {
  return ethers.sha256(typeof data === "string" ? Buffer.from(data) : data);
}

function id(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function devWallet(label: string) {
  return new ethers.Wallet(sha256(`vcem-benchmark-wallet:${label}`));
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function readDeployerKey() {
  const generated = path.join(repoRoot, "infrastructure", "besu", "generated", "deployer.key");
  const key = process.env.BESU_PRIVATE_KEY || (fs.existsSync(generated) ? fs.readFileSync(generated, "utf8").trim() : "");
  if (!key) throw new Error("BESU_PRIVATE_KEY or infrastructure/besu/generated/deployer.key is required");
  return `0x${key.replace(/^0x/, "")}`;
}

function loadManifest() {
  if (!fs.existsSync(manifestPath)) throw new Error("deployments/vcem-manifest.json is missing; run npm run besu:deploy-vcem");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const name of ["VCEMRegistry", "VCEMConsent", "VCEMAudit"]) {
    if (!manifest.addresses?.[name]) throw new Error(`deployment manifest missing ${name}`);
  }
  return manifest;
}

function loadArtifact(name: string) {
  return JSON.parse(
    fs.readFileSync(path.join(repoRoot, "artifacts", "contracts", "vcem", `${name}.sol`, `${name}.json`), "utf8")
  );
}

async function fundIfNeeded(admin: ethers.Wallet, wallet: ethers.Wallet) {
  const balance = await admin.provider!.getBalance(wallet.address);
  if (balance > ethers.parseEther("1")) return;
  await (await admin.sendTransaction({ to: wallet.address, value: ethers.parseEther("10"), type: 0, gasPrice: 1 })).wait();
}

async function registerIfMissing(registry: ethers.Contract, admin: ethers.Wallet, actorId: string, wallet: string, role: number) {
  const existing = await registry.walletOf(actorId);
  if (existing !== ethers.ZeroAddress) return;
  await (await (registry.connect(admin) as any).registerActor(actorId, wallet, role, { type: 0, gasPrice: 1 })).wait();
}

async function seedDatabase(fixtures: any) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for VCEM benchmark session and delivery ledger");
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    await db.query(fs.readFileSync(migrationPath, "utf8"));
    await db.query("DELETE FROM delivery_ledger");
    await db.query("DELETE FROM auth_sessions");
    await db.query("DELETE FROM auth_challenges");
    await db.query(
      `INSERT INTO auth_sessions (token_hash, wallet, requestor_id, created_at, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '24 hours')`,
      [tokenHash(fixtures.sessionToken), fixtures.researcherWallet.toLowerCase(), fixtures.requestorId.toLowerCase()]
    );
  } finally {
    await db.end();
  }
}

async function main() {
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.mkdirSync(artifactRoot, { recursive: true });
  const manifest = loadManifest();
  const rpcUrl = process.env.BENCHMARK_RPC_URL || process.env.LOCAL_RPC_URL || process.env.BESU_NETWORK_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const admin = new ethers.Wallet(readDeployerKey(), provider);
  const participant = devWallet("participant").connect(provider);
  const researcher = devWallet("researcher").connect(provider);
  const gateway = devWallet("gateway").connect(provider);
  const custodian = devWallet("custodian").connect(provider);
  const auditor = devWallet("auditor").connect(provider);

  for (const wallet of [participant, researcher, gateway, custodian, auditor]) await fundIfNeeded(admin, wallet);

  const registry = new ethers.Contract(manifest.addresses.VCEMRegistry, loadArtifact("VCEMRegistry").abi, provider);
  const consent = new ethers.Contract(manifest.addresses.VCEMConsent, loadArtifact("VCEMConsent").abi, provider);
  const audit = new ethers.Contract(manifest.addresses.VCEMAudit, loadArtifact("VCEMAudit").abi, provider);
  const ids = {
    participant: id("benchmark:participant"),
    researcher: id("benchmark:researcher"),
    gateway: id("benchmark:gateway"),
    custodian: id("benchmark:custodian"),
    auditor: id("benchmark:auditor"),
  };
  await registerIfMissing(registry, admin, ids.participant, participant.address, Role.PARTICIPANT);
  await registerIfMissing(registry, admin, ids.researcher, researcher.address, Role.RESEARCHER);
  await registerIfMissing(registry, admin, ids.gateway, gateway.address, Role.POLICY_GATEWAY);
  await registerIfMissing(registry, admin, ids.custodian, custodian.address, Role.DATA_CUSTODIAN);
  await registerIfMissing(registry, admin, ids.auditor, auditor.address, Role.AUDITOR);

  const scopeHash = sha256("benchmark-scope-observation");
  const zkConsentCommitment = sha256("benchmark-zk-commitment");
  let current = await consent.getCurrentConsentVersion(ids.participant);
  if (current.version === 0n) {
    await (
      await (consent.connect(participant) as any).createConsent(
        ids.participant,
        { purposeMask: Purpose.RESEARCH, scopeHash, zkConsentCommitment },
        [ids.researcher],
        { type: 0, gasPrice: 1 }
      )
    ).wait();
    current = await consent.getCurrentConsentVersion(ids.participant);
  }

  const plaintext = Buffer.from(JSON.stringify({ fixture: "vcem-benchmark-observation", value: 42 }));
  const participantKey = crypto.createHash("sha256").update("vcem-benchmark-dev-participant-key").digest();
  const encrypted = encryptArtifact("vcem-benchmark-key", participantKey, plaintext);
  fs.writeFileSync(path.join(artifactRoot, `${encrypted.dataHash}.json`), JSON.stringify(encrypted, null, 2));
  fs.writeFileSync(keysPath, JSON.stringify({ "vcem-benchmark-key": participantKey.toString("hex") }, null, 2));
  await (await (audit.connect(custodian) as any).registerDataHash(ids.participant, scopeHash, encrypted.dataHash, { type: 0, gasPrice: 1 })).wait();

  const generatedAt = new Date();
  const clientTimestamp = Math.floor(generatedAt.getTime() / 1000);
  const requestExpiry = clientTimestamp + Number(process.env.BENCHMARK_REQUEST_TTL_SECONDS || 86400);
  const runNonce = crypto.randomBytes(8).toString("hex");
  const sessionToken = crypto.createHash("sha256").update(`vcem-benchmark-session:${runNonce}`).digest("hex");
  const baseRequest = {
    participantId: ids.participant,
    requestorId: ids.researcher,
    dataHash: encrypted.dataHash,
    scopeHash,
    purpose: Purpose.RESEARCH,
    clientTimestamp,
    requestExpiry,
    expectedConsentHash: current.consentHash,
    consentVersion: Number(current.version),
    actorsRoot: current.actorsRoot,
  };
  const domain = { name: "VCEMAudit", version: "1", chainId: network.chainId, verifyingContract: manifest.addresses.VCEMAudit };
  const types = {
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
  const requests = [];
  for (let index = 0; index < fixtureCount; index++) {
    const requestId = sha256(`vcem-benchmark-request:${runNonce}:${index}`);
    const message = {
      participantId: baseRequest.participantId,
      requestorId: baseRequest.requestorId,
      dataHash: baseRequest.dataHash,
      scopeHash: baseRequest.scopeHash,
      requestedPurpose: baseRequest.purpose,
      requestId,
      clientTimestamp,
      requestExpiry,
      expectedConsentHash: baseRequest.expectedConsentHash,
    };
    requests.push({
      index,
      ...baseRequest,
      requestId,
      signature: await researcher.signTypedData(domain, types, message),
    });
  }
  const fixtures = {
    generatedAt: generatedAt.toISOString(),
    status: "vcem-fixture-generated",
    rpcUrl,
    chainId: network.chainId.toString(),
    auditAddress: manifest.addresses.VCEMAudit,
    researcherWallet: researcher.address,
    participantWallet: participant.address,
    gatewayWallet: gateway.address,
    custodianWallet: custodian.address,
    participantId: ids.participant,
    requestorId: ids.researcher,
    scopeHash,
    dataHash: encrypted.dataHash,
    purpose: Purpose.RESEARCH,
    sessionToken,
    expectedConsentHash: current.consentHash,
    consentVersion: Number(current.version),
    actorsRoot: current.actorsRoot,
    requests,
  };
  await seedDatabase(fixtures);
  fs.writeFileSync(fixturePath, JSON.stringify(fixtures, null, 2));
  fs.writeFileSync(
    actorsPath,
    JSON.stringify(
      {
        participant: participant.privateKey,
        researcher: researcher.privateKey,
        gateway: gateway.privateKey,
        custodian: custodian.privateKey,
        auditor: auditor.privateKey,
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ fixturePath, requests: requests.length, chainId: network.chainId.toString(), audit: manifest.addresses.VCEMAudit }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
