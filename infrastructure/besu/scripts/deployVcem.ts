import childProcess from "child_process";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const repoRoot = path.resolve(__dirname, "../../..");
const besuRoot = path.resolve(__dirname, "..");
const generatedDir = path.join(besuRoot, "generated");
const deploymentsDir = path.join(repoRoot, "deployments");
const rpcUrl = process.env.BESU_NETWORK_URL || process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";

type Artifact = {
  abi: any[];
  bytecode: string;
  deployedBytecode: string;
};

async function deploy(name: string, signer: ethers.Wallet, args: any[] = []) {
  const artifactPath = path.join(repoRoot, "artifacts", "contracts", "vcem", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`missing artifact for ${name}; run npm run compile first`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as Artifact;
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const deployment = await factory.getDeployTransaction(...args);
  const transaction = await signer.sendTransaction({
    ...deployment,
    type: 0,
    gasPrice: 1,
    gasLimit: 8_000_000,
  });
  const receipt = await transaction.wait();
  if (!receipt?.contractAddress) throw new Error(`${name} deployment did not return a contract address`);
  return {
    address: receipt.contractAddress,
    transactionHash: receipt.hash,
    artifact,
  };
}

function readDeployerKey() {
  const keyPath = path.join(generatedDir, "deployer.key");
  if (!fs.existsSync(keyPath)) {
    throw new Error("missing generated deployer key; run npm run besu:generate-network first");
  }
  return `0x${fs.readFileSync(keyPath, "utf8").trim().replace(/^0x/, "")}`;
}

function gitCommit() {
  try {
    return childProcess.execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function bytecodeHash(provider: ethers.JsonRpcProvider, address: string) {
  const code = await provider.getCode(address);
  return ethers.keccak256(code);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const signer = new ethers.Wallet(readDeployerKey(), provider);
  const balance = await provider.getBalance(signer.address);
  if (balance === 0n) {
    throw new Error(`generated deployer ${signer.address} has zero balance on ${rpcUrl}`);
  }

  const registry = await deploy("VCEMRegistry", signer);
  const consent = await deploy("VCEMConsent", signer, [registry.address]);
  const audit = await deploy("VCEMAudit", signer, [registry.address, consent.address]);
  const contracts = { VCEMRegistry: registry, VCEMConsent: consent, VCEMAudit: audit };
  const networkManifestPath = path.join(generatedDir, "network-manifest.json");
  const networkManifest = fs.existsSync(networkManifestPath)
    ? JSON.parse(fs.readFileSync(networkManifestPath, "utf8"))
    : {};
  const bytecodeHashes: Record<string, string> = {};
  const deployedRuntimeHashes: Record<string, string> = {};
  const addresses: Record<string, string> = {};
  const transactions: Record<string, string | undefined> = {};

  for (const [name, deployment] of Object.entries(contracts)) {
    addresses[name] = deployment.address;
    transactions[name] = deployment.transactionHash;
    bytecodeHashes[name] = ethers.keccak256(deployment.artifact.deployedBytecode);
    deployedRuntimeHashes[name] = await bytecodeHash(provider, deployment.address);
  }

  const manifest = {
    chainId: network.chainId.toString(),
    networkName: "vcem-besu-local",
    consensus: networkManifest.consensus || "IBFT 2.0",
    blockPeriodSeconds: networkManifest.blockPeriodSeconds || 2,
    validatorAddresses: networkManifest.validatorAddresses || [],
    topology: networkManifest.topology || {},
    addresses,
    deploymentTransactions: transactions,
    abiVersion: "vcem-v1",
    localRuntimeBytecodeHashes: bytecodeHashes,
    deployedRuntimeBytecodeHashes: deployedRuntimeHashes,
    deploymentTimestamp: new Date().toISOString(),
    gitCommit: gitCommit(),
  };

  fs.mkdirSync(deploymentsDir, { recursive: true });
  const manifestPath = path.join(deploymentsDir, "vcem-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Deployed VCEM contracts to ${rpcUrl}`);
  console.log(`Wrote ${manifestPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
