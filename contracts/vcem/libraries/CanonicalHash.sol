// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {VCEMTypes} from "../VCEMTypes.sol";

library CanonicalHash {
    function sortActors(bytes32[] memory actors) internal pure returns (bytes32[] memory) {
        require(actors.length > 0, "CanonicalHash: empty actors");
        require(actors.length <= 64, "CanonicalHash: too many actors");

        for (uint256 i = 0; i < actors.length; i++) {
            require(actors[i] != bytes32(0), "CanonicalHash: empty actor");
            bytes32 key = actors[i];
            uint256 j = i;
            while (j > 0 && actors[j - 1] > key) {
                actors[j] = actors[j - 1];
                j--;
            }
            actors[j] = key;
        }

        for (uint256 i = 1; i < actors.length; i++) {
            require(actors[i] != actors[i - 1], "CanonicalHash: duplicate actor");
        }

        return actors;
    }

    function actorSetRoot(bytes32[] memory sortedActors) internal pure returns (bytes32) {
        return sha256(abi.encode(sortedActors));
    }

    function consentHash(
        bytes32 previousConsentHash,
        bytes32 participantId,
        uint64 version,
        VCEMTypes.ConsentStatus status,
        uint8 purposeMask,
        bytes32 scopeHash,
        bytes32 actorsRoot,
        bytes32 zkConsentCommitment,
        uint64 timestamp
    ) internal pure returns (bytes32) {
        return sha256(
            abi.encode(
                previousConsentHash,
                participantId,
                version,
                status,
                purposeMask,
                scopeHash,
                actorsRoot,
                zkConsentCommitment,
                timestamp
            )
        );
    }
}
