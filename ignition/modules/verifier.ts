import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const deployVerifierModule = buildModule("deployVerifierModule", (m) => {
  const utilsAddress = process.env.UTILS_ADDRESS;
  if (!utilsAddress) {
    throw new Error(
      "Please provide the address of the Utils contract using the 'UTILS_ADDRESS' environment variable."
    );
  }

  const registriesAddress = process.env.REGISTRIES_ADDRESS;
  if (!registriesAddress) {
    throw new Error(
      "Please provide the address of the Registries contract using the 'REGISTRIES_ADDRESS' environment variable."
    );
  }

  // Deploy the VerifierImplementation contract
  const Verifier = m.contract("VerifierImplementation", [
    utilsAddress,
    registriesAddress,
  ]);

  return {
    Verifier,
  };
});

export default deployVerifierModule;
