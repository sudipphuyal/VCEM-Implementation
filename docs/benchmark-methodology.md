# Benchmark Methodology

Benchmark tooling must produce evidence only from actual runs.

Required load levels:

- 10 users;
- 25 users;
- 50 users;
- 75 users;
- 100 users.

Each level requires a 60-second warm-up, 300-second measurement window, and five independent runs. Raw outputs belong in `benchmarks/raw/`; analysis outputs belong in `benchmarks/analysis/` and `benchmarks/reports/`.

Metrics:

- blockchain confirmation time;
- application response latency;
- p50 and p95 latency;
- throughput;
- error rate;
- CPU and memory per Besu node;
- comparable PostgreSQL RBAC/RLS baseline latency and throughput.

No benchmark result should be copied into papers or reports unless the corresponding raw files and deployment manifest exist.
