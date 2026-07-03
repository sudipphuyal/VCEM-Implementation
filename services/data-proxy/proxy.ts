import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { decryptArtifact, EncryptedArtifact } from "./crypto";

const accessAuthorizedTopic = ethers.id(
  "AccessAuthorized(bytes32,bytes32,bytes32,bytes32,bytes32,uint8,uint64,bytes32,bytes32,uint64)"
);

export type ProxyConfig = {
  rpcUrl: string;
  auditAddress: string;
  artifactStore: string;
  keys: Record<string, string>;
};

/**
 * @deprecated Legacy fixture helper. This function is intentionally not used by
 * production API code because a transaction hash plus expected data hash is too
 * close to a reusable bearer token. Use PolicyDataProxy instead.
 */
export async function retrieveAuthorizedArtifact(config: ProxyConfig, transactionHash: string, expectedDataHash: string) {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const receipt = await provider.getTransactionReceipt(transactionHash);
  if (!receipt || receipt.status !== 1) {
    throw new Error("authorization transaction is missing or failed");
  }

  const log = receipt.logs.find(
    (entry) => entry.address.toLowerCase() === config.auditAddress.toLowerCase() && entry.topics[0] === accessAuthorizedTopic
  );
  if (!log) {
    throw new Error("transaction does not contain a VCEM AccessAuthorized event");
  }

  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
    ["bytes32", "bytes32", "uint8", "uint64", "bytes32", "bytes32", "uint64"],
    log.data
  );
  const dataHash = decoded[0] as string;
  if (dataHash.toLowerCase() !== expectedDataHash.toLowerCase()) {
    throw new Error("authorized data hash does not match requested artifact");
  }

  const artifactPath = path.join(config.artifactStore, `${expectedDataHash}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as EncryptedArtifact;
  const keyHex = config.keys[artifact.keyId];
  if (!keyHex) {
    throw new Error("participant key is unavailable or destroyed");
  }
  const plaintext = decryptArtifact(Buffer.from(keyHex, "hex"), artifact);
  const computedHash = ethers.sha256(plaintext);
  if (computedHash.toLowerCase() !== expectedDataHash.toLowerCase()) {
    throw new Error("artifact integrity hash mismatch");
  }
  return plaintext;
}
