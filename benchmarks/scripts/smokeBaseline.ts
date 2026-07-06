import "dotenv/config";
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

function fixturePath() {
  return path.join(repoRoot, process.env.BENCHMARK_FIXTURES || "benchmarks/raw/fixtures/benchmark-fixtures.json");
}

async function main() {
  const api = process.env.BASELINE_API_URL || "http://127.0.0.1:8091";
  const file = fixturePath();
  if (!fs.existsSync(file)) throw new Error(`benchmark fixtures missing at ${file}; run npm run benchmark:seed`);
  const fixtures = JSON.parse(fs.readFileSync(file, "utf8"));
  const index = Number(process.env.BENCHMARK_REQUEST_INDEX || 0);
  const request = fixtures.requests?.[index];
  if (!request) throw new Error(`fixture request index ${index} is unavailable`);
  if (!fixtures.sessionToken) throw new Error("fixture session token is missing");
  const started = Date.now();
  const response = await fetch(`${api.replace(/\/$/, "")}/baseline/access`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${fixtures.sessionToken}`,
    },
    body: JSON.stringify({
      participantId: request.participantId,
      requestorId: request.requestorId,
      dataHash: request.dataHash,
      scopeHash: request.scopeHash,
      purpose: request.purpose,
      requestId: request.requestId,
    }),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep non-JSON body for diagnostics.
  }
  const result = {
    ok: response.ok,
    status: response.status,
    api,
    fixtureIndex: index,
    requestId: request.requestId,
    latencyMs: Date.now() - started,
    body,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
