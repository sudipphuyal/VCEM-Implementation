# Benchmark Methodology

Benchmark tooling is executable, but benchmark results are evidence only when raw run artifacts show `status: executed`.

## Commands

```bash
npm run benchmark:seed
npm run benchmark:baseline
npm run benchmark:vcem
npm run benchmark:all
npm run benchmark:analyze
```

## Workloads

Required load levels:

- 10 users
- 25 users
- 50 users
- 75 users
- 100 users

Each level runs five independent repetitions. Every repetition is configured for:

- 60-second warm-up;
- 300-second measurement window;
- deterministic fixture input;
- separate raw output directory.

The runner writes metadata for every planned run even when prerequisites are missing. Missing k6, missing service URLs, missing PostgreSQL, or incomplete deployed VCEM signed fixtures are recorded as `not executed`.

## VCEM Path

The VCEM k6 workload targets the authenticated API:

1. Use a bearer session created by deterministic benchmark setup.
2. Submit `/access/authorize` with an EIP-712 signed VCEM request.
3. Wait for the API to submit and confirm the blockchain authorization transaction.
4. Submit `/data/release`.
5. Let the secure data proxy verify the receipt and `AccessAuthorized` event before release.

The VCEM runner requires:

- `k6` on `PATH`;
- `VCEM_API_URL`;
- deployed VCEM contracts;
- `deployments/vcem-manifest.json`;
- benchmark fixtures containing `signature`, `expectedConsentHash`, `consentVersion`, and `actorsRoot`.

The offline seed command intentionally does not fabricate deployed-contract signatures. A VCEM benchmark is executable only after deployed-consent-specific signed fixtures are generated.

## PostgreSQL Baseline

The baseline uses PostgreSQL 15 RBAC/RLS logic in `benchmarks/baseline/postgres-rls.sql` and an HTTP service in `benchmarks/baseline/server.ts`.

It checks:

- authenticated bearer session;
- active researcher;
- researcher role;
- participant binding;
- purpose authorization;
- scope authorization;
- data hash binding;
- unique request ID delivery ledger;
- encrypted artifact delivery.

The baseline intentionally performs no blockchain transaction.

The baseline runner requires:

- `k6` on `PATH`;
- `BASELINE_API_URL`;
- `BASELINE_DATABASE_URL` or `DATABASE_URL` for seeding.

## Metrics

The k6 summaries and resource sampler support:

- blockchain transaction confirmation time;
- end-to-end application latency;
- p50 latency;
- p95 latency;
- throughput/TPS;
- error rate;
- proxy release/denial rate;
- RPC failure rate;
- baseline latency and throughput.

Resource sampling writes Docker stats CSV for:

- API container when `API_CONTAINER` is configured;
- PostgreSQL container when `POSTGRES_CONTAINER` is configured;
- each Besu validator container;
- the Besu RPC container.

## Artifacts

Raw artifacts:

- `benchmarks/raw/fixtures/benchmark-fixtures.json`
- `benchmarks/raw/baseline/<users>u/run-<n>/metadata.json`
- `benchmarks/raw/baseline/<users>u/run-<n>/k6-summary.json`
- `benchmarks/raw/baseline/<users>u/run-<n>/resources.csv`
- `benchmarks/raw/vcem/<users>u/run-<n>/metadata.json`
- `benchmarks/raw/vcem/<users>u/run-<n>/k6-summary.json`
- `benchmarks/raw/vcem/<users>u/run-<n>/resources.csv`

Analysis artifacts:

- `benchmarks/analysis/summary.json`
- `benchmarks/analysis/summary.csv`
- `benchmarks/reports/benchmark-report.md`

The Markdown report includes Git commit, deployment manifest, Docker image versions where available, host details, timestamp, exact command, raw artifact paths, and clear executed/not-executed status.

## Reporting Rule

Do not copy performance figures into the manuscript unless all relevant workload/run directories contain successful `status: executed` metadata and matching raw k6 summaries.
