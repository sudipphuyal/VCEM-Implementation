import { ethers } from "ethers";
import fs from "fs";
import path from "path";

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join("deployments", "vcem-manifest.json"), "utf8"));
  const provider = new ethers.JsonRpcProvider(process.env.LOCAL_RPC_URL || process.env.BESU_NETWORK_URL || "http://127.0.0.1:8545");
  const artifactByName: Record<string, string> = {
    VCEMRegistry: path.join("artifacts", "contracts", "vcem", "VCEMRegistry.sol", "VCEMRegistry.json"),
    VCEMConsent: path.join("artifacts", "contracts", "vcem", "VCEMConsent.sol", "VCEMConsent.json"),
    VCEMAudit: path.join("artifacts", "contracts", "vcem", "VCEMAudit.sol", "VCEMAudit.json"),
  };
  const results: Array<{ name: string; address: string; deployedHash: string; localRuntimeHash: string; pass: boolean }> = [];
  for (const [name, address] of Object.entries(manifest.addresses) as Array<[string, string]>) {
    if (!address) continue;
    const artifactPath = artifactByName[name];
    if (!artifactPath) throw new Error(`No local artifact mapping for ${name}`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const deployed = await provider.getCode(address);
    const deployedHash = ethers.keccak256(deployed);
    const localRuntimeHash = ethers.keccak256(artifact.deployedBytecode);
    results.push({ name, address, deployedHash, localRuntimeHash, pass: deployedHash === localRuntimeHash });
  }
  console.table(results);
  if (results.some((row) => !row.pass)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
