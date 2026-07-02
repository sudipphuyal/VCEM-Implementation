import { ethers } from "hardhat";
import { expect } from "chai";
import fs from "fs";

describe("ABVerifier", function () {
  let verifier: any;

  before(async () => {
    const Verifier = await ethers.getContractFactory("ABVerifier");
    verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
  });

  it("should validate the ZK proof successfully", async () => {
    const proof = JSON.parse(fs.readFileSync("build/proofA.json", "utf8"));
    const pub = JSON.parse(fs.readFileSync("build/publicA.json", "utf8")).map(BigInt);

    const a: [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
    const b: [[bigint, bigint], [bigint, bigint]] = [
      [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
      [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])]
    ];
    const c: [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

    const result = await verifier.verifyProof(a, b, c, pub);
    console.log("✅ On-chain result:", result);
    expect(result).to.equal(true);
  });
});
