# ZKP Security Model

The current ZKP code is experimental and does not prove full VCEM authorization.

A future VCEM ZKP extension must prove:

- knowledge of an active consent commitment;
- actor membership in the active actor set;
- requested purpose is allowed;
- requested scope is allowed;
- request nullifier is fresh;
- proof is bound to request ID and data-hash commitment.

The baseline VCEM claim does not depend on ZKP. ZKP audit events must be explicitly labelled experimental, and proof-generation timings must be benchmarked separately from baseline VCEM authorization.
