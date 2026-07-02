import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import childProcess from "child_process";

async function main() {
  const rpcUrl = process.env.LOCAL_RPC_URL || process.env.BESU_NETWORK_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const addresses = {
    VCEMRegistry: process.env.VCEM_REGISTRY_ADDRESS || "",
    VCEMConsent: process.env.VCEM_CONSENT_ADDRESS || "",
    VCEMAudit: process.env.VCEM_AUDIT_ADDRESS || "",
  };
  const bytecodeHashes: Record<string, string> = {};
  for (const [name, address] of Object.entries(addresses)) {
    if (!address) continue;
    const bytecode = await provider.getCode(address);
    bytecodeHashes[name] = ethers.keccak256(bytecode);
  }
  const gitCommit = childProcess.execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const manifest = {
    chainId: network.chainId.toString(),
    networkName: process.env.VCEM_NETWORK_NAME || "local",
    addresses,
    abiVersion: "vcem-v1",
    bytecodeHashes,
    deploymentTimestamp: new Date().toISOString(),
    gitCommit,
  };
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(path.join("deployments", "vcem-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("Wrote deployments/vcem-manifest.json");
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
