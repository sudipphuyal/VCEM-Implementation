# VCEM Correctness Matrix

The paper-aligned matrix is implemented in `test/VCEMMatrix.ts` and run with:

```bash
npm run test:vcem:matrix
```

It defines exactly 60 policy cases from:

- 3 lifecycle conditions: active initial consent, modified active consent, revoked consent;
- 4 purpose conditions: treatment, research, public health, unsupported;
- 5 actor configurations: authorized, unauthorized, removed after modification, newly added, revoked or role-mismatched.

Each case executes two requests:

- nominal;
- adversarial or invalid-control.

The result is exactly 120 outcomes. Evidence is written to:

- `artifacts/vcem-matrix/vcem-correctness-matrix.json`
- `artifacts/vcem-matrix/vcem-correctness-matrix.csv`

The test fails if any actual authorization result differs from the expected result.
