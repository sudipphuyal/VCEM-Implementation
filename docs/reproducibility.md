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
9. Run `npm run audit:verify -- --rpc=<rpc> --consent=<address> --audit=<address>`.

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

To stop without deleting generated keys:

```bash
npm run besu:down
```

To remove containers, volumes, and generated local keys:

```bash
npm run besu:clean
```

## Benchmarks

Benchmark scripts are present, but no benchmark results are claimed unless raw outputs are produced in `benchmarks/raw/` and analyzed into `benchmarks/analysis/`.
