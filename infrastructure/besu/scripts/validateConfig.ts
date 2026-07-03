import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const required = [
  "docker-compose.yml",
  "genesis.json.template",
  "config/validator.toml",
  "config/rpc.toml",
  "scripts/besuNetwork.ts",
  "scripts/deployVcem.ts",
];

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function main() {
  for (const file of required) assert(fs.existsSync(path.join(root, file)), `missing ${file}`);
  const compose = fs.readFileSync(path.join(root, "docker-compose.yml"), "utf8");
  for (const service of ["validator1", "validator2", "validator3", "validator4", "rpc"]) {
    assert(compose.includes(`${service}:`), `compose missing ${service}`);
  }
  assert(compose.includes("hyperledger/besu:24.12.0"), "Besu image version is not pinned");
  assert(compose.includes("metrics-enabled=true") || fs.readFileSync(path.join(root, "config/validator.toml"), "utf8").includes("metrics-enabled=true"), "metrics not enabled");
  assert(compose.includes("ipv4_address: 172.28.0.11"), "validator1 fixed IP missing");
  assert(compose.includes("ipv4_address: 172.28.0.15"), "rpc fixed IP missing");
  const genesis = fs.readFileSync(path.join(root, "genesis.json.template"), "utf8");
  for (const token of ["{{CHAIN_ID}}", "{{EXTRA_DATA}}", "{{DEPLOYER_ADDRESS}}"]) {
    assert(genesis.includes(token), `genesis template missing ${token}`);
  }
  const generator = fs.readFileSync(path.join(root, "scripts", "besuNetwork.ts"), "utf8");
  assert(generator.includes("ethers.encodeRlp([vanity, validators"), "IBFT extraData generation missing");
  assert(generator.includes("0x00000000"), "IBFT round must be encoded as 4-byte zero");
  console.log("Besu config validation passed.");
}

main();
