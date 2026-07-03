import { ethers } from "ethers";
import fs from "fs";
import path from "path";

type BytecodeVerificationResult = {
  name: string;
  address: string;
  expectedHash: string;
  actualHash: string;
  normalizationMethod: string;
  match: boolean;
};

type Artifact = {
  deployedBytecode: string;
  deployedLinkReferences?: Record<string, Record<string, Array<{ start: number; length: number }>>>;
  immutableReferences?: Record<string, Array<{ start: number; length: number }>>;
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

function replaceByteRange(bytecode: string, start: number, length: number) {
  const body = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const from = start * 2;
  const to = from + length * 2;
  return `0x${body.slice(0, from)}${"0".repeat(length * 2)}${body.slice(to)}`;
}

function inferImmutableRanges(localBytecode: string, deployedBytecode: string) {
  const local = localBytecode.startsWith("0x") ? localBytecode.slice(2) : localBytecode;
  const deployed = deployedBytecode.startsWith("0x") ? deployedBytecode.slice(2) : deployedBytecode;
  if (local.length !== deployed.length) return [];
  const ranges: Array<{ start: number; length: number }> = [];
  let index = 0;
  while (index < local.length / 2) {
    const localByte = local.slice(index * 2, index * 2 + 2).toLowerCase();
    const deployedByte = deployed.slice(index * 2, index * 2 + 2).toLowerCase();
    if (localByte === deployedByte) {
      index++;
      continue;
    }
    const start = index;
    while (
      index < local.length / 2 &&
      local.slice(index * 2, index * 2 + 2).toLowerCase() !== deployed.slice(index * 2, index * 2 + 2).toLowerCase()
    ) {
      index++;
    }
    const length = index - start;
    const localSegment = local.slice(start * 2, index * 2);
    if (length === 20 && /^0+$/.test(localSegment)) ranges.push({ start, length });
    else return [];
  }
  return ranges;
}

export function normalizeRuntimeBytecode(bytecode: string, artifact: Artifact) {
  let normalized = bytecode;
  const methods: string[] = [];
  for (const ranges of Object.values(artifact.immutableReferences ?? {})) {
    for (const range of ranges) {
      normalized = replaceByteRange(normalized, range.start, range.length);
      methods.push(`immutable:${range.start}:${range.length}`);
    }
  }
  for (const fileRefs of Object.values(artifact.deployedLinkReferences ?? {})) {
    for (const ranges of Object.values(fileRefs)) {
      for (const range of ranges) {
        normalized = replaceByteRange(normalized, range.start, range.length);
        methods.push(`library:${range.start}:${range.length}`);
      }
    }
  }
  return { bytecode: normalized.toLowerCase(), method: methods.length ? methods.join(";") : "none" };
}

export async function verifyDeployedBytecode(options: {
  provider: ethers.Provider;
  addresses: Record<string, string>;
  artifactByName?: Record<string, string>;
}) {
  const artifactByName =
    options.artifactByName ?? {
      VCEMRegistry: path.join("artifacts", "contracts", "vcem", "VCEMRegistry.sol", "VCEMRegistry.json"),
      VCEMConsent: path.join("artifacts", "contracts", "vcem", "VCEMConsent.sol", "VCEMConsent.json"),
      VCEMAudit: path.join("artifacts", "contracts", "vcem", "VCEMAudit.sol", "VCEMAudit.json"),
    };
  const results: BytecodeVerificationResult[] = [];
  for (const [name, address] of Object.entries(options.addresses)) {
    if (!address) continue;
    const artifactPath = artifactByName[name];
    if (!artifactPath) throw new Error(`No local artifact mapping for ${name}`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as Artifact;
    const deployed = await options.provider.getCode(address);
    const localNormalized = normalizeRuntimeBytecode(artifact.deployedBytecode, artifact);
    const deployedNormalized = normalizeRuntimeBytecode(deployed, artifact);
    let expectedHash = ethers.keccak256(localNormalized.bytecode);
    let actualHash = ethers.keccak256(deployedNormalized.bytecode);
    let normalizationMethod = localNormalized.method;
    if (expectedHash !== actualHash && localNormalized.method === "none") {
      const inferred = inferImmutableRanges(localNormalized.bytecode, deployedNormalized.bytecode);
      if (inferred.length) {
        let localInferred = localNormalized.bytecode;
        let deployedInferred = deployedNormalized.bytecode;
        for (const range of inferred) {
          localInferred = replaceByteRange(localInferred, range.start, range.length);
          deployedInferred = replaceByteRange(deployedInferred, range.start, range.length);
        }
        expectedHash = ethers.keccak256(localInferred);
        actualHash = ethers.keccak256(deployedInferred);
        normalizationMethod = inferred.map((range) => `inferred-immutable:${range.start}:${range.length}`).join(";");
      }
    }
    results.push({
      name,
      address,
      expectedHash,
      actualHash,
      normalizationMethod,
      match: expectedHash === actualHash,
    });
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = args.manifest || path.join("deployments", "vcem-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(args.rpc || process.env.LOCAL_RPC_URL || process.env.BESU_NETWORK_URL || "http://127.0.0.1:8545");
  const results = await verifyDeployedBytecode({ provider, addresses: manifest.addresses });
  console.table(results);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(results, null, 2));
  }
  if (results.some((row) => !row.match)) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
