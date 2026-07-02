# Reproducibility

## Local

1. Copy `.env.example` to `.env` and fill local-only values.
2. Install pinned dependencies with `npm ci`.
3. Compile with `npm run compile`.
4. Run tests with `npm test` or `npm run test:vcem`.
5. Generate VCEM evidence with the matrix test.
6. Run `npm run audit:verify -- --rpc=<rpc> --consent=<address> --audit=<address>`.

## Besu

`infrastructure/besu` contains Docker scaffolding for a four-validator IBFT 2.0 network plus one localhost-bound RPC node. Validator keys and real genesis `extraData` must be generated before experiments.

## Benchmarks

Benchmark scripts are present, but no benchmark results are claimed unless raw outputs are produced in `benchmarks/raw/` and analyzed into `benchmarks/analysis/`.
