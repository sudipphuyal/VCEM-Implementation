# Paper Delta

- Existing legacy contracts use Solidity `0.8.27`; new VCEM contracts use Solidity `0.8.20`.
- OpenZeppelin is recommended by the paper/task, but it is not installed in the current dependency set. The implemented VCEM contracts use self-contained role, pause, signature, and reentrancy controls. Replacing these with OpenZeppelin primitives is a future hardening task once dependencies can be installed and audited.
- Legacy DSA/RSA contracts store plaintext strings and delete state. They are retained for backward compatibility, not for VCEM claims.
- Besu infrastructure is scaffolded but not executed in this work.
- Benchmark scripts are implemented, but no performance results are claimed.
- FHIR support is fixture-based, not live server integration.
- ZKP support remains experimental and does not yet prove full VCEM authorization semantics.
