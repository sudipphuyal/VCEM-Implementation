# Dependency Risk Register

Last reviewed: 2026-07-03.

Command run:

```bash
npm audit --json
npm audit fix
```

Current `npm audit` result after non-forcing remediation attempt:

- Total vulnerabilities: 54
- Low: 19
- Moderate: 21
- High: 11
- Critical: 3

`npm audit fix` did not complete because npm reported a Hardhat peer-dependency conflict between `hardhat@2.24.3` and newer transitive `@nomicfoundation/hardhat-verify` requirements. `npm audit fix --force` was not applied because it would introduce breaking major upgrades across Hardhat/Ignition/toolbox packages and could invalidate the reproducible offline compiler and test setup.

| Dependency family | Severity | Direct dependency | Why unresolved | Remediation path |
| --- | --- | --- | --- | --- |
| Hardhat / Ignition / Toolbox | Moderate to high transitive | `hardhat`, `@nomicfoundation/hardhat-toolbox`, `@nomicfoundation/hardhat-ignition`, `@typechain/hardhat` | Safe fix requires coordinated major upgrade to Hardhat 3 era packages. | Plan a dedicated Hardhat 3 migration branch with compile/test/audit-verifier parity checks. |
| `ethers` transitive `ws` / `@ethersproject/*` | Low to high transitive | `ethers` direct | Some advisories are from nested packages pulled by tooling and `circomlibjs`. Updating `ethers` alone is lower risk but does not clear all findings. | Evaluate `ethers@6.17.x`, then rerun full VCEM, audit, and Besu deployment tests. |
| `solidity-coverage` dependency tree | Moderate to critical transitive | `solidity-coverage` direct | Latest non-breaking install still pulls older web3/mocha-related transitive packages; audit suggests semver-major or incompatible graph changes. | Track upstream coverage plugin release or replace coverage tooling in a dedicated CI hardening branch. |
| `solc` / `tmp` | Low to high transitive | `solc`, `solc-0-8-27` direct | Audit suggests downgrading `solc` to an incompatible major version, which conflicts with VCEM Solidity 0.8.20 and legacy 0.8.27 compiler pinning. | Keep local compiler packages pinned; avoid exposing compiler tooling in production runtime images. |
| ZKP tooling | Mixed transitive | `snarkjs`, `circomlibjs`, `ffjavascript` | Legacy ZKP is experimental and isolated; upgrades can change proof artifacts/verifier compatibility. | Treat as experimental; refresh proof pipeline separately before claiming ZKP authorization evidence. |

CI includes `npm run security:audit`, which fails on high or critical findings. Current dependency risk must be resolved or explicitly waived by maintainers before using CI as a release gate.
