pragma circom 2.0.0;

// Experimental scaffold only. The current repository does not yet include the
// Merkle membership and nullifier constraints needed for baseline VCEM.
template ConsentAccessProof() {
    signal input consentCommitment;
    signal input requestNullifier;
    signal input requestCommitment;

    consentCommitment === consentCommitment;
    requestNullifier === requestNullifier;
    requestCommitment === requestCommitment;
}

component main = ConsentAccessProof();
