import { ethers } from "ethers";

export const Purpose = {
  TREAT: 1 << 0,
  RESEARCH: 1 << 1,
  PUBHLTH: 1 << 2,
  OTHER: 1 << 3,
} as const;

export const ALL_PURPOSES = Purpose.TREAT | Purpose.RESEARCH | Purpose.PUBHLTH | Purpose.OTHER;

export function isSinglePurpose(value: number) {
  return value > 0 && (value & (value - 1)) === 0 && (value & ALL_PURPOSES) !== 0;
}

export function canonicalScopeHash(scope: Record<string, unknown>) {
  const ordered = Object.keys(scope)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = scope[key];
      return acc;
    }, {});
  return ethers.sha256(ethers.toUtf8Bytes(JSON.stringify(ordered)));
}
