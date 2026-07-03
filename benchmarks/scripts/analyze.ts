import fs from "fs";
import os from "os";
import path from "path";
import childProcess from "child_process";

const repoRoot = path.resolve(__dirname, "../..");
const rawRoot = path.join(repoRoot, "benchmarks", "raw");
const analysisRoot = path.join(repoRoot, "benchmarks", "analysis");
const reportsRoot = path.join(repoRoot, "benchmarks", "reports");

type RunRow = {
  mode: string;
  users: number;
  run: number;
  status: string;
  metric: string;
  avg?: number;
  p50?: number;
  p95?: number;
  count?: number;
  rate?: number;
  reason?: string;
  summaryPath: string;
  resourcePath: string;
};

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return fs.statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function sd(values: number[]) {
  const avg = mean(values);
  return values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)) : 0;
}

function ci95(values: number[]) {
  return values.length ? 1.96 * (sd(values) / Math.sqrt(values.length)) : 0;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function gitCommit() {
  try {
    return childProcess.execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function metricValue(summary: any, name: string, key: string) {
  return summary?.metrics?.[name]?.values?.[key];
}

function summarizeResources(resourcePath: string) {
  if (!fs.existsSync(resourcePath)) return [];
  const rows = fs.readFileSync(resourcePath, "utf8").trim().split("\n").slice(1).filter(Boolean);
  const byContainer = new Map<string, number[]>();
  for (const row of rows) {
    const columns = row.split(",");
    const container = columns[1];
    const cpu = Number((columns[2] || "").replace("%", ""));
    if (!container || !Number.isFinite(cpu)) continue;
    byContainer.set(container, [...(byContainer.get(container) || []), cpu]);
  }
  return [...byContainer.entries()].map(([container, cpu]) => ({ container, avgCpuPercent: mean(cpu), maxCpuPercent: Math.max(...cpu) }));
}

function collectRows(): RunRow[] {
  return walk(rawRoot)
    .filter((file) => file.endsWith("metadata.json"))
    .flatMap((metadataPath) => {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      const summaryPath = metadata.rawArtifactPaths?.summaryPath || path.join(path.dirname(metadataPath), "k6-summary.json");
      const resourcePath = metadata.rawArtifactPaths?.resourcePath || path.join(path.dirname(metadataPath), "resources.csv");
      const summary = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, "utf8")) : null;
      const metrics = metadata.mode === "baseline"
        ? ["baseline_latency_ms", "http_req_duration", "http_reqs", "http_req_failed", "baseline_release_rate", "baseline_denial_rate"]
        : ["vcem_app_latency_ms", "vcem_tx_confirmation_ms", "http_req_duration", "http_reqs", "http_req_failed", "vcem_proxy_release_rate", "vcem_proxy_denial_rate", "vcem_rpc_failure_rate"];
      return metrics.map((metric) => ({
        mode: metadata.mode,
        users: Number(metadata.users),
        run: Number(metadata.run),
        status: metadata.status,
        metric,
        avg: metricValue(summary, metric, "avg"),
        p50: metricValue(summary, metric, "p(50)") ?? metricValue(summary, metric, "med"),
        p95: metricValue(summary, metric, "p(95)"),
        count: metricValue(summary, metric, "count"),
        rate: metricValue(summary, metric, "rate"),
        reason: metadata.reason,
        summaryPath,
        resourcePath,
      }));
    });
}

function aggregate(rows: RunRow[]) {
  const groups = new Map<string, RunRow[]>();
  for (const row of rows) groups.set(`${row.mode}:${row.users}:${row.metric}`, [...(groups.get(`${row.mode}:${row.users}:${row.metric}`) || []), row]);
  return [...groups.entries()].map(([key, values]) => {
    const [mode, users, metric] = key.split(":");
    const avgs = values.map((row) => row.avg).filter((value): value is number => Number.isFinite(value));
    const p50s = values.map((row) => row.p50).filter((value): value is number => Number.isFinite(value));
    const p95s = values.map((row) => row.p95).filter((value): value is number => Number.isFinite(value));
    return {
      mode,
      users: Number(users),
      metric,
      executedRuns: values.filter((row) => row.status === "executed").length,
      totalRuns: values.length,
      mean: mean(avgs),
      sd: sd(avgs),
      p50: mean(p50s),
      p95: mean(p95s),
      ci95: ci95(avgs),
      status: values.some((row) => row.status === "executed") ? "executed" : "not executed",
      reasons: [...new Set(values.map((row) => row.reason).filter(Boolean))],
    };
  });
}

function writeCsv(file: string, rows: Array<Record<string, unknown>>) {
  const headers = Object.keys(rows[0] || { empty: "" });
  fs.writeFileSync(file, [headers.join(","), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(","))].join("\n") + "\n");
}

