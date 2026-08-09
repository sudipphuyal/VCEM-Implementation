import childProcess from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const snapshotRoot = path.join(
  repoRoot,
  "benchmarks",
  "formal-evaluation",
  "local-snapshot",
  "formal-preseed"
);
const snapshotFiles = path.join(snapshotRoot, "files");
const snapshotVolumes = path.join(snapshotRoot, "volumes");

const composeBase = [
  "compose",
  "--project-directory",
  "infrastructure/besu",
  "-f",
  "infrastructure/besu/docker-compose.yml",
];

const containers = [
  "vcem-besu-validator1-1",
  "vcem-besu-validator2-1",
  "vcem-besu-validator3-1",
  "vcem-besu-validator4-1",
  "vcem-besu-rpc-1",
];

const volumeArchives: Array<[string, string]> = [
  ["vcem-besu_validator1-data", "validator1-data.tgz"],
  ["vcem-besu_validator2-data", "validator2-data.tgz"],
  ["vcem-besu_validator3-data", "validator3-data.tgz"],
  ["vcem-besu_validator4-data", "validator4-data.tgz"],
  ["vcem-besu_rpc-data", "rpc-data.tgz"],
];

function fail(message: string): never {
  throw new Error(message);
}

function run(
  command: string,
  args: string[],
  options: childProcess.SpawnSyncOptions = {}
) {
  const result = childProcess.spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    fail(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }

  return result;
}

function capture(command: string, args: string[]) {
  return String(run(command, args).stdout || "").trim();
}

function compose(args: string[], inherit = true) {
  return run("docker", [...composeBase, ...args], {
    stdio: inherit ? "inherit" : "pipe",
  });
}

function sha256(file: string) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(file);
  hash.update(data);
  return hash.digest("hex");
}

function verifySnapshot() {
  const manifest = path.join(snapshotRoot, "SHA256SUMS");

  if (!fs.existsSync(manifest)) {
    fail(`formal snapshot checksum manifest is missing: ${manifest}`);
  }

  const rows = fs
    .readFileSync(manifest, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rows.length) fail("formal snapshot checksum manifest is empty");

  for (const row of rows) {
    const parts = row.split(/\s{2}/);
    if (parts.length !== 2) fail(`invalid SHA256SUMS row: ${row}`);

    const expected = parts[0];
    const relative = parts[1];
    const file = path.join(snapshotRoot, relative);

    if (!fs.existsSync(file)) {
      fail(`formal snapshot file is missing: ${relative}`);
    }

    const actual = sha256(file);
    if (actual !== expected) {
      fail(
        `formal snapshot checksum mismatch for ${relative}: expected ${expected}, actual ${actual}`
      );
    }
  }

  for (const [, archive] of volumeArchives) {
    const file = path.join(snapshotVolumes, archive);
    if (!fs.existsSync(file)) fail(`volume archive missing: ${archive}`);
  }

  console.log(`snapshotVerification=PASS files=${rows.length}`);
}

function assertFrozenTrackedConfiguration() {
  const pairs: Array<[string, string]> = [
    [
      path.join(snapshotFiles, "rpc.toml"),
      path.join(repoRoot, "infrastructure/besu/config/rpc.toml"),
    ],
    [
      path.join(snapshotFiles, "validator.toml"),
      path.join(repoRoot, "infrastructure/besu/config/validator.toml"),
    ],
    [
      path.join(snapshotFiles, "docker-compose.yml"),
      path.join(repoRoot, "infrastructure/besu/docker-compose.yml"),
    ],
  ];

  for (const [expected, active] of pairs) {
    if (sha256(expected) !== sha256(active)) {
      fail(
        `active formal Besu configuration differs from frozen snapshot: ${path.relative(
          repoRoot,
          active
        )}`
      );
    }
  }

  console.log("frozenTrackedConfiguration=PASS");
}

function restoreDirectory(source: string, destination: string) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
}

function restoreIdentityAndNetworkFiles() {
  restoreDirectory(
    path.join(snapshotFiles, "besu-generated"),
    path.join(repoRoot, "infrastructure/besu/generated")
  );

  restoreDirectory(
    path.join(snapshotFiles, "besu-validators"),
    path.join(repoRoot, "infrastructure/besu/validators")
  );

  restoreDirectory(
    path.join(snapshotFiles, "besu-rpc"),
    path.join(repoRoot, "infrastructure/besu/rpc")
  );

  fs.copyFileSync(
    path.join(snapshotFiles, "vcem-manifest.json"),
    path.join(repoRoot, "deployments/vcem-manifest.json")
  );

  fs.chmodSync(
    path.join(repoRoot, "infrastructure/besu/generated/deployer.key"),
    0o600
  );

  for (const name of [
    "validator1",
    "validator2",
    "validator3",
    "validator4",
  ]) {
    fs.chmodSync(
      path.join(repoRoot, "infrastructure/besu/validators", name, "key"),
      0o600
    );
  }

  fs.chmodSync(
    path.join(repoRoot, "infrastructure/besu/rpc/key"),
    0o600
  );

  console.log("identityAndNetworkFiles=RESTORED");
}

