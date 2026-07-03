import childProcess from "child_process";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const root = path.resolve(__dirname, "..");
const generatedDir = path.join(root, "generated");
const validatorsDir = path.join(root, "validators");
const rpcDir = path.join(root, "rpc");
const chainId = 20260703;
const rpcUrl = process.env.BESU_NETWORK_URL || process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";
const validatorNames = ["validator1", "validator2", "validator3", "validator4"];
const nodeIps: Record<string, string> = {
  validator1: "172.28.0.11",
  validator2: "172.28.0.12",
  validator3: "172.28.0.13",
  validator4: "172.28.0.14",
  rpc: "172.28.0.15",
};

type NodeIdentity = {
  name: string;
  privateKey: string;
  address: string;
  publicKey: string;
  enode: string;
  ip: string;
  validator: boolean;
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeSecret(file: string, value: string) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, value.replace(/^0x/, ""));
  fs.chmodSync(file, 0o600);
}

function makeIdentity(name: string, validator: boolean): NodeIdentity {
  const wallet = ethers.Wallet.createRandom();
  const publicKey = ethers.SigningKey.computePublicKey(wallet.privateKey, false).replace(/^0x04/, "");
  return {
    name,
    privateKey: wallet.privateKey,
    address: wallet.address,
    publicKey,
    enode: `enode://${publicKey}@${nodeIps[name]}:30303`,
    ip: nodeIps[name],
    validator,
  };
}

function ibftExtraData(validators: string[]) {
  const vanity = `0x${"00".repeat(32)}`;
  return ethers.encodeRlp([vanity, validators, "0x", "0x00000000", []]);
}

function template(input: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((acc, [key, value]) => acc.split(`{{${key}}}`).join(String(value)), input);
}

function dockerCompose(args: string[], inherit = true) {
  return childProcess.spawnSync("docker", ["compose", ...args], {
    cwd: root,
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8",
  });
}

async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const body = await response.json() as any;
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

