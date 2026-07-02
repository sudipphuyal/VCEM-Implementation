import { ethers } from "ethers";
import fs from "fs";
import path from "path";

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join("deployments", "vcem-manifest.json"), "utf8"));
  const provider = new ethers.JsonRpcProvider(process.env.LOCAL_RPC_URL || process.env.BESU_NETWORK_URL || "http://127.0.0.1:8545");
  const results: Array<{ name: string; address: string; deployedHash: string; manifestHash: string; pass: boolean }> = [];
  for (const [name, address] of Object.entries(manifest.addresses) as Array<[string, string]>) {
    if (!address) continue;
    const deployed = await provider.getCode(address);
    const deployedHash = ethers.keccak256(deployed);
    const manifestHash = manifest.bytecodeHashes[name];
    results.push({ name, address, deployedHash, manifestHash, pass: deployedHash === manifestHash });
  }
  console.table(results);
  if (results.some((row) => !row.pass)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
