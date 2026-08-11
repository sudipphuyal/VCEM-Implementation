import childProcess from "child_process";
import fs from "fs";
import http from "http";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const outputDir = path.resolve(
  process.env.VCEM_DIAGNOSTIC_DIR ||
    path.join(repoRoot, "benchmarks", "diagnostics", "current")
);

const intervalMs = Number(process.env.VCEM_DIAGNOSTIC_INTERVAL_MS || 5000);
const formalMode = process.env.FORMAL_MODE || "vcem";

if (!["baseline", "vcem"].includes(formalMode)) {
  throw new Error("FORMAL_MODE must be baseline or vcem");
}

const nodes = formalMode === "vcem" ? [
  { name: "validator1", port: 9545 },
  { name: "validator2", port: 9546 },
  { name: "validator3", port: 9547 },
  { name: "validator4", port: 9548 },
  { name: "rpc", port: 9549 },
] : [];

const containers =
  formalMode === "vcem"
    ? [
        "vcem-besu-validator1-1",
        "vcem-besu-validator2-1",
        "vcem-besu-validator3-1",
        "vcem-besu-validator4-1",
        "vcem-besu-rpc-1",
      ]
    : [];

if (process.env.API_CONTAINER) containers.push(process.env.API_CONTAINER);

const postgresContainer =
  process.env.POSTGRES_CONTAINER ||
  (formalMode === "baseline" ? "vcem-postgres" : "");

if (postgresContainer && !containers.includes(postgresContainer)) {
  containers.push(postgresContainer);
}

fs.mkdirSync(outputDir, { recursive: true });

const besuPath = path.join(outputDir, "besu-prometheus.jsonl");
const dockerPath = path.join(outputDir, "docker-stats.jsonl");
const rpcPath = path.join(outputDir, "rpc-chain-head.jsonl");
const metadataPath = path.join(outputDir, "monitor-metadata.json");

const relevantMetric = /^(besu_blockchain_chain_head_gas_limit|besu_blockchain_chain_head_gas_used|besu_blockchain_chain_head_gas_used_counter_total|besu_blockchain_chain_head_transaction_count|besu_blockchain_chain_head_transaction_count_counter_total|besu_executors_bfttimerexecutor_ibft_|besu_executors_ethscheduler_blockcreation_|besu_executors_ethscheduler_transactions_|besu_network_p2p_messages_inbound_total|besu_network_p2p_messages_outbound_total|besu_network_netty_|besu_network_vertx_|besu_peers_|besu_rpc_active_http_connection_count|besu_rpc_request_time|besu_transaction_pool_|process_cpu_seconds_total|process_resident_memory_bytes|process_virtual_memory_bytes|jvm_memory_used_bytes)/;

function appendJsonl(file: string, value: unknown) {
  fs.appendFileSync(file, JSON.stringify(value) + "\n");
}

function getText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => {
        if ((res.statusCode || 500) >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
    req.on("error", reject);
    req.setTimeout(2000, () => req.destroy(new Error(`timeout for ${url}`)));
  });
}

function rpcCall(method: string, params: unknown[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    });

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8545,
        path: "/",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (parsed.error) reject(new Error(JSON.stringify(parsed.error)));
            else resolve(parsed.result);
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(2000, () => req.destroy(new Error("JSON-RPC timeout")));
    req.write(body);
    req.end();
  });
}

async function sampleBesu(timestamp: string) {
  if (formalMode !== "vcem") return;

  await Promise.all(
    nodes.map(async ({ name, port }) => {
      try {
        const text = await getText(`http://127.0.0.1:${port}/metrics`);
        const metrics = text
          .split("\n")
          .filter((line) => line && !line.startsWith("#") && relevantMetric.test(line));

        appendJsonl(besuPath, {
          timestamp,
          node: name,
          port,
          metrics,
        });
      } catch (err: any) {
        appendJsonl(besuPath, {
          timestamp,
          node: name,
          port,
          error: String(err?.message || err),
        });
      }
    })
  );
}

function sampleDocker(timestamp: string) {
  const result = childProcess.spawnSync(
    "docker",
    [
      "stats",
      "--no-stream",
      "--format",
      "{{json .}}",
      ...containers,
    ],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    appendJsonl(dockerPath, {
      timestamp,
      error: result.stderr?.trim() || `docker stats exited ${result.status}`,
    });
    return;
  }

  for (const line of result.stdout.split("\n").filter(Boolean)) {
    try {
      appendJsonl(dockerPath, {
        timestamp,
        ...JSON.parse(line),
      });
    } catch (err: any) {
      appendJsonl(dockerPath, {
        timestamp,
        raw: line,
        error: String(err?.message || err),
      });
    }
  }
}

async function sampleChainHead(timestamp: string) {
  if (formalMode !== "vcem") return;

  try {
    const blockHex = await rpcCall("eth_blockNumber");
    appendJsonl(rpcPath, {
      timestamp,
      blockNumberHex: blockHex,
      blockNumber: Number(BigInt(blockHex)),
    });
  } catch (err: any) {
    appendJsonl(rpcPath, {
      timestamp,
      error: String(err?.message || err),
    });
  }
}

let running = false;
let stopped = false;

async function sample() {
  if (running || stopped) return;
  running = true;

  const timestamp = new Date().toISOString();

  try {
    sampleDocker(timestamp);
    await Promise.all([
      sampleBesu(timestamp),
      sampleChainHead(timestamp),
    ]);
  } finally {
    running = false;
  }
}

function gitCommit() {
  try {
    return childProcess
      .execSync("git rev-parse HEAD", {
        cwd: repoRoot,
        encoding: "utf8",
      })
      .trim();
  } catch {
    return "unknown";
  }
}

fs.writeFileSync(
  metadataPath,
  JSON.stringify(
    {
      startedAt: new Date().toISOString(),
      gitCommit: gitCommit(),
      formalMode,
      intervalMs,
      nodes,
      containers,
      outputDir,
      files: {
        besuPrometheus: besuPath,
        dockerStats: dockerPath,
        rpcChainHead: rpcPath,
      },
    },
    null,
    2
  )
);

console.log(`Formal ${formalMode} monitor started: ${outputDir}`);
console.log(`Sampling interval: ${intervalMs} ms`);

void sample();
const timer = setInterval(() => void sample(), intervalMs);

function stop(signal: string) {
  if (stopped) return;
  stopped = true;
  clearInterval(timer);

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  metadata.stoppedAt = new Date().toISOString();
  metadata.stopSignal = signal;
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log(`VCEM diagnostic monitor stopped (${signal})`);
}

process.on("SIGINT", () => {
  stop("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  stop("SIGTERM");
  process.exit(0);
});
