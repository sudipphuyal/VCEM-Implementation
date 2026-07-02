import crypto from "crypto";

export type EncryptedArtifact = {
  algorithm: "aes-256-gcm";
  keyId: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  dataHash: string;
};

export function generateParticipantKey(): Buffer {
  return crypto.randomBytes(32);
}

export function encryptArtifact(keyId: string, key: Buffer, plaintext: Buffer): EncryptedArtifact {
  if (key.length !== 32) {
    throw new Error("AES-256-GCM requires a 32-byte key");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: "aes-256-gcm",
    keyId,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    dataHash: `0x${crypto.createHash("sha256").update(plaintext).digest("hex")}`,
  };
}

export function decryptArtifact(key: Buffer, artifact: EncryptedArtifact): Buffer {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(artifact.iv, "hex"));
  decipher.setAuthTag(Buffer.from(artifact.authTag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(artifact.ciphertext, "hex")), decipher.final()]);
}

export function destroyParticipantKey(keys: Record<string, string>, keyId: string) {
  delete keys[keyId];
}
