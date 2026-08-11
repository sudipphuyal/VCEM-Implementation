import { expect } from "chai";
import { ethers } from "hardhat";
import { createAuditRelay } from "../services/api/server";

describe("Audit relay nonce recovery", function () {
  it("resynchronizes the pending nonce after a submission error", async function () {
    const [gateway] = await ethers.getSigners();

    let nonceQueries = 0;
    const observedNonces: number[] = [];

    const provider = {
      async getTransactionCount(_address: string, blockTag: string) {
        expect(blockTag).to.equal("pending");
        nonceQueries += 1;
        return 42;
      },
    };

    const signer: any = {
      provider,
      async getAddress() {
        return gateway.address;
      },
      async sendTransaction(tx: any) {
        observedNonces.push(Number(tx.nonce));

        if (observedNonces.length === 1) {
          const err: any = new Error("synthetic BAD_DATA submission failure");
          err.code = "BAD_DATA";
          throw err;
        }

        return {
          hash: ethers.keccak256(ethers.toUtf8Bytes("successful-retry-sequence")),
          async wait() {
            return { status: 1, blockNumber: 1 };
          },
        };
      },
    };

    const abi = [
      "function authorizeAndLogAccess((bytes32 participantId,bytes32 requestorId,bytes32 dataHash,bytes32 scopeHash,uint8 requestedPurpose,bytes32 requestId,uint64 clientTimestamp,uint64 requestExpiry,bytes32 expectedConsentHash) request, bytes signature)",
    ];

    const relay = createAuditRelay(ethers.ZeroAddress, signer, abi);

    const request = (requestId: string) => ({
      participantId: ethers.ZeroHash,
      requestorId: ethers.ZeroHash,
      dataHash: ethers.ZeroHash,
      scopeHash: ethers.ZeroHash,
      requestedPurpose: 2,
      requestId,
      clientTimestamp: 1,
      requestExpiry: 2,
      expectedConsentHash: ethers.ZeroHash,
    });

    let firstFailed = false;

    try {
      await relay.authorizeAndLogAccess(
        request(ethers.keccak256(ethers.toUtf8Bytes("request-1"))),
        "0x"
      );
    } catch (err: any) {
      firstFailed = true;
      expect(err.code).to.equal("BAD_DATA");
    }

    expect(firstFailed).to.equal(true);

    await relay.authorizeAndLogAccess(
      request(ethers.keccak256(ethers.toUtf8Bytes("request-2"))),
      "0x"
    );

    expect(observedNonces).to.deep.equal([42, 42]);
    expect(nonceQueries).to.equal(2);
  });
});
