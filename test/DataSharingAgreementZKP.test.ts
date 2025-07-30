import { ethers } from "hardhat";
import { expect } from "chai";
import fs from "fs";
import path from "path";

describe("DataSharingAgreementZKP", function () {
  let contract: any;
  let verifier: any;
  let utils: any;

  let proofA: any;
  let publicA: bigint[];
  let proofB: any;
  let publicB: bigint[];

  // Helper: parse snarkJS proof structure into Solidity types
  const parseProof = (filePath: string) => {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return {
      a: [BigInt(raw.pi_a[0]), BigInt(raw.pi_a[1])],
      b: [
        [BigInt(raw.pi_b[0][0]), BigInt(raw.pi_b[0][1])],
        [BigInt(raw.pi_b[1][0]), BigInt(raw.pi_b[1][1])]
      ],
      c: [BigInt(raw.pi_c[0]), BigInt(raw.pi_c[1])]
    };
  };

  before(async () => {
    const Verifier = await ethers.getContractFactory("ABVerifier");
    verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    const Utils = await ethers.getContractFactory("Utils");
    utils = await Utils.deploy();
    await utils.waitForDeployment();

    const DSAZKP = await ethers.getContractFactory("DataSharingAgreementZKP");
    contract = await DSAZKP.deploy(utils.target, verifier.target);
    await contract.waitForDeployment();

    // Parse ZK proofs from build folder
    proofA = parseProof(path.join("build", "proofA.json"));
    publicA = JSON.parse(fs.readFileSync(path.join("build", "publicA.json"), "utf-8")).map(BigInt);
    console.log("Public A:", publicA);
    console.log("Proof A.a:", proofA.a, " Proof A.b:", proofA.b," ProofA.c", proofA.c);
    proofB = parseProof(path.join("build", "proofB.json"));
    publicB = JSON.parse(fs.readFileSync(path.join("build", "publicB.json"), "utf-8")).map(BigInt);
  });
  it("should verify proof", async () => {
    const result = await verifier.verifyProof(
      proofA.a,
      proofA.b,
      proofA.c,
      publicA
    )
  });

  it("should create a DSA with a valid proof", async () => {
    const tx = await contract.createDsaWithProof(
      "1 hour",
      "ECG Records",
      proofA.a,
      proofA.b,
      proofA.c,
      publicA
    );
    await tx.wait();

    const dsaId = await contract.utils().then((u: any) =>
      u.generateDsaIdFromCommitments(publicA[0], 0)
    );

    const dsaInfo = await contract.getDsaInfo(dsaId);
    expect(dsaInfo.providerCommitment).to.equal(publicA[0]);
    expect(dsaInfo.state).to.equal(0); // Pending
  });

  it("should accept a DSA with a valid recipient proof", async () => {
    const tx = await contract.acceptDsaWithProof(
      publicA[0],
      "1 hour",
      proofB.a,
      proofB.b,
      proofB.c,
      publicB
    );
    await tx.wait();

    const dsaId = await contract.utils().then((u: any) =>
      u.generateDsaIdFromCommitments(publicA[0], 0)
    );

    const dsaInfo = await contract.getDsaInfo(dsaId);
    expect(dsaInfo.recipientCommitment).to.equal(publicB[0]);
    expect(dsaInfo.state).to.equal(1); // Active
  });
});