function markdown(rows: ReturnType<typeof aggregate>, rawRows: RunRow[]) {
  const manifestPath = path.join(repoRoot, "deployments", "vcem-manifest.json");
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;
  const rawPaths = [...new Set(rawRows.map((row) => path.dirname(row.summaryPath)))];
  const lines = [
    "# VCEM Benchmark Report",
    "",
    `Status: ${rows.some((row) => row.status === "executed") ? "executed" : "not executed"}`,
    `Timestamp: ${new Date().toISOString()}`,
    `Git commit: ${gitCommit()}`,
    `Host: ${os.platform()} ${os.release()} ${os.arch()}, ${os.cpus().length} CPUs, ${os.totalmem()} bytes RAM`,
    `Deployment manifest: ${manifestPath}`,
    "",
    "## Deployment Manifest",
    "",
    "```json",
    JSON.stringify(manifest, null, 2),
    "```",
    "",
    "## Raw Artifact Paths",
    "",
    ...rawPaths.map((entry) => `- ${entry}`),
    "",
    "## Aggregate Metrics",
    "",
    "| mode | users | metric | status | executed runs | mean | SD | p50 | p95 | 95% CI |",
    "|---|---:|---|---|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.mode} | ${row.users} | ${row.metric} | ${row.status} | ${row.executedRuns}/${row.totalRuns} | ${row.mean.toFixed(3)} | ${row.sd.toFixed(3)} | ${row.p50.toFixed(3)} | ${row.p95.toFixed(3)} | ${row.ci95.toFixed(3)} |`),
    "",
    "## Baseline Comparison",
    "",
    "Compare `baseline_latency_ms` and `vcem_app_latency_ms` for end-to-end latency, and `http_reqs` / `http_req_failed` for throughput and error behavior. Missing rows mean the corresponding benchmark was not executed.",
    "",
    "## Resource Summary",
    "",
  ];
  for (const resourcePath of [...new Set(rawRows.map((row) => row.resourcePath))]) {
    const resources = summarizeResources(resourcePath);
    if (!resources.length) continue;
    lines.push(`### ${resourcePath}`, "", "| container | avg CPU % | max CPU % |", "|---|---:|---:|");
    for (const resource of resources) lines.push(`| ${resource.container} | ${resource.avgCpuPercent.toFixed(2)} | ${resource.maxCpuPercent.toFixed(2)} |`);
    lines.push("");
  }
  lines.push("## Notes", "", "No paper performance figures are claimed by this report unless the corresponding raw run directories show `status: executed`.");
  return lines.join("\n");
}

function main() {
  fs.mkdirSync(analysisRoot, { recursive: true });
  fs.mkdirSync(reportsRoot, { recursive: true });
  const rawRows = collectRows();
  const aggregates = aggregate(rawRows);
  fs.writeFileSync(path.join(analysisRoot, "summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), aggregates }, null, 2));
  writeCsv(path.join(analysisRoot, "summary.csv"), aggregates);
  fs.writeFileSync(path.join(reportsRoot, "benchmark-report.md"), markdown(aggregates, rawRows));
  console.log(JSON.stringify({ rows: rawRows.length, aggregates: aggregates.length, report: path.join(reportsRoot, "benchmark-report.md") }, null, 2));
}

main();
