import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import { WalletAuthService, PostgresChallengeStore, PostgresSessionStore } from "../../services/auth/walletAuth";
import { RegistryIdentityResolver } from "../../services/auth/registryIdentity";
import { PostgresDeliveryLedger } from "../../services/data-proxy/deliveryLedger";
import { PolicyDataProxy } from "../../services/data-proxy/policyProxy";
import { LocalKeyProvider } from "../../services/encryption/keyProvider";
import { FileArtifactStore } from "../../services/storage/artifactStore";
import { createPostgresPool } from "../../services/storage/postgres";
import { createAuditRelay, createVcemApi, VcemDiagnosticEvent } from "../../services/api/server";

const repoRoot = path.resolve(__dirname, "../..");
const fixtureDir = path.join(repoRoot, "benchmarks", "raw", "fixtures");
const actorsPath = path.join(fixtureDir, "vcem-actors.json");
const keysPath = path.join(fixtureDir, "vcem-keys.json");
const artifactRoot = path.join(fixtureDir, "vcem-artifacts");
const manifestPath = path.join(repoRoot, "deployments", "vcem-manifest.json");

function loadJson(file: string) {
  if (!fs.existsSync(file)) throw new Error(`${file} is missing; run npm run benchmark:vcem:seed`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadArtifact(name: string) {
  return loadJson(path.join(repoRoot, "artifacts", "contracts", "vcem", `${name}.sol`, `${name}.json`));
}

async function main() {
  const manifest = loadJson(manifestPath);
  const actors = loadJson(actorsPath);
  const keys = loadJson(keysPath);
  const rpcUrl = process.env.BENCHMARK_RPC_URL || process.env.LOCAL_RPC_URL || process.env.BESU_NETWORK_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const chainId = BigInt(process.env.VCEM_CHAIN_ID || manifest.chainId);
  const relayMode = process.env.VCEM_RELAY_MODE || "fast";

  const diagnosticPath = process.env.VCEM_DIAGNOSTIC_LOG;
  const diagnosticStream = diagnosticPath
    ? (() => {
        const resolved = path.resolve(diagnosticPath);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        return fs.createWriteStream(resolved, { flags: "a" });
      })()
    : undefined;

  const emitDiagnostic = (event: VcemDiagnosticEvent) => {
    if (!diagnosticStream) return;
    diagnosticStream.write(JSON.stringify(event) + "\n");
  };

  const db = createPostgresPool(process.env.DATABASE_URL);
  const gateway = new ethers.Wallet(process.env.VCEM_GATEWAY_PRIVATE_KEY || actors.gateway, provider);
  const registryArtifact = loadArtifact("VCEMRegistry");
  const auditArtifact = loadArtifact("VCEMAudit");
  const auth = new WalletAuthService(
    new PostgresChallengeStore(db),
    new PostgresSessionStore(db),
    {
      challengeTtlSeconds: Number(process.env.VCEM_API_CHALLENGE_TTL_SECONDS || 300),
      sessionTtlSeconds: Number(process.env.VCEM_API_SESSION_TTL_SECONDS || 900),
    }
  );
  const dataProxy = new PolicyDataProxy(
    provider,
    new FileArtifactStore(process.env.VCEM_ARTIFACT_STORE || artifactRoot),
    new LocalKeyProvider(keys),
    new PostgresDeliveryLedger(db),
    {
      chainId,
      auditAddress: manifest.addresses.VCEMAudit,
      minConfirmations: Number(process.env.VCEM_REQUIRED_CONFIRMATIONS || 1),
    }
  );
  const server = createVcemApi({
    auth,
    sessions: new PostgresSessionStore(db),
    registry: new RegistryIdentityResolver(manifest.addresses.VCEMRegistry, provider, registryArtifact.abi),
    auditRelay: createAuditRelay(manifest.addresses.VCEMAudit, gateway, auditArtifact.abi, {
      confirmBeforeNext: relayMode === "serial-confirm",
      onDiagnostic: emitDiagnostic,
    }),
    dataProxy,
    requiredConfirmations: Number(process.env.VCEM_REQUIRED_CONFIRMATIONS || 1),
    onDiagnostic: emitDiagnostic,
    logger: {
      info(message, meta) {
        console.log(JSON.stringify({ level: "info", message, meta }));
      },
      error(message, meta) {
        console.error(JSON.stringify({ level: "error", message, meta }));
      },
    },
  });
  const port = Number(process.env.VCEM_API_PORT || 8080);
  server.listen(port, () => console.log(`VCEM benchmark API listening on ${port} relayMode=${relayMode}`));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