function restoreVolumes() {
  compose(["down", "-v", "--remove-orphans"]);

  restoreIdentityAndNetworkFiles();

  compose(["create"]);

  for (const [volume, archive] of volumeArchives) {
    console.log(`restoringVolume=${volume}`);

    run(
      "docker",
      [
        "run",
        "--rm",
        "--entrypoint",
        "sh",
        "-v",
        `${volume}:/data`,
        "-v",
        `${snapshotVolumes}:/backup:ro`,
        "postgres:15.2",
        "-c",
        `tar -xzf /backup/${archive} -C /data`,
      ],
      { stdio: "inherit" }
    );
  }

  console.log("formalVolumes=RESTORED");
}

function sleep(seconds: number) {
  run("sleep", [String(seconds)]);
}

function waitHealthy() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    let healthy = 0;

    for (const name of containers) {
      const result = childProcess.spawnSync(
        "docker",
        [
          "inspect",
          name,
          "--format",
          "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}",
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
        }
      );

      const state = String(result.stdout || "").trim();
      if (result.status === 0 && state === "running healthy") healthy++;
    }

    if (healthy === containers.length) {
      console.log(`besuHealth=PASS healthy=${healthy}`);
      return;
    }

    sleep(2);
  }

  fail("Besu containers did not all become healthy within 120 seconds");
}

function txPoolOccupancy() {
  const metrics = capture("curl", [
    "-fsS",
    "http://127.0.0.1:9549/metrics",
  ]);

  const layers = ["prioritized", "ready", "sparse"] as const;
  const values: Record<string, number> = {};

  for (const layer of layers) {
    const expression = new RegExp(
      `^besu_transaction_pool_number_of_transactions\\{layer="${layer}"\\}\\s+([0-9.eE+-]+)$`,
      "m"
    );

    const match = metrics.match(expression);
    if (!match) {
      fail(`transaction-pool occupancy metric missing for layer ${layer}`);
    }

    values[layer] = Number(match[1]);
    if (!Number.isFinite(values[layer])) {
      fail(`invalid transaction-pool value for layer ${layer}: ${match[1]}`);
    }
  }

  const total = layers.reduce((sum, layer) => sum + values[layer], 0);

  if (total !== 0) {
    fail(
      `formal pre-seed transaction pool is not empty: ${JSON.stringify(values)}`
    );
  }

  console.log(
    `txPool=PASS prioritized=${values.prioritized} ready=${values.ready} sparse=${values.sparse}`
  );

  return { ...values, total };
}

async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch("http://127.0.0.1:8545", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const body = (await response.json()) as any;
  if (body.error) fail(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function verifyFrozenState() {
  const expected = JSON.parse(
    fs.readFileSync(
      path.join(snapshotFiles, "network-state.json"),
      "utf8"
    )
  );

  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "deployments/vcem-manifest.json"),
      "utf8"
    )
  );

  const chainId = Number(BigInt(await rpc("eth_chainId")));
  const blockNumber = Number(BigInt(await rpc("eth_blockNumber")));
  const peerCount = Number(BigInt(await rpc("net_peerCount")));

  const validators = (
    (await rpc("ibft_getValidatorsByBlockNumber", ["latest"])) as string[]
  )
    .map((value) => value.toLowerCase())
    .sort();

  const expectedValidators = (expected.validators as string[])
    .map((value) => value.toLowerCase())
    .sort();

  if (chainId !== expected.chainId) {
    fail(`chain ID mismatch: ${chainId} != ${expected.chainId}`);
  }

  if (JSON.stringify(validators) !== JSON.stringify(expectedValidators)) {
    fail("validator set differs from frozen formal snapshot");
  }

  for (const name of ["VCEMRegistry", "VCEMConsent", "VCEMAudit"]) {
    if (
      String(manifest.addresses?.[name] || "").toLowerCase() !==
      String(expected.addresses?.[name] || "").toLowerCase()
    ) {
      fail(`${name} address differs from frozen formal snapshot`);
    }
  }

  if (peerCount < 4) {
    fail(`expected at least four Besu peers, got ${peerCount}`);
  }

  console.log(
    JSON.stringify(
      {
        frozenStateVerification: "PASS",
        chainId,
        blockNumber,
        peerCount,
        validators,
        addresses: manifest.addresses,
      },
      null,
      2
    )
  );

  return { chainId, blockNumber, peerCount, validators };
}

async function main() {
  console.log("=== FORMAL BESU SNAPSHOT RESTORE ===");

  verifySnapshot();
  assertFrozenTrackedConfiguration();
  restoreVolumes();

  compose(["up", "-d"]);
  waitHealthy();

  run(
    "npx",
    [
      "ts-node",
      "infrastructure/besu/scripts/besuNetwork.ts",
      "verify",
    ],
    { stdio: "inherit" }
  );

  run(
    "npx",
    [
      "ts-node",
      "scripts/verifyDeployedBytecode.ts",
    ],
    { stdio: "inherit" }
  );

  const state = await verifyFrozenState();
  const txpool = txPoolOccupancy();

  console.log(
    JSON.stringify(
      {
        status: "FORMAL_BESU_RESTORE_READY",
        snapshotRoot,
        state,
        txpool,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exitCode = 1;
});
