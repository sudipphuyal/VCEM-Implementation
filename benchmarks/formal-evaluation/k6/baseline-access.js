import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const fixturePath = __ENV.BENCHMARK_FIXTURES || "benchmarks/raw/fixtures/benchmark-fixtures.json";
const requests = new SharedArray("baseline benchmark fixtures", () => JSON.parse(open(`../../../${fixturePath}`)).requests);
const warmupMs = Number(__ENV.WARMUP_SECONDS || 60) * 1000;
const measureMs = Number(__ENV.MEASURE_SECONDS || 300) * 1000;

export const baselineLatencyMs = new Trend("baseline_latency_ms", true);
export const baselineReleaseRate = new Rate("baseline_release_rate");
export const baselineDenialRate = new Rate("baseline_denial_rate");
export const baselineWorkflowsCompleted = new Counter("baseline_workflows_completed");
export const baselineWorkflowsFailed = new Counter("baseline_workflows_failed");

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
  return requests[exec.scenario.iterationInTest % requests.length];
}

function inMeasurementWindow() {
  const elapsedMs = exec.instance.currentTestRunDuration;
  return elapsedMs >= warmupMs && elapsedMs < warmupMs + measureMs;
}

function tags() {
  return { phase: inMeasurementWindow() ? "measure" : "warmup" };
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

  if (inMeasurementWindow()) {
    baselineReleaseRate.add(ok);
    baselineDenialRate.add(!ok);
    baselineLatencyMs.add(Date.now() - startedAt);
    if (ok) baselineWorkflowsCompleted.add(1);
    else baselineWorkflowsFailed.add(1);
  }

  sleep(1);
}
