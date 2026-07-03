// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library VCEMTypes {
    enum ConsentStatus {
        NONE,
        ACTIVE,
        SUPERSEDED,
        REVOKED
    }

    enum Role {
        NONE,
        ADMIN,
        PARTICIPANT,
        RESEARCHER,
        DATA_CUSTODIAN,
        POLICY_GATEWAY,
        AUDITOR
    }

    struct ConsentPolicy {
        uint8 purposeMask;
        bytes32 scopeHash;
        bytes32 zkConsentCommitment;
    }

    struct ConsentVersion {
        uint64 version;
        ConsentStatus status;
        uint8 purposeMask;
        bytes32 scopeHash;
        bytes32 actorsRoot;
        bytes32 previousConsentHash;
        bytes32 consentHash;
        bytes32 zkConsentCommitment;
        uint64 timestamp;
        uint64 revokedAt;
    }

    struct AccessEvent {
        bytes32 requestId;
        bytes32 participantId;
        bytes32 requestorId;
        bytes32 dataHash;
        bytes32 scopeHash;
        uint64 consentVersion;
        bytes32 consentHash;
        bytes32 actorsRoot;
        uint8 purpose;
        uint64 timestamp;
        bool authorized;
    }

    uint8 internal constant PURPOSE_TREAT = 1 << 0;
    uint8 internal constant PURPOSE_RESEARCH = 1 << 1;
    uint8 internal constant PURPOSE_PUBHLTH = 1 << 2;
    uint8 internal constant PURPOSE_OTHER = 1 << 3;
    uint8 internal constant PURPOSE_MASK_ALL = PURPOSE_TREAT | PURPOSE_RESEARCH | PURPOSE_PUBHLTH | PURPOSE_OTHER;

    function isValidPurposeMask(uint8 purposeMask) internal pure returns (bool) {
        return purposeMask != 0 && (purposeMask & ~PURPOSE_MASK_ALL) == 0;
    }

    function isSingleValidPurpose(uint8 purpose) internal pure returns (bool) {
        return purpose != 0 && (purpose & (purpose - 1)) == 0 && (purpose & PURPOSE_MASK_ALL) != 0;
    }
}
