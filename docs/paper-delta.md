# Paper Delta

- Existing legacy contracts use Solidity `0.8.27`; new VCEM contracts use Solidity `0.8.20`. Both compiler versions are pinned locally through `solc` and the `solc-0-8-27` npm alias, and Hardhat resolves both to local `soljson.js` files rather than downloading compilers at runtime.
- OpenZeppelin is recommended by the paper/task, but it is not installed in the current dependency set. The implemented VCEM contracts use self-contained role, pause, signature, and reentrancy controls. Replacing these with OpenZeppelin primitives is a future hardening task once dependencies can be installed and audited.
- Legacy DSA/RSA contracts store plaintext strings and delete state. They are retained for backward compatibility, not for VCEM claims.
- VCEM purpose requests use one explicit purpose bit: treatment `1`, research `2`, public health `4`, or other `8`.
- Modified consent is implemented as a new `ACTIVE` version. Previous versions remain immutable and historically `ACTIVE`; supersession is derived from later versions.
- Actor-set roots are now generated on-chain from sorted pseudonymous actor IDs rather than accepted as external metadata.
- Besu infrastructure is scaffolded but not executed in this work.
- Benchmark scripts are implemented, but no performance results are claimed.
- FHIR support is fixture-based, not live server integration.
- Authenticated proxy is implemented as a TypeScript service layer, not a deployed HTTP API.
- Legacy ZKP support remains experimental, is isolated behind `npm run test:legacy:zkp`, currently fails because checked-in proof artifacts do not verify against `ABVerifier`, and does not prove VCEM authorization semantics.
