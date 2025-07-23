import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";

describe("ABVerifier", function () {
  it("should validate the ZK proof successfully", async () => {
    const Verifier = await ethers.getContractFactory("ABVerifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    const proof = JSON.parse(fs.readFileSync("build/proofA.json", "utf8"));
    const pub = JSON.parse(fs.readFileSync("build/publicA.json", "utf8")).map(BigInt);

    const a = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
    const b = [
      [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
      [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])]
    ];
    const c = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

    const result = await verifier.verifyProof(a, b, c, pub);
    expect(result).to.be.true;
  });
});
