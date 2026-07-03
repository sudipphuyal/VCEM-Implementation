# Besu Deployment

The current Besu directory is still scaffolding. It describes the target topology but has not generated a real IBFT 2.0 network.

Target:

- four validator nodes;
- one non-validator RPC node;
- two-second block period;
- private Docker bridge network;
- persistent volumes;
- generated validator keys ignored by Git;
- generated genesis with all validator addresses in `extraData`;
- deployment manifest with chain ID, contract addresses, bytecode hashes, Git commit, and timestamp.

Do not reuse generated private keys across environments. Generated key directories must remain ignored.
