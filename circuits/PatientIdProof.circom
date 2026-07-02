pragma circom 2.0.0;

include "circuits/poseidon.circom";

template PatientIdProof() {
    signal input party1;
    signal input party2;
    signal input secret;

    signal output commitment;

    component hash = Poseidon(3);
    hash.inputs[0] <== party1;  // patientId
    hash.inputs[1] <== party2;  // healthcareProfessionalId
    hash.inputs[2] <== secret;  // sharedData   


     commitment <== hash.out;
 
}

component main = PatientIdProof();

