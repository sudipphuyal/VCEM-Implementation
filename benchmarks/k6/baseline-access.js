import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Rate, Trend } from "k6/metrics";

const fixturePath = __ENV.BENCHMARK_FIXTURES || "benchmarks/raw/fixtures/benchmark-fixtures.json";
const fixtures = new SharedArray("baseline benchmark fixtures", () => [JSON.parse(open(`../../${fixturePath}`))])[0];
const requests = fixtures.requests;
const started = Date.now();
const warmupMs = Number(__ENV.WARMUP_SECONDS || 60) * 1000;

export const baselineLatencyMs = new Trend("baseline_latency_ms", true);
export const baselineReleaseRate = new Rate("baseline_release_rate");
export const baselineDenialRate = new Rate("baseline_denial_rate");

export const options = {
  scenarios: {
    warmup_then_measure: {
      executor: "constant-vus",
      vus: Number(__ENV.USERS || 10),
      duration: `${Number(__ENV.WARMUP_SECONDS || 60) + Number(__ENV.MEASURE_SECONDS || 300)}s`,
      gracefulStop: "30s",
    },
  },
  summaryTrendStats: ["avg", "min", "med", "p(50)", "p(95)", "max"],
};

function fixtureForIteration() {
  return requests[(__VU * 100000 + __ITER) % requests.length];
}

function tags() {
  return { phase: Date.now() - started < warmupMs ? "warmup" : "measure" };
}

export default function () {
  const api = __ENV.BASELINE_API_URL;
  if (!api) throw new Error("BASELINE_API_URL is required");
  const item = fixtureForIteration();
  const startedAt = Date.now();
  const response = http.post(
    `${api}/baseline/access`,
    JSON.stringify({
      participantId: item.participantId,
      requestorId: item.requestorId,
      dataHash: item.dataHash,
      scopeHash: item.scopeHash,
      purpose: item.purpose,
      requestId: item.requestId,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fixtures.sessionToken}`,
      },
      tags: tags(),
    }
  );
  const ok = check(response, { "baseline release accepted": (r) => r.status >= 200 && r.status < 300 });
  baselineReleaseRate.add(ok);
  baselineDenialRate.add(!ok);
  baselineLatencyMs.add(Date.now() - startedAt);
  sleep(1);
}
