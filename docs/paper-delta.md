# Paper Delta

- Existing legacy contracts use Solidity `0.8.27`; new VCEM contracts use Solidity `0.8.20`. Both compiler versions are pinned locally through `solc` and the `solc-0-8-27` npm alias, and Hardhat resolves both to local `soljson.js` files rather than downloading compilers at runtime.
- OpenZeppelin is recommended by the paper/task, but it is not installed in the current dependency set. The implemented VCEM contracts use self-contained role, pause, signature, and reentrancy controls. Replacing these with OpenZeppelin primitives is a future hardening task once dependencies can be installed and audited.
- Legacy DSA/RSA contracts store plaintext strings and delete state. They are retained for backward compatibility, not for VCEM claims.
- VCEM purpose requests use one explicit purpose bit: treatment `1`, research `2`, public health `4`, or other `8`.
- Modified consent is implemented as a new `ACTIVE` version. Previous versions remain immutable and historically `ACTIVE`; supersession is derived from later versions.
- Actor-set roots are now generated on-chain from sorted pseudonymous actor IDs rather than accepted as external metadata.
- Besu infrastructure is executable through Docker and validated by `npm run besu:config:validate`; full network execution still depends on local Docker availability.
- Benchmark scripts are executable, but no performance results are claimed unless the run metadata under `benchmarks/raw/` records successful execution.
- FHIR support is fixture-based, not live server integration.
- Authenticated proxy is implemented as a TypeScript API/service layer with PostgreSQL migrations, not a production-deployed clinical API.
- Legacy ZKP support remains experimental and is isolated behind `npm run test:legacy:zkp`. The command skips proof-dependent assertions when local proof artifacts are absent, intentionally untracked, or mismatched with the generated verifier. It does not prove VCEM authorization semantics.
- CI now includes secret scanning, dependency audit, Solhint, coverage, gas reporting, property tests, Slither invocation, and Besu config validation. The dependency audit currently has unresolved high/critical transitive findings recorded in `docs/dependency-risk-register.md`.
