import fs from "fs";
import path from "path";

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function stddev(values: number[]) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

const rawDir = process.argv[2] || "benchmarks/raw";
const rows = fs.existsSync(rawDir)
  ? fs.readdirSync(rawDir).filter((file) => file.endsWith(".json")).flatMap((file) => JSON.parse(fs.readFileSync(path.join(rawDir, file), "utf8")))
  : [];
const latencies = rows.map((row: any) => Number(row.latencyMs)).filter(Number.isFinite);
const analysis = {
  samples: latencies.length,
  mean: mean(latencies),
  stddev: stddev(latencies),
  p95: percentile(latencies, 95),
  confidenceInterval95: latencies.length ? 1.96 * (stddev(latencies) / Math.sqrt(latencies.length)) : 0,
};
fs.mkdirSync("benchmarks/analysis", { recursive: true });
fs.writeFileSync("benchmarks/analysis/summary.json", JSON.stringify(analysis, null, 2));
console.log(JSON.stringify(analysis, null, 2));
