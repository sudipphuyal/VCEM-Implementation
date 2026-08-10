import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const fixturePath = __ENV.BENCHMARK_FIXTURES || "benchmarks/raw/fixtures/benchmark-fixtures.json";
const requests = new SharedArray("vcem benchmark fixtures", () => JSON.parse(open(`../../../${fixturePath}`)).requests);
const warmupMs = Number(__ENV.WARMUP_SECONDS || 60) * 1000;
const measureMs = Number(__ENV.MEASURE_SECONDS || 300) * 1000;

export const txConfirmationMs = new Trend("vcem_tx_confirmation_ms", true);
export const appLatencyMs = new Trend("vcem_app_latency_ms", true);
export const releaseRate = new Rate("vcem_proxy_release_rate");
export const denialRate = new Rate("vcem_proxy_denial_rate");
export const rpcFailureRate = new Rate("vcem_rpc_failure_rate");
export const authorizationErrors = new Counter("vcem_authorization_errors");
export const vcemWorkflowsCompleted = new Counter("vcem_workflows_completed");
export const vcemWorkflowsFailed = new Counter("vcem_workflows_failed");

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
  const api = __ENV.VCEM_API_URL;
  if (!api) throw new Error("VCEM_API_URL is required");
  const item = fixtureForIteration();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${fixtures.sessionToken}`,
  };
  const requestStarted = Date.now();
  const authorize = http.post(
    `${api}/access/authorize`,
    JSON.stringify({
      request: {
        participantId: item.participantId,
        requestorId: item.requestorId,
        dataHash: item.dataHash,
        scopeHash: item.scopeHash,
        requestedPurpose: item.purpose,
        requestId: item.requestId,
        clientTimestamp: item.clientTimestamp,
        requestExpiry: item.requestExpiry,
        expectedConsentHash: item.expectedConsentHash,
      },
      signature: item.signature,
    }),
    { headers, tags: tags() }
  );
  const authOk = check(authorize, { "authorize accepted": (r) => r.status >= 200 && r.status < 300 });
  if (!authOk) {
    if (inMeasurementWindow()) {
      authorizationErrors.add(1);
      vcemWorkflowsFailed.add(1);
      rpcFailureRate.add(authorize.status >= 500 || authorize.status === 0);
      denialRate.add(true);
    }

    return sleep(1);
  }

  const authBody = authorize.json();
  const transactionConfirmationElapsedMs = Date.now() - requestStarted;
  const release = http.post(
    `${api}/data/release`,
    JSON.stringify({
      transactionHash: authBody.transactionHash,
      participantId: item.participantId,
      requestorId: item.requestorId,
      dataHash: item.dataHash,
      scopeHash: item.scopeHash,
      purpose: item.purpose,
      requestId: item.requestId,
      consentVersion: item.consentVersion,
      consentHash: item.expectedConsentHash,
      actorsRoot: item.actorsRoot,
    }),
    { headers, tags: tags() }
  );
  const releaseOk = check(release, { "release accepted": (r) => r.status >= 200 && r.status < 300 });

  if (inMeasurementWindow()) {
    txConfirmationMs.add(transactionConfirmationElapsedMs);
    appLatencyMs.add(Date.now() - requestStarted);
    releaseRate.add(releaseOk);
    denialRate.add(!releaseOk);
    rpcFailureRate.add(false);

    if (releaseOk) vcemWorkflowsCompleted.add(1);
    else vcemWorkflowsFailed.add(1);
  }

  sleep(1);
}
