# Besu Deployment

The local VCEM network is generated from `infrastructure/besu` and is intended for reproducible experiments, not production clinical deployment.

## Topology

- 4 IBFT 2.0 validator nodes: `validator1` through `validator4`
- 1 non-validator RPC node: `rpc`
- 2-second IBFT block period
- Docker bridge network: `vcem-besu`
- Persistent Docker volumes per node
- Static peer file generated from unique node identities
- HTTP JSON-RPC bound to `127.0.0.1:8545` on the RPC node
- Prometheus metrics bound to localhost:
  - `validator1`: `127.0.0.1:9545`
  - `validator2`: `127.0.0.1:9546`
  - `validator3`: `127.0.0.1:9547`
  - `validator4`: `127.0.0.1:9548`
  - `rpc`: `127.0.0.1:9549`

## Generated Material

Run:

```bash
npm run besu:generate-network
```

This creates:

- `infrastructure/besu/generated/genesis.json`
- `infrastructure/besu/generated/static-nodes.json`
- `infrastructure/besu/generated/network-manifest.json`
- `infrastructure/besu/generated/deployer.key`
- `infrastructure/besu/validators/*/key`
- `infrastructure/besu/rpc/key`

The generated directories are ignored by Git. Do not commit validator keys, node keys, deployer keys, or generated secrets.

## Network Commands

```bash
npm run besu:generate-network
npm run besu:up
npm run besu:status
npm run besu:verify
npm run besu:logs
npm run besu:down
npm run besu:clean
```

`npm run besu:verify` first checks chain ID, peer count, validator set, and block production. It then performs fault-tolerance validation:

- all four validators running: blocks must be produced;
- one validator stopped: blocks must continue;
- two validators stopped: chain must halt;
- stopped validators restarted: block production must resume.

## VCEM Deployment

Compile first, then deploy the VCEM contracts to the local Besu RPC node:

```bash
npm run compile
npm run besu:deploy-vcem
```

The deployer reads `infrastructure/besu/generated/deployer.key`, deploys `VCEMRegistry`, `VCEMConsent`, and `VCEMAudit`, and writes:

```text
deployments/vcem-manifest.json
```

The manifest includes chain ID, validator addresses, topology, contract addresses, deployment transaction hashes, ABI version, local runtime bytecode hashes, deployed runtime bytecode hashes, Git commit, and timestamp.

## Bytecode Verification

After deployment:

```bash
npm run audit:verify-bytecode
```

This compares deployed runtime bytecode against local compiled artifacts using the deployment manifest.

## Cleanup

```bash
npm run besu:clean
```

This stops containers, removes Docker volumes for this compose project, and deletes ignored generated key/config directories.
