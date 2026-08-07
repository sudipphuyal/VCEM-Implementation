# VCEM Security Invariant Test Report

## Purpose

This report records the additional property/invariant tests added for the Reviewer 2 Concern 8 response. The tests exercise the VCEM authorization model without changing the consent workflow, authorization semantics, benchmark behavior, or external contract interfaces.

## Environment

- Test framework: Hardhat, Mocha, Chai
- Property-testing library: fast-check 4.8.0
- Test file: `test/VCEMSecurityProperty.ts`
- Command: `npm run test:security:properties`
- Base seed: `20260807`
- Number of invariants: 7
- Generated cases per invariant: 100
- Total generated property cases: 700

## Invariants Tested

| # | Invariant | What the test proves |
| - | --------- | -------------------- |
| 1 | Non-current consent cannot authorize | After a consent update, an access request carrying the stale consent hash is rejected, while a request carrying the current consent hash can be authorized. |
| 2 | Revoked consent cannot authorize | After revocation, authorization fails even when the request otherwise matches the last policy state. |
| 3 | Used requestId cannot succeed again | A request ID that has already produced an authorized access event cannot be reused for a second authorization. |
| 4 | Signed-field mutation invalidates authorization | Changing any signed EIP-712 request field after signature creation causes authorization to fail. |
| 5 | Actor, purpose, scope, and data hash resolve against the same current consent state | Authorization succeeds only when actor membership, purpose, scope, data hash, and expected consent hash all match the active consent version in the same transaction. |
| 6 | Unauthorized state transitions cannot alter consent | A non-participant wallet cannot create, update, or revoke another participant's consent state. |
| 7 | Consent version chain cannot fork under permitted calls | Sequential participant-controlled updates produce a single linear chain where every version references the previous consent hash. |

## Execution Result

The suite was executed successfully:

```text
VCEM security property invariants
  ✔ non-current consent cannot authorize
  ✔ revoked consent cannot authorize
  ✔ used requestId cannot succeed again
  ✔ modification of any signed field invalidates authorization
  ✔ actor, purpose, scope, and data hash resolve against the same current consent state
  ✔ unauthorized state transitions cannot alter consent
  ✔ consent version chain cannot fork under permitted calls

7 passing
```

## Interpretation

These tests provide executable security evidence for the core VCEM claim: independently verifiable per-access consent-state binding. They specifically test stale consent rejection, revocation enforcement, replay rejection, signature binding, policy consistency, participant-only lifecycle control, and immutable consent-chain continuity.

## Limitations

These are randomized property/invariant tests, not formal verification. They increase evidence coverage but do not mathematically prove the absence of all possible vulnerabilities. The Slither report remains a static-analysis artifact, and future production work should add model checking or theorem-prover-backed formal verification for the most important consent and access invariants.
