// import { expect } from "chai";
// import { ethers } from "hardhat";
// import fs from "fs";

// describe("MainContract - ZKP DSA Flow", function () {
//   let contract: any;
//   let verifier: any;
//   let utils: any;
//   let registries: any;
//   let provider: any;
//   let recipient: any;
//   let proof: any;
//   let publicSignals: any;

//   before(async () => {
//     // Load proof and public signals
//     proof = JSON.parse(fs.readFileSync("build/proof.json", "utf8"));
//     publicSignals = JSON.parse(fs.readFileSync("build/public.json", "utf8"));
//   });

//   beforeEach(async function () {
//     const [deployer, userA, userB] = await ethers.getSigners();
//     provider = userA;
//     recipient = userB;

//     const Verifier = await ethers.getContractFactory("Verifier");
//     verifier = await Verifier.deploy();

//     const MockUtils = await ethers.getContractFactory("MockUtils");
//     utils = await MockUtils.deploy();

//     const MockRegistries = await ethers.getContractFactory("MockRegistries");
//     registries = await MockRegistries.deploy();

//     // Set roles
//     await registries.setPatient(provider.address, true);
//     await registries.setHealthcareProfessional(recipient.address, true);

//     const MainContract = await ethers.getContractFactory("MainContract");
//     contract = await MainContract.deploy(utils.target, registries.target, verifier.target);
//   });

//   function parseProof(proof: any, publicSignals: any) {
//     return {
//       a: [proof.pi_a[0], proof.pi_a[1]],
//       b: [
//         [proof.pi_b[0][1], proof.pi_b[0][0]],
//         [proof.pi_b[1][1], proof.pi_b[1][0]],
//       ],
//       c: [proof.pi_c[0], proof.pi_c[1]],
//       input: [publicSignals[0].toString()],
//     };
//   }

//   it("Should create DSA using valid ZK proof", async function () {
//     const { a, b, c, input } = parseProof(proof, publicSignals);

//     await expect(
//       contract.connect(provider).createDsaWithProof(
//         recipient.address,
//         "1h",
//         "labResults",
//         a,
//         b,
//         c,
//         input
//       )
//     ).to.emit(contract, "DsaCreated");
//   });

//   it("Should accept DSA using valid ZK proof", async function () {
//     const { a, b, c, input } = parseProof(proof, publicSignals);

//     // First create DSA
//     await contract.connect(provider).createDsaWithProof(
//       recipient.address,
//       "1h",
//       "labResults",
//       a,
//       b,
//       c,
//       input
//     );

//     const dsaId = await utils.generateDsaId(provider.address, recipient.address);

//     // Then accept it
//     await expect(
//       contract.connect(recipient).acceptDsaWithProof(
//         dsaId,
//         a,
//         b,
//         c,
//         input
//       )
//     ).to.emit(contract, "DsaAccepted");

//     const dsa = await contract.dsas(dsaId);
//     expect(dsa.state).to.equal(1); // Active
//   });

//   it("Should fail if ZK proof is invalid", async function () {
//     const fakeInput = {
//       a: [0, 0],
//       b: [
//         [0, 0],
//         [0, 0],
//       ],
//       c: [0, 0],
//       input: [0],
//     };

//     await expect(
//       contract.connect(provider).createDsaWithProof(
//         recipient.address,
//         "1h",
//         "labResults",
//         fakeInput.a,
//         fakeInput.b,
//         fakeInput.c,
//         fakeInput.input
//       )
//     ).to.be.revertedWith("Invalid ZK proof");
//   });
// });
