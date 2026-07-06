import "dotenv/config";
import childProcess from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
function parseNumberList(value: string | undefined, fallback: number[]) {
  if (!value) return fallback;
  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
  return parsed.length ? parsed : fallback;
}

const levels = parseNumberList(process.env.BENCHMARK_LEVELS, [10, 25, 50, 75, 100]);
const runs = parseNumberList(process.env.BENCHMARK_RUNS, [1, 2, 3, 4, 5]);
const warmupSeconds = Number(process.env.BENCHMARK_WARMUP_SECONDS || 60);
const measureSeconds = Number(process.env.BENCHMARK_MEASURE_SECONDS || 300);

function commandExists(command: string) {
  const result = childProcess.spawnSync(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

function gitCommit() {
  try {
    return childProcess.execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function dockerVersions() {
  const image = (name: string) => {
    const result = childProcess.spawnSync("docker", ["inspect", name, "--format", "{{.Config.Image}}"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : "unavailable";
  };
  return {
    docker: childProcess.spawnSync("docker", ["--version"], { encoding: "utf8" }).stdout?.trim() || "unavailable",
    compose: childProcess.spawnSync("docker", ["compose", "version"], { encoding: "utf8" }).stdout?.trim() || "unavailable",
    besu: image("vcem-besu-rpc-1"),
    postgres: process.env.POSTGRES_CONTAINER ? image(process.env.POSTGRES_CONTAINER) : "not configured",
    api: process.env.API_CONTAINER ? image(process.env.API_CONTAINER) : "not configured",
  };
}

function hostDetails() {
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    node: process.version,
  };
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function resetBaselineFixtureAndDatabase() {
  const databaseConfigured = Boolean(process.env.BASELINE_DATABASE_URL || process.env.DATABASE_URL);
  if (!databaseConfigured) return { ok: false, reason: "BASELINE_DATABASE_URL/DATABASE_URL is required for baseline reset" };
  const result = childProcess.spawnSync("npm", ["run", "benchmark:seed", "--silent"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) return { ok: false, reason: `benchmark seed failed with exit code ${result.status}` };
  return { ok: true };
}

function resetVcemFixtures() {
  const result = childProcess.spawnSync("npm", ["run", "benchmark:vcem:seed", "--silent"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) return { ok: false, reason: `VCEM fixture seed failed with exit code ${result.status}` };
  return { ok: true };
}

function metricValue(summary: any, name: string) {
  const metric = summary?.metrics?.[name];
  return typeof metric?.value === "number" ? metric.value : undefined;
}

function metricFails(summary: any, name: string) {
  const metric = summary?.metrics?.[name];
  return typeof metric?.fails === "number" ? metric.fails : undefined;
}

function validateK6Summary(mode: "baseline" | "vcem", summaryPath: string) {
  if (!fs.existsSync(summaryPath)) return { ok: false, failures: ["k6 summary was not written"] };
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const failures: string[] = [];
  const checkFails = metricFails(summary, "checks");
  const httpFailed = metricValue(summary, "http_req_failed");
  if (checkFails === undefined) failures.push("checks metric missing");
  else if (checkFails > 0) failures.push(`checks failed: ${checkFails}`);
  if (httpFailed === undefined) failures.push("http_req_failed metric missing");
  else if (httpFailed > 0) failures.push(`http_req_failed rate: ${httpFailed}`);
  const releaseMetric = mode === "baseline" ? "baseline_release_rate" : "vcem_proxy_release_rate";
  const denialMetric = mode === "baseline" ? "baseline_denial_rate" : "vcem_proxy_denial_rate";
  const releaseRate = metricValue(summary, releaseMetric);
  const denialRate = metricValue(summary, denialMetric);
  if (releaseRate === undefined) failures.push(`${releaseMetric} metric missing`);
  else if (releaseRate < 1) failures.push(`${releaseMetric}: ${releaseRate}`);
  if (denialRate !== undefined && denialRate > 0) failures.push(`${denialMetric}: ${denialRate}`);
  return { ok: failures.length === 0, failures };
}

function startDockerSampler(outCsv: string) {
  fs.mkdirSync(path.dirname(outCsv), { recursive: true });
  fs.writeFileSync(outCsv, "timestamp,container,cpu_percent,mem_usage,mem_limit,mem_percent,net_io,block_io,pids\n");
  const containers = ["vcem-besu-validator1-1", "vcem-besu-validator2-1", "vcem-besu-validator3-1", "vcem-besu-validator4-1", "vcem-besu-rpc-1"];
  if (process.env.API_CONTAINER) containers.push(process.env.API_CONTAINER);
  if (process.env.POSTGRES_CONTAINER) containers.push(process.env.POSTGRES_CONTAINER);
  const timer = setInterval(() => {
    const result = childProcess.spawnSync(
      "docker",
      ["stats", "--no-stream", "--format", "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}", ...containers],
      { encoding: "utf8" }
    );
    if (result.status !== 0) return;
    const now = new Date().toISOString();
    for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
      const [container, cpu, memUsage, memPercent, netIo, blockIo, pids] = line.split(",");
      const [memUsed, memLimit] = (memUsage || "").split(" / ");
      fs.appendFileSync(outCsv, [now, container, cpu, memUsed, memLimit, memPercent, netIo, blockIo, pids].join(",") + "\n");
    }
  }, Number(process.env.BENCHMARK_RESOURCE_INTERVAL_MS || 5000));
  return () => clearInterval(timer);
}

function k6Script(mode: "baseline" | "vcem") {
  return mode === "baseline" ? "benchmarks/k6/baseline-access.js" : "benchmarks/k6/vcem-access.js";
}

function requiredEnv(mode: "baseline" | "vcem") {
  return mode === "baseline" ? ["BASELINE_API_URL"] : ["VCEM_API_URL"];
}

function fixtureReady(mode: "baseline" | "vcem", fixturePath: string) {
  if (!fs.existsSync(fixturePath)) return { ok: false, reason: "benchmark fixtures are missing; run npm run benchmark:seed" };
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (mode === "vcem") {
    const first = fixture.requests?.[0] || {};
    for (const field of ["signature", "expectedConsentHash", "consentVersion", "actorsRoot"]) {
      if (!first[field]) return { ok: false, reason: `VCEM fixture missing ${field}; generate deployed-contract signed fixtures before executing VCEM load` };
    }
  }
  return { ok: true };
}

function runOne(mode: "baseline" | "vcem", users: number, run: number) {
  const fixturePath = process.env.BENCHMARK_FIXTURES || "benchmarks/raw/fixtures/benchmark-fixtures.json";
  const outDir = path.join(repoRoot, "benchmarks", "raw", mode, `${users}u`, `run-${run}`);
  const summaryPath = path.join(outDir, "k6-summary.json");
  const resourcePath = path.join(outDir, "resources.csv");
  const manifestPath = path.join(repoRoot, "deployments", "vcem-manifest.json");
  const metadata = {
    status: "not executed",
    mode,
    users,
    run,
    warmupSeconds,
    measureSeconds,
    timestamp: new Date().toISOString(),
    command: `k6 run ${k6Script(mode)}`,
    gitCommit: gitCommit(),
    deploymentManifest: fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null,
    dockerImages: dockerVersions(),
    host: hostDetails(),
    rawArtifactPaths: { summaryPath, resourcePath },
  } as any;
  const missing = requiredEnv(mode).filter((name) => !process.env[name]);
  if (!commandExists("k6")) metadata.reason = "k6 is not installed or not on PATH";
  else if (missing.length) metadata.reason = `missing environment: ${missing.join(", ")}`;
  else if (mode === "baseline" && process.env.BENCHMARK_RESET_BETWEEN_RUNS !== "0") {
    const reset = resetBaselineFixtureAndDatabase();
    if (!reset.ok) metadata.reason = reset.reason;
  } else if (mode === "vcem" && process.env.BENCHMARK_RESET_BETWEEN_RUNS !== "0") {
    const reset = resetVcemFixtures();
    if (!reset.ok) metadata.reason = reset.reason;
  }
  const ready = fixtureReady(mode, path.join(repoRoot, fixturePath));
  if (!metadata.reason && !ready.ok) metadata.reason = ready.reason;
  if (metadata.reason) {
    writeJson(path.join(outDir, "metadata.json"), metadata);
    return metadata;
  }
  const stopSampler = startDockerSampler(resourcePath);
  const result = childProcess.spawnSync(
    "k6",
    ["run", "--summary-export", summaryPath, k6Script(mode)],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        USERS: String(users),
        WARMUP_SECONDS: String(warmupSeconds),
        MEASURE_SECONDS: String(measureSeconds),
        BENCHMARK_FIXTURES: fixturePath,
      },
    }
  );
  stopSampler();
  metadata.exitCode = result.status;
  if (result.status !== 0) {
    metadata.status = "failed";
    metadata.validationFailures = [`k6 exited with code ${result.status}`];
  } else {
    const validation = validateK6Summary(mode, summaryPath);
    metadata.status = validation.ok ? "executed" : "failed";
    if (!validation.ok) metadata.validationFailures = validation.failures;
  }
  writeJson(path.join(outDir, "metadata.json"), metadata);
  return metadata;
}

async function main() {
  const mode = process.argv[2] as "baseline" | "vcem" | "all";
  if (!["baseline", "vcem", "all"].includes(mode)) throw new Error("usage: ts-node benchmarks/scripts/run.ts baseline|vcem|all");
  const modes = mode === "all" ? (["baseline", "vcem"] as const) : ([mode] as const);
  const results = [];
  for (const current of modes) {
    for (const users of levels) {
      for (const run of runs) {
        results.push(runOne(current, users, run));
      }
    }
  }
  writeJson(path.join(repoRoot, "benchmarks", "raw", `run-index-${Date.now()}.json`), results);
  console.log(JSON.stringify(results.map(({ mode, users, run, status, reason }) => ({ mode, users, run, status, reason })), null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
