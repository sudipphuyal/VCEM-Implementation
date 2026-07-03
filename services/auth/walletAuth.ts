import crypto from "crypto";
import { ethers } from "ethers";

export type AuthSession = {
  wallet: string;
  requestorId: string;
  authenticatedAt: number;
};

export class NonceStore {
  private nonces = new Map<string, string>();

  issue(wallet: string) {
    const normalized = ethers.getAddress(wallet);
    const nonce = crypto.randomBytes(16).toString("hex");
    this.nonces.set(normalized, nonce);
    return `VCEM authentication nonce:${nonce}`;
  }

  consume(wallet: string, message: string) {
    const normalized = ethers.getAddress(wallet);
    const nonce = this.nonces.get(normalized);
    if (!nonce || message !== `VCEM authentication nonce:${nonce}`) {
      throw new Error("invalid or expired authentication nonce");
    }
    this.nonces.delete(normalized);
  }
}

export class SessionStore {
  private sessions = new Map<string, AuthSession>();

  create(wallet: string, requestorId: string) {
    const token = crypto.randomBytes(24).toString("hex");
    this.sessions.set(token, {
      wallet: ethers.getAddress(wallet),
      requestorId,
      authenticatedAt: Date.now(),
    });
    return token;
  }

  require(token: string) {
    const session = this.sessions.get(token);
    if (!session) {
      throw new Error("unauthenticated");
    }
    return session;
  }
}

export async function verifyWalletChallenge(wallet: string, message: string, signature: string, nonces: NonceStore) {
  const recovered = ethers.verifyMessage(message, signature);
  if (ethers.getAddress(recovered) !== ethers.getAddress(wallet)) {
    throw new Error("wallet signature mismatch");
  }
  nonces.consume(wallet, message);
  return ethers.getAddress(wallet);
}
