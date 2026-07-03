# Reproducibility

## Local

1. Copy `.env.example` to `.env` and fill local-only values.
2. Install pinned dependencies with `npm ci`.
3. Compile with `npm run compile`.
4. Run supported tests with `npm test`.
5. Run VCEM unit tests with `npm run test:vcem`.
6. Generate paper-aligned 120-outcome matrix evidence with `npm run test:vcem:matrix`.
7. Run isolated experimental legacy ZKP tests with `npm run test:legacy:zkp`; they currently fail until proof artifacts are repaired.
8. Verify deployed bytecode with `npm run audit:verify-bytecode` after creating `deployments/vcem-manifest.json`.
6. Run `npm run audit:verify -- --rpc=<rpc> --consent=<address> --audit=<address>`.

## Besu

`infrastructure/besu` contains Docker scaffolding for a four-validator IBFT 2.0 network plus one localhost-bound RPC node. Validator keys and real genesis `extraData` must be generated before experiments.

## Benchmarks

Benchmark scripts are present, but no benchmark results are claimed unless raw outputs are produced in `benchmarks/raw/` and analyzed into `benchmarks/analysis/`.
