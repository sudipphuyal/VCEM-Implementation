# Besu VCEM Local Network

This directory is scaffolding for a reproducible private Besu IBFT 2.0 experiment network: four validators, one private localhost-bound RPC node, two-second block period, Docker network isolation, and persistent volumes.

The checked-in `genesis.json` is a template. Generate validator keys and a real IBFT `extraData` value before running experiments; do not reuse validator keys across environments.
