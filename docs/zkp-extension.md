# ZKP Extension

Existing ZKP assets are retained as experimental legacy material:

- `circuits/PatientIdProof.circom`
- `circuits/DsaAgreementProof.circom`
- `contracts/ABVerifier.sol`
- `contracts/DataSharingAgreementZKP.sol`

They prove simple commitments and do not yet prove VCEM authorization semantics.

The scaffold `zkp/circuits/ConsentAccessProof.circom` is intentionally labelled experimental. A complete VCEM ZKP circuit still needs:

- active consent commitment existence;
- requestor authorization via Merkle inclusion or equivalent;
- purpose permission;
- scope permission;
- request nullifier linkage;
- replay-resistant public nullifier;
- on-chain verifier integration with the active `VCEMConsent` version.

ZKP proof generation time is not part of baseline VCEM performance claims.
