# VCEM Correctness Matrix

The paper-aligned matrix is implemented only in `test/VCEMMatrix.ts` and run with:

```bash
npm run test:vcem:matrix
```

It defines exactly 60 policy cases from:

- 3 lifecycle conditions: active initial consent, modified active consent, revoked consent;
- 4 purpose conditions: treatment, research, public health, and a valid `OTHER` purpose that is intentionally policy-disallowed in the nominal matrix cases;
- 5 actor configurations: authorized, unauthorized, removed after modification, newly added, revoked or role-mismatched.

Each case executes two requests with unique matrix request IDs:

- nominal;
- adversarial or invalid-control. Replay is the only scenario that deliberately pre-authorizes and then reuses the adversarial request ID.

The adversarial controls include valid but policy-disallowed purpose, malformed purpose, invalid scope, tampered data hash, tampered signature, expired request, replayed request, unauthorized active researcher, active role-mismatched actor, revoked actor, actor removed after update, actor added after update, stale consent hash, stale actor-root state represented by a stale consent hash after actor-set update, and post-revocation access.

The result is exactly 120 outcomes. Evidence is written to:

- `artifacts/vcem-matrix/vcem-correctness-matrix.json`
- `artifacts/vcem-matrix/vcem-correctness-matrix.csv`
- `artifacts/vcem-matrix/vcem-concurrency-ordering.json`
- `artifacts/vcem-matrix/vcem-concurrency-ordering.csv`

The main matrix JSON/CSV contains case ID, lifecycle condition, consent version, actor configuration, requested purpose, scope condition, request type, expected outcome, actual outcome, exact denial reason, request ID, transaction hash, block number, transaction index, log index, consent hash, and pass/fail.

The concurrency evidence disables automine, submits an access transaction and a consent update in deterministic order, mines a controlled block, and records transaction/log positions proving that authorization used the consent state active at the access transaction position.

The test fails if any actual authorization result or exact denial reason differs from the expected result.
