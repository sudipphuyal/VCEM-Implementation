import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { subtask, task } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import fs from "fs";
import path from "path";

import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: `.env.local`, override: true });

// Custom task to clean generated files
task("clean", "Cleans the cache and deletes all artifacts", async (_, hre) => {
  const pathsToDelete = [
    hre.config.paths.cache,
    hre.config.paths.artifacts,
    path.join(hre.config.paths.root, "typechain-types"),
  ];

  for (const p of pathsToDelete) {
    if (fs.existsSync(p)) {
      fs.rmdirSync(p, { recursive: true });
      console.log(`Deleted: ${p}`);
    }
  }
});

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: { solcVersion: string }, _hre, runSuper) => {
  if (args.solcVersion === "0.8.20") {
    const compilerPath = require.resolve("solc/soljson.js");
    return {
      compilerPath,
      isSolcJs: true,
      version: "0.8.20",
      longVersion: "0.8.20+commit.a1b79de6",
    };
  }
  return runSuper();
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
          evmVersion: "berlin",
        },
      },
      {
        version: "0.8.27",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
            },
          },
          viaIR: true,
          evmVersion: "berlin",
        },
      },
    ],
  },
  networks: {
    localhost: {
      url: "http://localhost:8545",
      accounts: process.env.BESU_PRIVATE_KEY
        ? [`0x${process.env.BESU_PRIVATE_KEY}`]
        : [],
    },
    besu: {
      url: process.env.BESU_NETWORK_URL || "",
      accounts: process.env.BESU_PRIVATE_KEY
        ? [`0x${process.env.BESU_PRIVATE_KEY}`]
        : [],
    },
    sepolia: {
      url: `${process.env.SEPOLIA_NETWORK_URL}${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.SEPOLIA_PRIVATE_KEY ?? ""],
    },
    zkSync: {
      url: "https://testnet.era.zksync.dev",
      accounts: [process.env.ZKSYNC_PRIVATE_KEY ?? ""]
  },
  },
  ignition: {
    blockPollingInterval: 1_000,
    requiredConfirmations: 1,
  },
};
export default config;
