import childProcess from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const formalRoot = path.join(repoRoot, "benchmarks", "formal-evaluation");
const resultsRoot = path.join(formalRoot, "results");

const allowedUsers = [10, 25, 50, 75, 100, 125, 150, 175, 200];
const allowedRuns = [1, 2, 3, 4, 5];
const warmupSeconds = 60;
const measureSeconds = 300;
const fixtureCount = 75000;

type Mode = "baseline" | "vcem";

function exec(command: string, args: string[], options: childProcess.SpawnSyncOptions = {}) {
  return childProcess.spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}

function execText(command: string, args: string[]) {
  const result = exec(command, args);
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${String(result.stderr || result.stdout || "").trim()}`
    );
  }
  return String(result.stdout || "").trim();
}

function gitCommit() {
  return execText("git", ["rev-parse", "HEAD"]);
}

function sha256(file: string) {
  return execText("shasum", ["-a", "256", file]).split(/\s+/)[0];
}

function swapUsedMb() {
  const value = execText("sysctl", ["-n", "vm.swapusage"]);
  const match = value.match(/used\s*=\s*([0-9.]+)([MGT])/i);
  if (!match) throw new Error(`unable to parse vm.swapusage: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "G") return amount * 1024;
  if (unit === "T") return amount * 1024 * 1024;
  return amount;
}

function requireCommand(name: string) {
  const result = exec("sh", ["-c", `command -v ${name}`]);
  if (result.status !== 0) throw new Error(`${name} is not available on PATH`);
}

function requireEnv(names: string[]) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`missing environment variables: ${missing.join(", ")}`);
}

function postgresReady() {
  const result = exec("docker", ["exec", "vcem-postgres", "pg_isready"]);
  return result.status === 0;
}

function parseArgs() {
  const mode = process.argv[2] as Mode;
  const users = Number(process.argv[3]);
  const run = Number(process.argv[4]);

  if (!["baseline", "vcem"].includes(mode)) {
    throw new Error("usage: ts-node benchmarks/formal-evaluation/runFormal.ts baseline|vcem USERS RUN");
  }
  if (!allowedUsers.includes(users)) {
    throw new Error(`USERS must be one of ${allowedUsers.join(", ")}`);
  }
  if (!allowedRuns.includes(run)) {
    throw new Error("RUN must be one of 1, 2, 3, 4, 5");
  }

  return { mode, users, run };
}

function expectedPrevious(mode: Mode, users: number, run: number) {
  if (run > 1) return { mode, users, run: run - 1 };

  const userIndex = allowedUsers.indexOf(users);
  if (mode === "vcem") {
    return { mode: "baseline" as Mode, users, run: 5 };
  }
  if (userIndex <= 0) return null;

  return {
    mode: "vcem" as Mode,
    users: allowedUsers[userIndex - 1],
    run: 5,
  };
}

function runDir(mode: Mode, users: number, run: number) {
  return path.join(resultsRoot, mode, `${users}u`, `run-${run}`);
}

function validateSequence(mode: Mode, users: number, run: number) {
  const previous = expectedPrevious(mode, users, run);
  if (!previous) return;

  const previousMetadata = path.join(
    runDir(previous.mode, previous.users, previous.run),
    "metadata.json"
  );

  if (!fs.existsSync(previousMetadata)) {
    throw new Error(
      `previous planned repetition is incomplete: ${previous.mode} ${previous.users} VU run ${previous.run}`
    );
  }

  const metadata = JSON.parse(fs.readFileSync(previousMetadata, "utf8"));
  if (metadata.status !== "executed") {
    throw new Error(
      `previous planned repetition status is ${metadata.status}, not executed`
    );
  }
}

function checkEmptyDestination(dir: string) {
  if (!fs.existsSync(dir)) return;
  if (fs.readdirSync(dir).length > 0) {
    throw new Error(`formal result directory already exists and is non-empty: ${dir}`);
  }
}

function hostInfo() {
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memoryBytes: os.totalmem(),
  };
}

function main() {
  const { mode, users, run } = parseArgs();

  requireCommand("k6");
  requireCommand("docker");
  requireCommand("shasum");

  validateSequence(mode, users, run);

  const outDir = runDir(mode, users, run);
  checkEmptyDestination(outDir);

  const preSwapMb = swapUsedMb();
  if (preSwapMb > 0) {
    throw new Error(
      `PRECONDITION_FAILED: host swap is ${preSwapMb.toFixed(2)} MiB; reboot before this repetition`
    );
  }

  if (!postgresReady()) {
    throw new Error("PRECONDITION_FAILED: vcem-postgres is not ready");
  }

  if (mode === "baseline") {
    requireEnv(["BASELINE_DATABASE_URL", "BASELINE_API_URL"]);
  } else {
    requireEnv(["DATABASE_URL", "VCEM_API_URL"]);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const metadata = {
    protocolVersion: 1,
    status: "prepared",
    mode,
    users,
    run,
    warmupSeconds,
    measureSeconds,
    fixtureCount,
    preparedAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    host: hostInfo(),
    preRunSwapMiB: preSwapMb,
    paths: {
      outputDir: outDir,
      summary: path.join(outDir, "k6-summary.json"),
      fixture: path.join(outDir, "benchmark-fixtures.json"),
      monitorDir: path.join(outDir, "monitor"),
      applicationDiagnosticLog:
        mode === "vcem" ? path.join(outDir, "vcem-events.jsonl") : null,
    },
  };

  fs.writeFileSync(
    path.join(outDir, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  console.log(JSON.stringify({
    status: "PREPARED",
    mode,
    users,
    run,
    outputDir: outDir,
    gitCommit: metadata.gitCommit,
    preRunSwapMiB: preSwapMb,
    nextAction:
      mode === "baseline"
        ? "RESET_BASELINE_AND_EXECUTE"
        : "RESTORE_FORMAL_BESU_SNAPSHOT_THEN_EXECUTE"
  }, null, 2));
}

main();
