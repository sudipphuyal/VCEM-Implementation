# Reproducibility

## Local

1. Copy `.env.example` to `.env` and fill local-only values.
2. Install pinned dependencies with `npm ci`.
3. Compile with `HARDHAT_DISABLE_DOWNLOADS=true npm run compile`.
4. Run supported tests with `npm test`.
5. Run VCEM unit tests with `npm run test:vcem`.
6. Generate paper-aligned 120-outcome matrix evidence with `npm run test:vcem:matrix`.
7. Run isolated experimental legacy ZKP tests with `npm run test:legacy:zkp`; proof-dependent assertions are skipped when local proof artifacts are absent or mismatched.
8. Verify deployed bytecode with `npm run audit:verify-bytecode` after creating `deployments/vcem-manifest.json`.
9. Run `npm run audit:verify -- --rpc=<rpc> --consent=<address> --audit=<address>`.
10. Run quality/security checks with `npm run secret:scan`, `npm run solhint`, `npm run test:property`, `npm run coverage`, `npm run gas`, `npm run besu:config:validate`, and `npm run security:audit`.
11. Run deterministic temporal-ordering tests with `npm run test:temporal`.
12. Run Concern 10 controls with `npm run test:audit-integrity`.

`npm run security:audit` is intentionally a release gate. It currently fails on unresolved high/critical transitive dependency findings documented in `docs/dependency-risk-register.md`.

## Besu

`infrastructure/besu` contains the reproducible local Besu network used for VCEM experiments. It generates four unique IBFT validator identities, one non-validator RPC identity, a valid IBFT `extraData` field, static peers, and a funded local deployer account.

```bash
npm run besu:generate-network
npm run besu:up
npm run besu:status
npm run besu:verify
npm run compile
npm run besu:deploy-vcem
npm run audit:verify-bytecode
```

Generated keys and genesis material are written under ignored paths:

- `infrastructure/besu/generated/`
- `infrastructure/besu/validators/`
- `infrastructure/besu/rpc/`

The deployment manifest is written to `deployments/vcem-manifest.json` and includes chain ID, topology, validator addresses, contract addresses, bytecode hashes, ABI version, Git commit, and timestamp.

The Reviewer 2 temporal-semantics experiment is separate from the original benchmark campaign:

```bash
npm run test:temporal
VCEM_EVALUATED_ROOT=/path/to/worktree-at-6077d27 npm run experiment:temporal:besu
```

It writes run-level evidence under `reports/temporal-semantics/`. The Besu runner requires exactly 20 trials, verifies the evaluated worktree commit, and measures submission-to-receipt latency with one confirmation. It does not treat Hardhat mining latency as manuscript evidence.

To exhaustively verify the preserved evaluated authorization population:

```bash
npm run besu:up
npm run audit:verify-full-population
npm run test:audit-integrity
```

Outputs are written under `reports/audit-integrity/`. These are peer-review/revision artifacts. The full verifier uses on-chain evidence and local ABIs, not application-layer logs; it is author-developed and is not evidence of external organizational replication.

To stop without deleting generated keys:

```bash
npm run besu:down
```

To remove containers, volumes, and generated local keys:

```bash
npm run besu:clean
```

## Benchmarks

Benchmark tooling is executable, but no benchmark results are claimed unless raw outputs are produced by successful runs.

```bash
npm run benchmark:seed
npm run benchmark:baseline
npm run benchmark:vcem
npm run benchmark:all
npm run benchmark:analyze
```

Expected outputs:

- `benchmarks/raw/fixtures/benchmark-fixtures.json`
- `benchmarks/raw/baseline/<users>u/run-<n>/metadata.json`
- `benchmarks/raw/vcem/<users>u/run-<n>/metadata.json`
- `benchmarks/analysis/summary.json`
- `benchmarks/analysis/summary.csv`
- `benchmarks/reports/benchmark-report.md`

Each run metadata file explicitly states `executed`, `failed`, or `not executed`.
