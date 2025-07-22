# Besu Contracts

npm install 

npx hardhat clean

npx hardhat compile

npx hardhat test

## RPC calls

curl -X POST --data '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest", false],"id":1}' http://134.209.19.66:8545

## DEPLOY BESU

Note: To run with a different account run with "PRIVATE_KEY=<OTHER_PRIVATE_KEY> " before "npx hardhat"

1) Delete ignition/deplyments directory

2) Run - npx hardhat ignition deploy ./ignition/modules/Registries.ts --network besu

3) Copy contract address to REGISTRIES_ADDRESS var in .env

4) Run - npx hardhat ignition deploy ./ignition/modules/ResourceCertification.ts --network besu

5) Copy contract address to RESOURCE_CERTIFICATION_ADDRESS var in .env

6) Run - npx hardhat ignition deploy ./ignition/modules/Utils.ts --network besu

7) Copy contract address to UTILS_ADDRESS var in .env

8) Run - npx hardhat ignition deploy ./ignition/modules/ResourceSharingAgreement.ts --network besu

9) Copy contract address to RSA_ADDRESS var in .env

10) Run - npx hardhat ignition deploy ./ignition/modules/RsaEnumerator.ts --network besu

11) Copy contract address to RSA_ENUMERATOR_ADDRESS var in .env

12) Run - npx hardhat ignition deploy ./ignition/modules/DataSharingAgreement.ts --network besu

13) Copy contract address to DSA_ADDRESS var in .env

14) Run - npx hardhat ignition deploy ./ignition/modules/DsaEnumerator.ts --network besu

15) Copy contract address to DSA_ENUMERATOR_ADDRESS var in .env

## DEPLOY SEPOLIA

Note: To run with a different account run with "PRIVATE_KEY=<OTHER_PRIVATE_KEY> " before "npx hardhat"

1) Delete ignition/deplyments directory

2) Run - npx hardhat ignition deploy ./ignition/modules/Registries.ts --network sepolia

3) Copy contract address to REGISTRIES_ADDRESS var in .env

4) Run - npx hardhat ignition deploy ./ignition/modules/ResourceCertification.ts --network sepolia

5) Copy contract address to RESOURCE_CERTIFICATION_ADDRESS var in .env

6) Run - npx hardhat ignition deploy ./ignition/modules/Utils.ts --network sepolia

7) Copy contract address to UTILS_ADDRESS var in .env

8) Run - npx hardhat ignition deploy ./ignition/modules/ResourceSharingAgreement.ts --network sepolia

9) Copy contract address to RSA_ADDRESS var in .env

10) Run - npx hardhat ignition deploy ./ignition/modules/RsaEnumerator.ts --network sepolia

11) Copy contract address to RSA_ENUMERATOR_ADDRESS var in .env




## ZKP with Circom


Compile the circuit - 
circom circuits/PatientIdProof.circom --r1cs --wasm --sym -l circomlib -o build/
1.1) Generate Final zkey- 
snarkjs groth16 setup build/PatientIdProof.r1cs pot12_final.ptau build/PatientIdProof_0000.zkey
1.2) then run this - 
snarkjs zkey contribute build/PatientIdProof_0000.zkey build/PatientIdProof_final.zkey --name="1st zkey contribution"
1.2.1) export verification key - 
snarkjs zkey export verificationkey build/PatientIdProof_final.zkey build/verification_key.json


Generate witness -
For A
node build/PatientIdProof_js/generate_witness.js build/PatientIdProof_js/PatientIdProof.wasm inputA.json build/witnessA.wtns
For B  
node build/PatientIdProof_js/generate_witness.js build/PatientIdProof_js/PatientIdProof.wasm inputB.json build/witnessB.wtns

Generate Proof
For A
snarkjs groth16 prove build/PatientIdProof_final.zkey build/witnessA.wtns build/proofA.json build/publicA.json

For B
snarkjs groth16 prove build/PatientIdProof_final.zkey build/witnessB.wtns build/proofB.json build/publicB.json

Verify Proof
For A
snarkjs groth16 verify build/verification_key.json build/publicA.json build/proofA.json
For B
snarkjs groth16 verify build/verification_key.json build/publicB.json build/proofB.json

1.3) Generate Witness - node build/PatientIdProof_js/generate_witness.js build/PatientIdProof_js/PatientIdProof.wasm input.json build/witness.wtns
2) Generate Proof - snarkjs groth16 prove build/PatientIdProof_final.zkey build/witness.wtns build/proof.json build/public.json
3) Verify Proof - snarkjs groth16 verify build/verification_key.json build/public.json build/proof.json
The verification uses only the publicly shared values
4) Export Verifier - snarkjs zkey export solidityverifier build/PatientIdProof_final.zkey contracts/PatientIdVerifier.sol

Export Verfication key
snarkjs zkey export verificationkey build/PatientIdProof_final.zkey verification_key.json