function generate() {
  ensureDir(generatedDir);
  ensureDir(validatorsDir);
  ensureDir(rpcDir);
  const nodes: NodeIdentity[] = [...validatorNames.map((name) => makeIdentity(name, true)), makeIdentity("rpc", false)];
  for (const node of nodes) {
    const dir = node.validator ? path.join(validatorsDir, node.name) : rpcDir;
    writeSecret(path.join(dir, "key"), node.privateKey);
    fs.writeFileSync(path.join(dir, "address"), node.address);
    fs.writeFileSync(path.join(dir, "public-key"), node.publicKey);
  }

  const deployer = ethers.Wallet.createRandom();
  writeSecret(path.join(generatedDir, "deployer.key"), deployer.privateKey);
  const validators = nodes.filter((node) => node.validator).map((node) => node.address);
  const genesisTemplate = fs.readFileSync(path.join(root, "genesis.json.template"), "utf8");
  const genesis = template(genesisTemplate, {
    CHAIN_ID: chainId,
    TIMESTAMP_HEX: `0x${Math.floor(Date.now() / 1000).toString(16)}`,
    DEPLOYER_ADDRESS: deployer.address.slice(2),
    EXTRA_DATA: ibftExtraData(validators),
  });
  fs.writeFileSync(path.join(generatedDir, "genesis.json"), genesis);
  fs.writeFileSync(path.join(generatedDir, "static-nodes.json"), JSON.stringify(nodes.map((node) => node.enode), null, 2));
  fs.writeFileSync(
    path.join(generatedDir, ".env.generated"),
    [
      `BESU_NETWORK_URL=${rpcUrl}`,
      `LOCAL_RPC_URL=${rpcUrl}`,
      `BESU_PRIVATE_KEY=${deployer.privateKey.replace(/^0x/, "")}`,
      `VCEM_CHAIN_ID=${chainId}`,
    ].join("\n") + "\n"
  );
  const manifest = {
    chainId,
    blockPeriodSeconds: 2,
    consensus: "IBFT 2.0",
    topology: {
      validators: nodes.filter((node) => node.validator).map(({ name, address, enode, ip }) => ({ name, address, enode, ip })),
      rpc: nodes.filter((node) => !node.validator).map(({ name, address, enode, ip }) => ({ name, address, enode, ip })),
    },
    validatorAddresses: validators,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(generatedDir, "network-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Generated Besu network files under ${generatedDir}`);
  console.log("Generated deployer env: infrastructure/besu/generated/.env.generated");
}

async function status() {
  const compose = dockerCompose(["ps"], false);
  if (compose.status === 0) process.stdout.write(compose.stdout);
  else process.stderr.write(compose.stderr || "docker compose ps failed\n");
  try {
    const [block, peers, chain] = await Promise.all([rpc("eth_blockNumber"), rpc("net_peerCount"), rpc("eth_chainId")]);
    console.log(JSON.stringify({ rpcUrl, chainId: Number(BigInt(chain)), blockNumber: Number(BigInt(block)), peerCount: Number(BigInt(peers)) }, null, 2));
  } catch (err: any) {
    console.error(`RPC status unavailable: ${err.message}`);
    process.exitCode = 1;
  }
}

async function waitBlockIncrease(seconds = 8) {
  const start = BigInt(await rpc("eth_blockNumber"));
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  const end = BigInt(await rpc("eth_blockNumber"));
  return { start, end, produced: end > start };
}

async function verify() {
  const chain = BigInt(await rpc("eth_chainId"));
  if (chain !== BigInt(chainId)) throw new Error(`unexpected chain ID ${chain}`);
  const peers = BigInt(await rpc("net_peerCount"));
  if (peers < 4n) throw new Error(`expected at least 4 peers, got ${peers}`);
  const production = await waitBlockIncrease();
  if (!production.produced) throw new Error(`blocks did not advance from ${production.start}`);
  const validators = await rpc("ibft_getValidatorsByBlockNumber", ["latest"]);
  const manifest = JSON.parse(fs.readFileSync(path.join(generatedDir, "network-manifest.json"), "utf8"));
  const expected = manifest.validatorAddresses.map((entry: string) => entry.toLowerCase()).sort();
  const actual = (validators as string[]).map((entry) => entry.toLowerCase()).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error("IBFT validator set does not match generated manifest");
  console.log(JSON.stringify({ chainId: Number(chain), peers: Number(peers), startBlock: production.start.toString(), endBlock: production.end.toString(), validators }, null, 2));
}

async function faultTolerance() {
  console.log("Checking all validators produce blocks");
  await verify();
  console.log("Stopping validator4; chain should continue");
  dockerCompose(["stop", "validator4"]);
  let result = await waitBlockIncrease();
  if (!result.produced) throw new Error("chain did not continue with one validator stopped");
  console.log("Stopping validator3; chain should halt with only two of four validators");
  dockerCompose(["stop", "validator3"]);
  result = await waitBlockIncrease(6);
  if (result.produced) throw new Error("chain produced blocks with two validators stopped; expected IBFT halt");
  console.log("Restarting validators; chain should resume");
  dockerCompose(["start", "validator3", "validator4"]);
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  result = await waitBlockIncrease(30);
  if (!result.produced) throw new Error("chain did not resume after validators restarted");
}

function clean() {
  dockerCompose(["down", "-v", "--remove-orphans"]);
  fs.rmSync(generatedDir, { recursive: true, force: true });
  fs.rmSync(validatorsDir, { recursive: true, force: true });
  fs.rmSync(rpcDir, { recursive: true, force: true });
  console.log("Removed Besu containers/volumes and generated keys/config");
}

async function main() {
  const command = process.argv[2] || "status";
  if (command === "generate") return generate();
  if (command === "status") return status();
  if (command === "verify") return verify();
  if (command === "fault-tolerance") return faultTolerance();
  if (command === "clean") return clean();
  throw new Error(`unknown command: ${command}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
