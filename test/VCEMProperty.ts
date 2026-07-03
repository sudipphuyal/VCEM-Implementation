import { expect } from "chai";
import { ethers } from "ethers";
import fc from "fast-check";

const coder = ethers.AbiCoder.defaultAbiCoder();

function consentHash(input: {
  previousConsentHash: string;
  participantId: string;
  purposeMask: number;
  scopeHash: string;
  actorsRoot: string;
  timestamp: bigint;
  version: bigint;
}) {
  return ethers.sha256(
    coder.encode(
      ["bytes32", "bytes32", "uint8", "bytes32", "bytes32", "uint64", "uint64"],
      [
        input.previousConsentHash,
        input.participantId,
        input.purposeMask,
        input.scopeHash,
        input.actorsRoot,
        input.timestamp,
        input.version,
      ]
    )
  );
}

function bytes32Arb() {
  return fc.uint8Array({ minLength: 32, maxLength: 32 }).map((bytes) => ethers.hexlify(bytes));
}

describe("VCEM canonical hash properties", function () {
  it("changes when any consent-chain field changes", function () {
    fc.assert(
      fc.property(
        bytes32Arb(),
        bytes32Arb(),
        fc.integer({ min: 0, max: 255 }),
        bytes32Arb(),
        bytes32Arb(),
        fc.bigInt({ min: 1n, max: 2n ** 48n }),
        fc.bigInt({ min: 1n, max: 2n ** 32n }),
        (previousConsentHash, participantId, purposeMask, scopeHash, actorsRoot, timestamp, version) => {
          const base = { previousConsentHash, participantId, purposeMask, scopeHash, actorsRoot, timestamp, version };
          const original = consentHash(base);
          expect(consentHash({ ...base, purposeMask: purposeMask ^ 1 })).to.not.equal(original);
          expect(consentHash({ ...base, timestamp: timestamp + 1n })).to.not.equal(original);
          expect(consentHash({ ...base, version: version + 1n })).to.not.equal(original);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("uses ABI encoding semantics rather than packed concatenation", function () {
    fc.assert(
      fc.property(bytes32Arb(), bytes32Arb(), bytes32Arb(), bytes32Arb(), (previousConsentHash, participantId, scopeHash, actorsRoot) => {
        const structured = consentHash({
          previousConsentHash,
          participantId,
          purposeMask: 7,
          scopeHash,
          actorsRoot,
          timestamp: 123n,
          version: 2n,
        });
        const packed = ethers.sha256(
          ethers.concat([
            previousConsentHash,
            participantId,
            ethers.toBeHex(7, 1),
            scopeHash,
            actorsRoot,
            ethers.toBeHex(123, 8),
            ethers.toBeHex(2, 8),
          ])
        );
        expect(structured).to.not.equal(packed);
      }),
      { numRuns: 50 }
    );
  });
});
