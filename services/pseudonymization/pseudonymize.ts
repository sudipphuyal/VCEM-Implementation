import crypto from "crypto";

export function pseudonymize(namespace: string, rawIdentifier: string, secret = process.env.VCEM_PSEUDONYMIZATION_SECRET): string {
  if (!secret) {
    throw new Error("VCEM_PSEUDONYMIZATION_SECRET is required");
  }
  return `0x${crypto.createHmac("sha256", secret).update(`${namespace}:${rawIdentifier}`).digest("hex")}`;
}
