export interface KeyProvider {
  getKey(keyId: string): Buffer;
  putKey(keyId: string, key: Buffer): void;
  destroyKey(keyId: string): void;
}

export class LocalKeyProvider implements KeyProvider {
  constructor(private readonly keys: Record<string, string> = {}) {}

  getKey(keyId: string): Buffer {
    const key = this.keys[keyId];
    if (!key) {
      throw new Error("participant key is unavailable or destroyed");
    }
    return Buffer.from(key, "hex");
  }

  putKey(keyId: string, key: Buffer) {
    this.keys[keyId] = key.toString("hex");
  }

  destroyKey(keyId: string) {
    delete this.keys[keyId];
  }
}

export interface KmsKeyProvider extends KeyProvider {
  providerName: "kms-or-hsm";
}
